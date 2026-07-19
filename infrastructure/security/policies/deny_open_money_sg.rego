# Policy: no 0.0.0.0/0 ingress on money-path (Zone 4) security groups.
# Certified by docs/08 §1.1 (Zone 4 money · dual-control · isolated) + docs/10 §5.
# A security group is "money-path" if tagged DataClass=C4 or MoneyPath=true, or named for
# ledger/payout/psp/money. Such SGs MUST NOT expose ingress to the whole internet.
# Input: terraform plan JSON.
package main

import rego.v1

money_sg(rc) if {
	tags := object.get(rc.change.after, "tags", {})
	tags.DataClass == "C4"
}

money_sg(rc) if {
	tags := object.get(rc.change.after, "tags", {})
	tags.MoneyPath == "true"
}

money_sg(rc) if {
	name := object.get(rc.change.after, "name", "")
	regex.match("(?i)(ledger|payout|psp|money)", name)
}

# aws_security_group with an inline ingress block open to the world.
open_ingress(after) if {
	some block in object.get(after, "ingress", [])
	"0.0.0.0/0" in object.get(block, "cidr_blocks", [])
}

# aws_security_group_rule with cidr_blocks open to the world.
open_ingress(after) if {
	"0.0.0.0/0" in object.get(after, "cidr_blocks", [])
}

# aws_vpc_security_group_ingress_rule (single-cidr form).
open_ingress(after) if {
	object.get(after, "cidr_ipv4", "") == "0.0.0.0/0"
}

deny contains msg if {
	some rc in input.resource_changes
	rc.type in {"aws_security_group", "aws_security_group_rule", "aws_vpc_security_group_ingress_rule"}
	money_sg(rc)
	open_ingress(rc.change.after)
	msg := sprintf("%s exposes a money-path (Zone 4) SG to 0.0.0.0/0 — FORBIDDEN (docs/08 §1.1, docs/10 §5)", [rc.address])
}
