{{/*
nexus-common.servicemonitor — Prometheus Operator ServiceMonitor so the
Prometheus in the observability domain scrapes this service's /metrics
(docs/09 §11, docs/10 §7). Guarded so charts render without the CRD present.
*/}}
{{- define "nexus-common.servicemonitor" -}}
{{- if .Values.serviceMonitor.enabled -}}
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: {{ include "nexus-common.fullname" . }}
  labels:
    {{- include "nexus-common.labels" . | nindent 4 }}
    release: kube-prometheus-stack
spec:
  selector:
    matchLabels:
      {{- include "nexus-common.selectorLabels" . | nindent 6 }}
  namespaceSelector:
    matchNames:
      - {{ .Release.Namespace }}
  endpoints:
    - port: metrics
      path: {{ .Values.serviceMonitor.path | default "/metrics" }}
      interval: {{ .Values.serviceMonitor.interval | default "30s" }}
      scrapeTimeout: {{ .Values.serviceMonitor.scrapeTimeout | default "10s" }}
{{- end -}}
{{- end -}}
