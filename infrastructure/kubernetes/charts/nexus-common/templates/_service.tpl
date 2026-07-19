{{/* nexus-common.service — ClusterIP exposing http + metrics ports. */}}
{{- define "nexus-common.service" -}}
apiVersion: v1
kind: Service
metadata:
  name: {{ include "nexus-common.fullname" . }}
  labels:
    {{- include "nexus-common.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  selector:
    {{- include "nexus-common.selectorLabels" . | nindent 4 }}
  ports:
    - name: http
      port: {{ .Values.service.port }}
      targetPort: http
      protocol: TCP
      appProtocol: {{ .Values.service.appProtocol | default "http" }}
    - name: metrics
      port: {{ .Values.service.metricsPort }}
      targetPort: metrics
      protocol: TCP
{{- end -}}
