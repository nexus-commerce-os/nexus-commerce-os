# Security Policy

NEXUS Commerce OS is a security-first platform. We take vulnerabilities seriously
and appreciate responsible disclosure.

## Reporting a vulnerability

**Do not open a public issue for security problems.**

Report privately via **GitHub → Security → [Report a vulnerability](https://github.com/nexus-commerce-os/nexus-commerce-os/security/advisories/new)**
(GitHub Private Vulnerability Reporting). This creates a confidential advisory
visible only to you and the maintainers.

If GitHub reporting is unavailable, request a secure contact channel by opening a
minimal, detail-free issue titled "Security contact request" and a maintainer
will follow up privately.

Please include, where possible:

- A clear description of the issue and its impact.
- Steps to reproduce (proof-of-concept preferred over a live exploit).
- Affected component, path, commit, and environment.
- Any suggested remediation.

## Our commitment (response SLA)

| Stage | Target |
|-------|--------|
| Acknowledgement of report | within **3 business days** |
| Initial severity assessment | within **7 business days** |
| Fix or mitigation for Critical/High | as fast as practical; status updates at least weekly |
| Public disclosure | coordinated with the reporter after a fix is available |

## Scope

In scope: source code, infrastructure-as-code, CI/CD workflows, and container
images in this repository.

Out of scope: findings that require compromising a maintainer's account, social
engineering, physical access, denial-of-service via volumetric traffic, and
issues in third-party dependencies that are already publicly tracked (report
those upstream, but feel free to flag them to us).

## Safe harbor

We will not pursue or support legal action against researchers who:

- Make a good-faith effort to comply with this policy,
- Avoid privacy violations, data destruction, and service degradation,
- Only interact with accounts they own or have explicit permission to test, and
- Give us reasonable time to remediate before any public disclosure.

Activity conducted consistent with this policy is considered authorized, and we
will work with you to understand and resolve the issue quickly.

## Supply-chain integrity

Release artifacts are signed with [cosign](https://github.com/sigstore/cosign),
carry an SBOM, and record SLSA provenance. Verify signatures before trusting any
image. See [`docs/08-security-architecture.md`](docs/08-security-architecture.md).
