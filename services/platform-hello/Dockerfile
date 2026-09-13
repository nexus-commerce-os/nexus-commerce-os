# syntax=docker/dockerfile:1.7
# ============================================================================
# platform-hello — multi-stage, distroless, non-root (docs/10 §6).
# Go static binary -> distroless-static:nonroot. No shell / no package manager
# in the runtime layer; read-only root FS at runtime (enforced by the chart).
# Base images MUST be pinned by digest and mirrored to ECR before deploy
# (docs/10 §6 "no pulling unverified public images at deploy time") — the
# :nonroot tags below are placeholders for the ECR-mirrored digest pins.
# ============================================================================

# ---- build stage ----------------------------------------------------------
# Pinned to the current Go patch release: the stdlib baked into the static binary
# is what Trivy scans, so an up-to-date toolchain clears the stdlib CVE class.
FROM golang:1.26.5 AS build
WORKDIR /src

# Cache module downloads separately from source for fast rebuilds.
COPY go.mod go.sum* ./
RUN go mod download

COPY . .

# CGO off => fully static binary that runs on scratch/distroless-static.
# -trimpath + no symbol table for a smaller, more reproducible artifact.
ARG APP_VERSION=0.1.0
ENV CGO_ENABLED=0 GOOS=linux
RUN go build -trimpath -ldflags="-s -w -X main.version=${APP_VERSION}" -o /out/platform-hello .

# ---- runtime stage --------------------------------------------------------
# distroless-static:nonroot ships as uid/gid 65532 with no shell.
FROM gcr.io/distroless/static-debian12:nonroot AS runtime

# OCI provenance labels (SBOM + cosign signature attached in CI, docs/10 §3/§6).
LABEL org.opencontainers.image.title="platform-hello" \
      org.opencontainers.image.description="NEXUS P0.1 walking-skeleton pipeline canary" \
      org.opencontainers.image.source="https://github.com/nexus/monorepo" \
      org.opencontainers.image.vendor="NEXUS Platform Engineering"

WORKDIR /
COPY --from=build /out/platform-hello /platform-hello

# 65532 = distroless "nonroot". Belt-and-suspenders with the chart's
# runAsNonRoot / runAsUser (docs/10 §5 admission).
USER 65532:65532

EXPOSE 8080 9090
ENTRYPOINT ["/platform-hello"]
