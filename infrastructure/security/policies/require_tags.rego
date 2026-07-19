# Policy: mandatory tags on taggable resources (cost + ownership + data classification).
# Certified by docs/10 §5 (tags required for cost + ownership; no untagged data stores) +
# docs/08 §4.1 (data classification C0–C4 must be explicit).
# Input: terraform plan JSON.
package main

import rego.v1

mandatory_tags := {"Owner", "Environment", "CostCenter", "DataClass"}

# Curated set of taggable resources — enforce where tags are meaningful (esp. data stores),
# avoiding false positives on resources AWS does not tag.
taggable_types := {
	"aws_s3_bucket",
	"aws_db_instance",
	"aws_rds_cluster",
	"aws_dynamodb_table",
	"aws_instance",
	"aws_eks_cluster",
	"aws_ecr_repository",
	"aws_kms_key",
	"aws_security_group",
	"aws_msk_cluster",
	"aws_elasticache_cluster",
	"aws_lb",
}

deny contains msg if {
	some rc in input.resource_changes
	rc.type in taggable_types
	after := rc.change.after
	after != null
	tags := object.get(after, "tags", {})
	some req in mandatory_tags
	not tags[req]
	msg := sprintf("%s missing mandatory tag '%s' (docs/10 §5 — cost+ownership; docs/08 §4.1 — data class)", [rc.address, req])
}
