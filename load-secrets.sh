#!/bin/bash
set -e

echo "Loading secrets from Google Secret Manager and updating deployment..."

NAMESPACE="production"
DEPLOYMENT="mieszkaniownik-backend"

get_secret() {
    local secret_name=$1
    gcloud secrets versions access latest --secret="$secret_name" 2>/dev/null || echo ""
}

echo "Fetching all production secrets..."

JWT_SECRET=$(get_secret "jwt-secret-prod")
GOOGLE_CLIENT_ID=$(get_secret "google-client-id-prod")
GOOGLE_CLIENT_SECRET=$(get_secret "google-client-secret-prod")
GOOGLE_AI_API_KEY=$(get_secret "google-ai-api-key-prod")
GOOGLE_MAPS_API_KEY=$(get_secret "google-maps-api-key-backend-prod")

EMAIL_OAUTH_USER=$(get_secret "email-oauth-user-prod")
EMAIL_OAUTH_CLIENT_ID=$(get_secret "email-oauth-client-id-prod")
EMAIL_OAUTH_CLIENT_SECRET=$(get_secret "email-oauth-client-secret-prod")
EMAIL_OAUTH_REFRESH_TOKEN=$(get_secret "email-oauth-refresh-token-prod")

DISCORD_CLIENT_ID=$(get_secret "discord-client-id-prod")
DISCORD_CLIENT_SECRET=$(get_secret "discord-client-secret-prod")
DISCORD_CALLBACK_URL=$(get_secret "discord-callback-url-prod")

echo "Updating deployment with secrets..."

kubectl set env deployment/$DEPLOYMENT -n $NAMESPACE \
  JWT_SECRET="$JWT_SECRET" \
  GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
  GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET" \
  GOOGLE_AI_API_KEY="$GOOGLE_AI_API_KEY" \
  GOOGLE_MAPS_API_KEY="$GOOGLE_MAPS_API_KEY" \
  EMAIL_OAUTH_USER="$EMAIL_OAUTH_USER" \
  EMAIL_OAUTH_CLIENT_ID="$EMAIL_OAUTH_CLIENT_ID" \
  EMAIL_OAUTH_CLIENT_SECRET="$EMAIL_OAUTH_CLIENT_SECRET" \
  EMAIL_OAUTH_REFRESH_TOKEN="$EMAIL_OAUTH_REFRESH_TOKEN" \
  DISCORD_CLIENT_ID="$DISCORD_CLIENT_ID" \
  DISCORD_CLIENT_SECRET="$DISCORD_CLIENT_SECRET" \
  DISCORD_CALLBACK_URL="$DISCORD_CALLBACK_URL" \
  EMAIL_OAUTH_TYPE="OAuth2" \
  NOTIFICATIONS_ENABLED="true" \
  EMAIL_SERVICE_ENABLED="true"

echo "Secrets loaded successfully!"
echo "Waiting for rollout to complete..."

kubectl rollout status deployment/$DEPLOYMENT -n $NAMESPACE --timeout=5m

echo "Deployment updated with all secrets!"
