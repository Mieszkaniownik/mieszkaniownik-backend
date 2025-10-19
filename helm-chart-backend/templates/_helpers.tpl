{{/*
Expand the name of the chart.
*/}}
{{- define "mieszkaniownik-backend.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "mieszkaniownik-backend.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "mieszkaniownik-backend.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "mieszkaniownik-backend.labels" -}}
helm.sh/chart: {{ include "mieszkaniownik-backend.chart" . }}
{{ include "mieszkaniownik-backend.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: backend
app.kubernetes.io/part-of: mieszkaniownik
{{- end }}

{{/*
Selector labels
*/}}
{{- define "mieszkaniownik-backend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "mieszkaniownik-backend.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "mieszkaniownik-backend.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "mieszkaniownik-backend.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
PostgreSQL connection string
*/}}
{{- define "mieszkaniownik-backend.databaseUrl" -}}
{{- if .Values.postgresql.enabled }}
{{- $host := printf "%s-postgresql" .Release.Name }}
{{- $port := .Values.postgresql.primary.service.ports.postgresql }}
{{- $database := .Values.secrets.postgresql.POSTGRES_DB }}
{{- $username := .Values.secrets.postgresql.POSTGRES_USER }}
{{- printf "postgresql://%s:$(POSTGRES_PASSWORD)@%s:%v/%s" $username $host $port $database }}
{{- else }}
{{- .Values.externalDatabase.url }}
{{- end }}
{{- end }}

{{/*
Redis connection string
*/}}
{{- define "mieszkaniownik-backend.redisUrl" -}}
{{- if .Values.redis.enabled }}
{{- $host := printf "%s-redis-master" .Release.Name }}
{{- $port := .Values.redis.master.service.ports.redis }}
{{- printf "redis://%s:%v" $host $port }}
{{- else }}
{{- .Values.externalRedis.url }}
{{- end }}
{{- end }}

{{/*
App config name
*/}}
{{- define "mieszkaniownik-backend.configName" -}}
{{- printf "%s-config" (include "mieszkaniownik-backend.fullname" .) }}
{{- end }}

{{/*
PostgreSQL secret name
*/}}
{{- define "mieszkaniownik-backend.postgresqlSecretName" -}}
{{- if .Values.secrets.postgresql.create }}
{{- .Values.secrets.postgresql.name }}
{{- else }}
{{- .Values.secrets.postgresql.existingSecret }}
{{- end }}
{{- end }}

{{/*
App secret name
*/}}
{{- define "mieszkaniownik-backend.appSecretName" -}}
{{- if .Values.secrets.app.create }}
{{- .Values.secrets.app.name }}
{{- else }}
{{- .Values.secrets.app.existingSecret }}
{{- end }}
{{- end }}