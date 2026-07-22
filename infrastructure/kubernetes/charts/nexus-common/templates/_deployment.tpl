{{/*
nexus-common.deployment — hardened Deployment.
Usage in a service chart template:  {{- include "nexus-common.deployment" . -}}
Encodes: liveness /healthz + readiness /readyz + startup probe, required
resources, non-root/read-only/drop-ALL securityContext, OTel env + operator
inject annotation, topology spread, pool node placement.
*/}}
{{- define "nexus-common.deployment" -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "nexus-common.fullname" . }}
  labels:
    {{- include "nexus-common.labels" . | nindent 4 }}
  {{- with .Values.extraAnnotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      {{- include "nexus-common.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "nexus-common.labels" . | nindent 8 }}
      annotations:
        {{- if not .Values.otel.enabled }}
        # Prometheus scrape-discovery fallback — emitted ONLY when the OTLP push path
        # is off. Emitting these while otel.enabled would double-count every metric
        # series (once via scrape, once via OTLP -> collector -> remote-write).
        prometheus.io/scrape: "true"
        prometheus.io/port: {{ .Values.service.metricsPort | quote }}
        prometheus.io/path: {{ .Values.serviceMonitor.path | default "/metrics" | quote }}
        {{- end }}
        {{- if and .Values.otel.enabled .Values.otel.operatorInject }}
        instrumentation.opentelemetry.io/inject-sdk: "true"
        {{- end }}
        {{- with .Values.extraAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
    spec:
      serviceAccountName: {{ include "nexus-common.serviceAccountName" . }}
      automountServiceAccountToken: {{ .Values.serviceAccount.automountServiceAccountToken | default false }}
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}
      nodeSelector:
        {{- include "nexus-common.poolNodeSelector" . | nindent 8 }}
      tolerations:
        {{- include "nexus-common.poolTolerations" . | nindent 8 }}
      {{- if .Values.topologySpread.enabled }}
      topologySpreadConstraints:
        - maxSkew: {{ .Values.topologySpread.maxSkew }}
          topologyKey: {{ .Values.topologySpread.topologyKey }}
          whenUnsatisfiable: {{ .Values.topologySpread.whenUnsatisfiable }}
          labelSelector:
            matchLabels:
              {{- include "nexus-common.selectorLabels" . | nindent 14 }}
      {{- end }}
      containers:
        - name: {{ include "nexus-common.name" . }}
          image: {{ include "nexus-common.image" . }}
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          securityContext:
            {{- toYaml .Values.containerSecurityContext | nindent 12 }}
          ports:
            - name: http
              containerPort: {{ .Values.service.port }}
              protocol: TCP
            - name: metrics
              containerPort: {{ .Values.service.metricsPort }}
              protocol: TCP
          {{- if .Values.probes.startup.enabled }}
          startupProbe:
            httpGet:
              path: {{ .Values.probes.startup.path }}
              port: http
            periodSeconds: {{ .Values.probes.startup.periodSeconds }}
            failureThreshold: {{ .Values.probes.startup.failureThreshold }}
          {{- end }}
          livenessProbe:
            httpGet:
              path: {{ .Values.probes.liveness.path }}
              port: http
            initialDelaySeconds: {{ .Values.probes.liveness.initialDelaySeconds }}
            periodSeconds: {{ .Values.probes.liveness.periodSeconds }}
            timeoutSeconds: {{ .Values.probes.liveness.timeoutSeconds }}
            failureThreshold: {{ .Values.probes.liveness.failureThreshold }}
          readinessProbe:
            httpGet:
              path: {{ .Values.probes.readiness.path }}
              port: http
            initialDelaySeconds: {{ .Values.probes.readiness.initialDelaySeconds }}
            periodSeconds: {{ .Values.probes.readiness.periodSeconds }}
            timeoutSeconds: {{ .Values.probes.readiness.timeoutSeconds }}
            failureThreshold: {{ .Values.probes.readiness.failureThreshold }}
          resources:
            {{- include "nexus-common.resources" . | nindent 12 }}
          env:
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: POD_NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
            - name: HTTP_PORT
              value: {{ .Values.service.port | quote }}
            - name: METRICS_PORT
              value: {{ .Values.service.metricsPort | quote }}
            {{- include "nexus-common.otelEnv" . | nindent 12 }}
            {{- with .Values.env }}
            {{- toYaml . | nindent 12 }}
            {{- end }}
          volumeMounts:
            {{- if .Values.tmpDir.enabled }}
            - name: tmp
              mountPath: /tmp
            {{- end }}
      volumes:
        {{- if .Values.tmpDir.enabled }}
        - name: tmp
          emptyDir:
            sizeLimit: {{ .Values.tmpDir.sizeLimit }}
        {{- end }}
{{- end -}}
