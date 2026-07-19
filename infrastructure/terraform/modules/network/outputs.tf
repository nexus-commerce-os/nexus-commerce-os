# =============================================================================
# network module — outputs
# These are the composition contract: compute/database/cache/messaging modules
# consume these ids from the ENV root (no module reaches into another module).
# =============================================================================

output "vpc_id" {
  description = "The region VPC id."
  value       = aws_vpc.this.id
}

output "vpc_cidr" {
  description = "The VPC CIDR (for SG-reference rules that legitimately need it)."
  value       = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "Public (edge/ALB/NAT) subnet ids, keyed by AZ."
  value       = { for az, s in aws_subnet.public : az => s.id }
}

output "app_subnet_ids" {
  description = "Private-app (EKS node) subnet ids, keyed by AZ. Feed to the compute module."
  value       = { for az, s in aws_subnet.app : az => s.id }
}

output "app_subnet_ids_list" {
  description = "Private-app subnet ids as a flat list (EKS/node-group inputs expect a list)."
  value       = [for s in aws_subnet.app : s.id]
}

output "data_subnet_ids" {
  description = "Private-data (Aurora/Redis/MSK) subnet ids, keyed by AZ. Internet-isolated."
  value       = { for az, s in aws_subnet.data : az => s.id }
}

output "data_subnet_ids_list" {
  description = "Private-data subnet ids as a flat list. Feed to database/cache/messaging modules."
  value       = [for s in aws_subnet.data : s.id]
}

output "egress_cell_nat_ids" {
  description = "NAT gateway ids of the egress-cell fleet (ADR-0017 R-020), keyed by AZ."
  value       = { for az, n in aws_nat_gateway.egress_cell : az => n.id }
}

output "egress_cell_public_ips" {
  description = "Elastic IPs of the egress cells — the stable outbound source IPs partners allowlist."
  value       = { for az, e in aws_eip.egress : az => e.public_ip }
}

output "default_deny_security_group_id" {
  description = "Baseline default-deny SG id; consumers reference and narrow it."
  value       = aws_security_group.default_deny.id
}

output "s3_gateway_endpoint_id" {
  description = "S3 gateway VPC endpoint id (lets the isolated data tier reach S3 off-internet)."
  value       = aws_vpc_endpoint.s3_gateway.id
}

output "interface_endpoint_ids" {
  description = "Interface VPC endpoint ids, keyed by service short-name."
  value       = { for k, v in aws_vpc_endpoint.interface : k => v.id }
}

output "availability_zones" {
  description = "The AZs this VPC spans (echoed for downstream multi-AZ placement)."
  value       = var.availability_zones
}
