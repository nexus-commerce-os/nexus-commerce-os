{{/* nexus-common.pdb — PodDisruptionBudget for voluntary-disruption safety (docs/10 §6, NFR-AVAIL-01). */}}
{{- define "nexus-common.pdb" -}}
{{- if .Values.pdb.enabled -}}
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{ include "nexus-common.fullname" . }}
  labels:
    {{- include "nexus-common.labels" . | nindent 4 }}
spec:
  {{- if .Values.pdb.maxUnavailable }}
  maxUnavailable: {{ .Values.pdb.maxUnavailable }}
  {{- else }}
  minAvailable: {{ .Values.pdb.minAvailable | default 1 }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "nexus-common.selectorLabels" . | nindent 6 }}
{{- end -}}
{{- end -}}
