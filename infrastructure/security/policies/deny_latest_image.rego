# Policy: no ':latest' images — every container pins an immutable tag (git SHA) or digest.
# Certified by docs/10 §3 (immutable tag = git SHA; digests pinned; never `latest`) +
# docs/10 §5 admission ("no :latest") + ADR-0010 (replaceable, reproducible).
# Input: a rendered Kubernetes workload manifest (input.kind / input.spec...).
package main

import rego.v1

workload_kinds := {"Deployment", "StatefulSet", "DaemonSet", "Job", "ReplicaSet", "Pod", "CronJob"}

# Normalize container extraction across workload shapes.
containers contains c if {
	input.kind in workload_kinds
	some c in input.spec.template.spec.containers
}

containers contains c if {
	input.kind == "Pod"
	some c in input.spec.containers
}

containers contains c if {
	input.kind == "CronJob"
	some c in input.spec.jobTemplate.spec.template.spec.containers
}

# Explicit :latest tag.
deny contains msg if {
	some c in containers
	endswith(c.image, ":latest")
	msg := sprintf("container '%s' uses ':latest' — pin an immutable tag/digest (docs/10 §3, ADR-0010)", [c.name])
}

# No tag and no digest at all → mutable reference.
deny contains msg if {
	some c in containers
	not contains(c.image, "@sha256:")
	not tagged(c.image)
	msg := sprintf("container '%s' image '%s' is untagged/unpinned — pin the git-SHA tag or digest (docs/10 §3)", [c.name, c.image])
}

# An image reference is "tagged" if there is a ':' after the last '/' (registry-port colons excluded).
tagged(image) if {
	parts := split(image, "/")
	last := parts[count(parts) - 1]
	contains(last, ":")
}
