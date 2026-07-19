# Policy: every container declares resource requests + limits.
# Certified by docs/10 §5 (admission-time: "resource requests/limits required") — an
# unbounded container is a noisy-neighbor / DoS and blast-radius hazard (docs/08 §2.2 DoS).
# Reuses the `containers` set defined in deny_latest_image.rego (same package).
package main

import rego.v1

deny contains msg if {
	some c in containers
	not c.resources.limits.cpu
	msg := sprintf("container '%s' missing resources.limits.cpu (docs/10 §5 admission)", [c.name])
}

deny contains msg if {
	some c in containers
	not c.resources.limits.memory
	msg := sprintf("container '%s' missing resources.limits.memory (docs/10 §5 admission)", [c.name])
}

deny contains msg if {
	some c in containers
	not c.resources.requests.cpu
	msg := sprintf("container '%s' missing resources.requests.cpu (docs/10 §5 admission)", [c.name])
}

deny contains msg if {
	some c in containers
	not c.resources.requests.memory
	msg := sprintf("container '%s' missing resources.requests.memory (docs/10 §5 admission)", [c.name])
}
