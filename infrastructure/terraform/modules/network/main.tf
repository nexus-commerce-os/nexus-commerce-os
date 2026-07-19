# =============================================================================
# network module — main
# Realizes [09 §2 topology] and [09 §4 networking]:
#   - ONE VPC per region, 3 subnet tiers (public / private-app / private-data)
#     replicated across >= 3 AZs.
#   - Private-DATA tier has NO route to an internet/NAT gateway (default-deny
#     egress for data stores); managed services reached via VPC endpoints.
#   - Outbound leaves through HORIZONTALLY-SCALED EGRESS CELLS (NAT fleet),
#     not one chokepoint (ADR-0017 R-020).
#   - Security groups are default-deny; app->data is by SG reference elsewhere.
#
# Design note: subnet CIDRs are DERIVED with cidrsubnet() from vpc_cidr + AZ
# index, so a region is described by exactly one CIDR + an AZ list — nothing is
# hardcoded and adding an AZ is a list edit.
# =============================================================================

locals {
  az_count = length(var.availability_zones)

  # Deterministic index per AZ so cidrsubnet() is stable across plans.
  az_index = { for idx, az in var.availability_zones : az => idx }

  # Three non-overlapping tier bands. Each tier occupies a distinct high-order
  # slot so tiers never collide as AZs are added.
  #   public : netnum 0                     .. az_count-1
  #   app    : netnum az_count              .. 2*az_count-1
  #   data   : netnum 2*az_count            .. 3*az_count-1
  public_cidrs = { for az, i in local.az_index :
    az => cidrsubnet(var.vpc_cidr, var.public_subnet_newbits, i)
  }
  app_cidrs = { for az, i in local.az_index :
    az => cidrsubnet(var.vpc_cidr, var.app_subnet_newbits, local.az_count + i)
  }
  data_cidrs = { for az, i in local.az_index :
    az => cidrsubnet(var.vpc_cidr, var.data_subnet_newbits, (2 * local.az_count) + i)
  }

  # Egress cells: default one per AZ (0 => az_count), else capped to the
  # requested count but never more than the AZs available.
  egress_cell_count = var.egress_cell_count == 0 ? local.az_count : min(var.egress_cell_count, local.az_count)
  egress_azs        = slice(var.availability_zones, 0, local.egress_cell_count)
}

# ------------------------------------------------------------------ VPC
resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(var.tags, { Name = "${var.name_prefix}-vpc" })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, { Name = "${var.name_prefix}-igw" })
}

# ------------------------------------------------------------------ Subnets
resource "aws_subnet" "public" {
  for_each = local.public_cidrs

  vpc_id                  = aws_vpc.this.id
  availability_zone       = each.key
  cidr_block              = each.value
  map_public_ip_on_launch = false # ALB/NAT get EIPs explicitly; nodes are never here.

  tags = merge(var.tags, {
    Name                     = "${var.name_prefix}-public-${each.key}"
    Tier                     = "public"
    "kubernetes.io/role/elb" = "1" # public ALBs discover these
  })
}

resource "aws_subnet" "app" {
  for_each = local.app_cidrs

  vpc_id            = aws_vpc.this.id
  availability_zone = each.key
  cidr_block        = each.value

  tags = merge(var.tags, {
    Name                              = "${var.name_prefix}-app-${each.key}"
    Tier                              = "private-app"
    "kubernetes.io/role/internal-elb" = "1" # internal ALBs
  })
}

resource "aws_subnet" "data" {
  for_each = local.data_cidrs

  vpc_id            = aws_vpc.this.id
  availability_zone = each.key
  cidr_block        = each.value

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-data-${each.key}"
    Tier = "private-data"
  })
}

# ------------------------------------------------------------------ Egress cells (NAT fleet)
# ADR-0017 R-020: a FLEET of NAT gateways (one per selected AZ), each with its
# own EIP, so outbound throughput scales horizontally and a cell loss reroutes.
resource "aws_eip" "egress" {
  for_each = toset(local.egress_azs)

  domain = "vpc"
  tags   = merge(var.tags, { Name = "${var.name_prefix}-egress-eip-${each.key}" })

  depends_on = [aws_internet_gateway.this]
}

resource "aws_nat_gateway" "egress_cell" {
  for_each = toset(local.egress_azs)

  allocation_id = aws_eip.egress[each.key].id
  subnet_id     = aws_subnet.public[each.key].id # NAT lives in the public tier

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-egress-cell-${each.key}"
    Role = "egress-cell" # metering/security control point ([09 §4])
  })

  depends_on = [aws_internet_gateway.this]
}

# ------------------------------------------------------------------ Route tables
# PUBLIC: default route to the IGW.
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "${var.name_prefix}-rt-public" })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

# PRIVATE-APP: one route table PER AZ, each pointing at its local egress cell
# (falls back to the first cell if that AZ has none), so egress is AZ-local and
# survives a single cell loss by re-pointing.
resource "aws_route_table" "app" {
  for_each = aws_subnet.app

  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "${var.name_prefix}-rt-app-${each.key}" })
}

