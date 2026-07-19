{{/*
nexus-common.serviceaccount — IRSA-ready ServiceAccount.
roleArn (when set) becomes the eks.amazonaws.com/role-arn annotation so the
pod assumes a scoped IAM role via OIDC — no static credentials (docs/10 §9,
docs/09 §11). Empty roleArn = no cloud identity (portability-friendly).
*/}}
{{- define "nexus-common.serviceaccount" -}}
{{- if .Values.serviceAccount.create -}}
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ include "nexus-common.serviceAccountName" . }}
  labels:
    {{- include "nexus-common.labels" . | nindent 4 }}
  annotations:
    {{- if .Values.serviceAccount.roleArn }}
    eks.amazonaws.com/role-arn: {{ .Values.serviceAccount.roleArn | quote }}
    {{- end }}
    {{- with .Values.serviceAccount.annotations }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
automountServiceAccountToken: {{ .Values.serviceAccount.automountServiceAccountToken | default false }}
{{- end -}}
{{- end -}}
