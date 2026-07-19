# conftest unit tests for the Kubernetes manifest policies (deny_latest_image,
# require_resource_limits). Same package `main` as the policies.
package main

import rego.v1

# A fully-compliant Deployment: digest-pinned image + requests & limits.
good_deployment := {
	"kind": "Deployment",
	"spec": {"template": {"spec": {"containers": [{
		"name": "platform-hello",
		"image": "1234.dkr.ecr.us-east-1.amazonaws.com/nexus-platform-hello@sha256:abc123",
		"resources": {
			"requests": {"cpu": "50m", "memory": "64Mi"},
			"limits": {"cpu": "250m", "memory": "128Mi"},
		},
	}]}}},
}

test_good_deployment_allowed if {
	count(deny) == 0 with input as good_deployment
}

# ---- deny_latest_image -----------------------------------------------------
test_latest_tag_denied if {
	count(deny) > 0 with input as {
		"kind": "Deployment",
		"spec": {"template": {"spec": {"containers": [{
			"name": "app",
			"image": "nexus/app:latest",
			"resources": {
				"requests": {"cpu": "10m", "memory": "16Mi"},
				"limits": {"cpu": "100m", "memory": "64Mi"},
			},
		}]}}},
	}
}

test_sha_tag_allowed if {
	count(deny) == 0 with input as {
		"kind": "Deployment",
		"spec": {"template": {"spec": {"containers": [{
			"name": "app",
			"image": "nexus/app:2f1a9c",
			"resources": {
				"requests": {"cpu": "10m", "memory": "16Mi"},
				"limits": {"cpu": "100m", "memory": "64Mi"},
			},
		}]}}},
	}
}

# ---- require_resource_limits -----------------------------------------------
test_missing_limits_denied if {
	count(deny) > 0 with input as {
		"kind": "Deployment",
		"spec": {"template": {"spec": {"containers": [{
			"name": "app",
			"image": "nexus/app:2f1a9c",
			"resources": {"requests": {"cpu": "10m", "memory": "16Mi"}},
		}]}}},
	}
}

test_pod_shape_supported if {
	count(deny) > 0 with input as {
		"kind": "Pod",
		"spec": {"containers": [{
			"name": "app",
			"image": "nexus/app:latest",
			"resources": {
				"requests": {"cpu": "10m", "memory": "16Mi"},
				"limits": {"cpu": "100m", "memory": "64Mi"},
			},
		}]},
	}
}