resource "aws_route" "app_egress" {
  for_each = aws_subnet.app

  route_table_id         = aws_route_table.app[each.key].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = contains(local.egress_azs, each.key) ? aws_nat_gateway.egress_cell[each.key].id : aws_nat_gateway.egress_cell[local.egress_azs[0]].id
}

resource "aws_route_table_association" "app" {
  for_each = aws_subnet.app

  subnet_id      = each.value.id
  route_table_id = aws_route_table.app[each.key].id
}

# PRIVATE-DATA: NO default route. Deliberately internet-isolated ([09 §4]:
# "Data-tier subnets MUST have no route to an internet/NAT gateway"). Only the
# local VPC route (implicit) + gateway endpoints (below) reach it.
resource "aws_route_table" "data" {
  for_each = aws_subnet.data

  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "${var.name_prefix}-rt-data-${each.key}" })
}

resource "aws_route_table_association" "data" {
  for_each = aws_subnet.data

  subnet_id      = each.value.id
  route_table_id = aws_route_table.data[each.key].id
}

# ------------------------------------------------------------------ VPC endpoints (PrivateLink)
# Keeps managed-service + S3 traffic on the AWS backbone (cost + SSRF posture,
# [09 §4/§9]). Gateway endpoint (S3) is free and attaches to route tables;
# interface endpoints are per-service and live in the data subnets.
data "aws_region" "current" {}

resource "aws_vpc_endpoint" "s3_gateway" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"

  # Attach to the data route tables so the isolated data tier can reach S3
  # WITHOUT an internet/NAT path, plus the app tables.
  route_table_ids = concat(
    [for rt in aws_route_table.data : rt.id],
    [for rt in aws_route_table.app : rt.id],
  )

  tags = merge(var.tags, { Name = "${var.name_prefix}-vpce-s3" })
}

resource "aws_security_group" "endpoints" {
  name_prefix = "${var.name_prefix}-vpce-"
  description = "Allow HTTPS from the VPC to interface endpoints only."
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "HTTPS from within the VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  # Default-deny egress except return traffic within the VPC.
  egress {
    description = "Return traffic within VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-vpce-sg" })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_endpoint" "interface" {
  for_each = toset(var.interface_endpoint_services)

  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.${each.value}"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = [for s in aws_subnet.data : s.id]
  security_group_ids  = [aws_security_group.endpoints.id]

  tags = merge(var.tags, { Name = "${var.name_prefix}-vpce-${replace(each.value, ".", "-")}" })
}

# ------------------------------------------------------------------ Default-deny baseline SG
# A shared "deny-all" security group. Consumers (compute/data modules) reference
# THIS (or their own) and open specific ports by SG-reference, never CIDR
# ([09 §4]: "app->data access is by SG reference, not CIDR").
resource "aws_security_group" "default_deny" {
  name_prefix = "${var.name_prefix}-deny-"
  description = "Default-deny baseline. No ingress; egress only within VPC. Reference and narrow per consumer."
  vpc_id      = aws_vpc.this.id

  # No ingress rules == deny all inbound.

  egress {
    description = "Intra-VPC only by default; internet egress is via app route tables -> egress cells."
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-default-deny-sg" })

  lifecycle {
    create_before_destroy = true
  }
}

# ------------------------------------------------------------------ Flow logs (audit)
resource "aws_cloudwatch_log_group" "flow" {
  count = var.enable_flow_logs ? 1 : 0

  name              = "/nexus/vpc/${var.name_prefix}/flow-logs"
  retention_in_days = var.flow_log_retention_days
  tags              = var.tags
}

data "aws_iam_policy_document" "flow_assume" {
  count = var.enable_flow_logs ? 1 : 0

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "flow" {
  count = var.enable_flow_logs ? 1 : 0

  name_prefix        = "${var.name_prefix}-flow-"
  assume_role_policy = data.aws_iam_policy_document.flow_assume[0].json
  tags               = var.tags
}

data "aws_iam_policy_document" "flow_permissions" {
  count = var.enable_flow_logs ? 1 : 0

  statement {
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
    ]
    resources = ["${aws_cloudwatch_log_group.flow[0].arn}:*"]
  }
}

resource "aws_iam_role_policy" "flow" {
  count = var.enable_flow_logs ? 1 : 0

  name_prefix = "${var.name_prefix}-flow-"
  role        = aws_iam_role.flow[0].id
  policy      = data.aws_iam_policy_document.flow_permissions[0].json
}

resource "aws_flow_log" "this" {
  count = var.enable_flow_logs ? 1 : 0

  log_destination = aws_cloudwatch_log_group.flow[0].arn
  iam_role_arn    = aws_iam_role.flow[0].arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.this.id

  tags = merge(var.tags, { Name = "${var.name_prefix}-flow-log" })
}
