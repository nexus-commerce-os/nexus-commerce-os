{{/*
============================================================================
nexus-common — shared helpers
Consumed by the object templates (_deployment.tpl, _service.tpl, ...) which
are `include`d from a service chart. All helpers take the ROOT context (`.`)
of the CONSUMING chart, so they read that chart's `.Values`.
============================================================================
*/}}

{{/* Base name: fullnameOverride > nameOverride > chart .Release name */}}
{{- define "nexus-common.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "nexus-common.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{/* Immutable image ref — prefer digest pin (docs/10 §3), fall back to tag. */}}
{{- define "nexus-common.image" -}}
{{- $repo := required "image.repository is REQUIRED" .Values.image.repository -}}
{{- if .Values.image.digest -}}
{{- printf "%s@%s" $repo .Values.image.digest -}}
{{- else -}}
{{- printf "%s:%s" $repo (required "image.tag or image.digest is REQUIRED (no :latest — docs/10 §3)" .Values.image.tag) -}}
{{- end -}}
{{- end -}}

{{/* Standard labels (Kubernetes recommended + NEXUS cost/ownership tags). */}}
{{- define "nexus-common.labels" -}}
app.kubernetes.io/name: {{ include "nexus-common.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: nexus
helm.sh/chart: {{ printf "%s-%s" .Chart.Name (.Chart.Version | replace "+" "_") }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
nexus.io/pool: {{ .Values.pool | default "platform" }}
{{- with .Values.extraLabels }}
{{ toYaml . }}
{{- end }}
{{- end -}}

{{- define "nexus-common.selectorLabels" -}}
app.kubernetes.io/name: {{ include "nexus-common.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "nexus-common.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- include "nexus-common.fullname" . -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/*
Fail-closed resources block. docs/10 §6: requests+limits are a MUST
(Kyverno rejects a pod without them), so render errors if any is empty.
*/}}
{{- define "nexus-common.resources" -}}
{{- $r := .Values.resources -}}
{{- if or (not $r) (not $r.requests) (not $r.limits) -}}
{{- fail "resources.requests and resources.limits are REQUIRED (docs/10 §6, Kyverno admission)" -}}
{{- end -}}
{{- if or (not $r.requests.cpu) (not $r.requests.memory) (not $r.limits.cpu) (not $r.limits.memory) -}}
{{- fail "resources.requests.{cpu,memory} and resources.limits.{cpu,memory} MUST all be set" -}}
{{- end -}}
requests:
  cpu: {{ $r.requests.cpu | quote }}
  memory: {{ $r.requests.memory | quote }}
limits:
  cpu: {{ $r.limits.cpu | quote }}
  memory: {{ $r.limits.memory | quote }}
{{- end -}}

{{/*
Node placement by blast-radius pool (ADR-0017 R-059).
discovery|money pools are dedicated node groups; a discovery surge must not
starve the money path. `platform` = shared platform pool.
*/}}
{{- define "nexus-common.poolNodeSelector" -}}
nexus.io/pool: {{ .Values.pool | default "platform" }}
{{- end -}}

{{- define "nexus-common.poolTolerations" -}}
{{- if eq (.Values.pool | default "platform") "money" -}}
- key: "nexus.io/pool"
  operator: "Equal"
  value: "money"
  effect: "NoSchedule"
{{- else if eq .Values.pool "discovery" -}}
- key: "nexus.io/pool"
  operator: "Equal"
  value: "discovery"
  effect: "NoSchedule"
{{- end -}}
{{- end -}}

{{/* OpenTelemetry env — OTLP export to the collector in the obs failure domain. */}}
{{- define "nexus-common.otelEnv" -}}
{{- if .Values.otel.enabled }}
- name: OTEL_SERVICE_NAME
  value: {{ include "nexus-common.name" . | quote }}
- name: OTEL_EXPORTER_OTLP_ENDPOINT
  value: {{ .Values.otel.endpoint | quote }}
- name: OTEL_EXPORTER_OTLP_PROTOCOL
  value: {{ .Values.otel.protocol | default "grpc" | quote }}
- name: OTEL_RESOURCE_ATTRIBUTES
  value: {{ printf "service.namespace=%s,service.name=%s,deployment.environment=%s,nexus.pool=%s" .Values.otel.serviceNamespace (include "nexus-common.name" .) (.Release.Namespace) (.Values.pool | default "platform") | quote }}
- name: OTEL_TRACES_SAMPLER
  value: "parentbased_traceidratio"
- name: OTEL_TRACES_SAMPLER_ARG
  value: {{ .Values.otel.samplerArg | default "0.1" | quote }}
- name: OTEL_METRICS_EXPORTER
  value: "otlp"
- name: OTEL_LOGS_EXPORTER
  value: "otlp"
{{- end }}
{{- end -}}
