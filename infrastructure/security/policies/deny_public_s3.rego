# Policy: no public S3 buckets.
# Certified by docs/10 §5 (plan-time policy-as-code) + docs/08 §4 (data protection, C1–C4).
# Input: `terraform show -json` plan document (input.resource_changes[]).
package main

import rego.v1

# A bucket ACL that grants public/broad read is forbidden.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "aws_s3_bucket_acl"
	acl := rc.change.after.acl
	acl in {"public-read", "public-read-write", "authenticated-read"}
	msg := sprintf("S3 ACL '%s' on %s is public/broad — buckets MUST be private (docs/10 §5, docs/08 §4)", [acl, rc.address])
}

# The public-access-block MUST keep all four guards on; any false is a leak.
deny contains msg if {
	some rc in input.resource_changes
	rc.type == "aws_s3_bucket_public_access_block"
	after := rc.change.after
	some flag in ["block_public_acls", "block_public_policy", "ignore_public_acls", "restrict_public_buckets"]
	after[flag] == false
	msg := sprintf("%s sets %s=false — all four S3 public-access-block flags MUST be true (docs/10 §5)", [rc.address, flag])
}
