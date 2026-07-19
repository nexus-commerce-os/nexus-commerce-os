# conftest unit tests for the Terraform-plan policies (deny_public_s3, require_tags,
# deny_open_money_sg). Run with: conftest verify --policy infrastructure/security/policies --policy tests/policy
# Same package `main` as the policies, so `deny` is referenced directly.
package main

import rego.v1

# ---- deny_public_s3 --------------------------------------------------------
test_public_s3_acl_denied if {
	count(deny) > 0 with input as {"resource_changes": [{
		"address": "aws_s3_bucket_acl.leak",
		"type": "aws_s3_bucket_acl",
		"change": {"after": {"acl": "public-read"}},
	}]}
}

test_private_s3_acl_allowed if {
	count(deny) == 0 with input as {"resource_changes": [{
		"address": "aws_s3_bucket_acl.ok",
		"type": "aws_s3_bucket_acl",
		"change": {"after": {"acl": "private"}},
	}]}
}

test_public_access_block_flag_off_denied if {
	count(deny) > 0 with input as {"resource_changes": [{
		"address": "aws_s3_bucket_public_access_block.pab",
		"type": "aws_s3_bucket_public_access_block",
		"change": {"after": {
			"block_public_acls": true,
			"block_public_policy": false,
			"ignore_public_acls": true,
			"restrict_public_buckets": true,
		}},
	}]}
}

# ---- require_tags ----------------------------------------------------------
test_missing_tag_denied if {
	count(deny) > 0 with input as {"resource_changes": [{
		"address": "aws_dynamodb_table.ledger",
		"type": "aws_dynamodb_table",
		"change": {"after": {"tags": {"Owner": "commerce", "Environment": "prod"}}},
	}]}
}

test_all_tags_present_allowed if {
	count(deny) == 0 with input as {"resource_changes": [{
		"address": "aws_dynamodb_table.ledger",
		"type": "aws_dynamodb_table",
		"change": {"after": {"tags": {
			"Owner": "commerce",
			"Environment": "prod",
			"CostCenter": "cc-100",
			"DataClass": "C4",
		}}},
	}]}
}

# ---- deny_open_money_sg ----------------------------------------------------
test_money_sg_open_to_world_denied if {
	count(deny) > 0 with input as {"resource_changes": [{
		"address": "aws_security_group.payout",
		"type": "aws_security_group",
		"change": {"after": {
			"name": "nexus-payout-sg",
			"tags": {"DataClass": "C4", "Owner": "finance", "Environment": "prod", "CostCenter": "cc-9"},
			"ingress": [{"cidr_blocks": ["0.0.0.0/0"]}],
		}},
	}]}
}

test_money_sg_scoped_cidr_allowed if {
	count(deny) == 0 with input as {"resource_changes": [{
		"address": "aws_security_group.payout",
		"type": "aws_security_group",
		"change": {"after": {
			"name": "nexus-payout-sg",
			"tags": {"DataClass": "C4", "Owner": "finance", "Environment": "prod", "CostCenter": "cc-9"},
			"ingress": [{"cidr_blocks": ["10.0.0.0/16"]}],
		}},
	}]}
}

test_nonmoney_sg_open_allowed if {
	# A non-money SG open to the world is out of scope for THIS rule (edge WAF handles it).
	count(deny) == 0 with input as {"resource_changes": [{
		"address": "aws_security_group.edge",
		"type": "aws_security_group",
		"change": {"after": {
			"name": "nexus-edge-alb",
			"tags": {"DataClass": "C0", "Owner": "platform", "Environment": "prod", "CostCenter": "cc-1"},
			"ingress": [{"cidr_blocks": ["0.0.0.0/0"]}],
		}},
	}]}
}
