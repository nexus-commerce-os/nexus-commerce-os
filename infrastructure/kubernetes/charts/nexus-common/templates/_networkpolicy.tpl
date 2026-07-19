{{/*
nexus-common.networkpolicy — DEFAULT-DENY baseline (docs/10 §5 admission:
"NetworkPolicy present"). Denies all ingress+egress, then re-allows only:
  ingress  : same namespace (optional), named ingress namespaces, metrics scrape
  egress   : cluster DNS, the OTel collector (observability domain), extras
Anything not listed is denied — a service opens egress explicitly.
*/}}
{{- define "nexus-common.networkpolicy" -}}
{{- if .Values.networkPolicy.enabled -}}
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{ include "nexus-common.fullname" . }}
  labels:
    {{- include "nexus-common.labels" . | nindent 4 }}
spec:
  podSelector:
    matchLabels:
      {{- include "nexus-common.selectorLabels" . | nindent 6 }}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    {{- if .Values.networkPolicy.allowSameNamespace }}
    - from:
        - podSelector: {}
    {{- end }}
    {{- with .Values.networkPolicy.allowIngressFromNamespaces }}
    - from:
        {{- range . }}
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: {{ . }}
        {{- end }}
    {{- end }}
    # Prometheus scrape of /metrics from the observability domain.
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: observability
      ports:
        - port: metrics
          protocol: TCP
  egress:
    # Cluster DNS (kube-dns) — TCP+UDP 53.
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
    # OTel collector in the separate observability failure domain (ADR-0017 R-060).
    {{- if .Values.otel.enabled }}
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: observability
      ports:
        - port: 4317
          protocol: TCP
        - port: 4318
          protocol: TCP
    {{- end }}
    {{- with .Values.networkPolicy.extraEgress }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
{{- end -}}
{{- end -}}
