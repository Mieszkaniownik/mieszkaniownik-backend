#!/bin/bash

set -e

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Setting up GKE cluster for backend in $ENVIRONMENT environment..."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ "$ENVIRONMENT" == "production" ]; then
    CLUSTER_NAME="mieszkaniownik-backend-cluster"
    CLUSTER_ZONE="europe-west3-a"
    NAMESPACE="production"
    DOMAIN="api.mieszkaniownik.wsparcie.dev"
else
    CLUSTER_NAME="mieszkaniownik-backend-cluster"
    CLUSTER_ZONE="europe-west3-a"
    NAMESPACE="development"
    DOMAIN="api-dev.mieszkaniownik.wsparcie.dev"
fi

echo -e "${YELLOW}Connecting to GKE cluster: $CLUSTER_NAME${NC}"
gcloud container clusters get-credentials $CLUSTER_NAME --zone $CLUSTER_ZONE

echo -e "${YELLOW}Creating namespace: $NAMESPACE${NC}"
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

echo -e "${YELLOW}Configuring Workload Identity...${NC}"
PROJECT_ID=$(gcloud config get-value project)
gcloud iam service-accounts list --filter="email:mieszkaniownik-backend@${PROJECT_ID}.iam.gserviceaccount.com" --format="value(email)" > /dev/null 2>&1 || \
gcloud iam service-accounts create mieszkaniownik-backend \
    --display-name="Mieszkaniownik Backend Service Account"

kubectl create serviceaccount mieszkaniownik-backend-sa -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

gcloud iam service-accounts add-iam-policy-binding \
    mieszkaniownik-backend@${PROJECT_ID}.iam.gserviceaccount.com \
    --role roles/iam.workloadIdentityUser \
    --member "serviceAccount:${PROJECT_ID}.svc.id.goog[$NAMESPACE/mieszkaniownik-backend-sa]" || true

kubectl annotate serviceaccount mieszkaniownik-backend-sa \
    -n $NAMESPACE \
    iam.gke.io/gcp-service-account=mieszkaniownik-backend@${PROJECT_ID}.iam.gserviceaccount.com \
    --overwrite

echo -e "${YELLOW}Installing metrics-server...${NC}"
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml 2>/dev/null || echo "Metrics server already installed"

echo -e "${YELLOW}Creating image pull secret...${NC}"
if gcloud auth print-access-token > /dev/null 2>&1; then
    kubectl create secret docker-registry artifact-registry-secret \
        --docker-server=europe-west3-docker.pkg.dev \
        --docker-username=oauth2accesstoken \
        --docker-password="$(gcloud auth print-access-token)" \
        --docker-email=mieszkaniownik@gmail.com \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    echo -e "${GREEN}Image pull secret created${NC}"
fi

echo -e "${YELLOW}Creating ConfigMap...${NC}"
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: backend-config
  namespace: $NAMESPACE
data:
  NODE_ENV: "$ENVIRONMENT"
  PORT: "3000"
  API_PREFIX: "api"
  API_VERSION: "v1"
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"
  ENABLE_SWAGGER: "true"
  SCRAPER_ENABLED: "true"
  SCRAPER_INTERVAL_HOURS: "6"
  NOTIFICATIONS_ENABLED: "true"
EOF

echo -e "${GREEN}ConfigMap created${NC}"

echo ""
echo -e "${YELLOW}Checking for required secrets...${NC}"

SECRETS_TO_CREATE=()

if ! kubectl get secret postgresql-credentials -n $NAMESPACE &> /dev/null; then
    SECRETS_TO_CREATE+=("postgresql-credentials")
fi

if ! kubectl get secret redis-credentials -n $NAMESPACE &> /dev/null; then
    SECRETS_TO_CREATE+=("redis-credentials")
fi

if ! kubectl get secret app-secrets -n $NAMESPACE &> /dev/null; then
    SECRETS_TO_CREATE+=("app-secrets")
fi

if [ ${#SECRETS_TO_CREATE[@]} -gt 0 ]; then
    echo -e "${RED}The following secrets need to be created:${NC}"
    for secret in "${SECRETS_TO_CREATE[@]}"; do
        echo "  - $secret"
    done
    echo ""
    echo -e "${YELLOW}Creating placeholder secrets (you must update these with real values!)${NC}"
    
    if [[ " ${SECRETS_TO_CREATE[@]} " =~ " postgresql-credentials " ]]; then
        kubectl create secret generic postgresql-credentials \
            --from-literal=DATABASE_URL="postgresql://user:REPLACE_ME@localhost:5432/mieszkaniownik" \
            -n $NAMESPACE
        echo -e "${YELLOW}Created postgresql-credentials (NEEDS UPDATE!)${NC}"
    fi
    
    if [[ " ${SECRETS_TO_CREATE[@]} " =~ " redis-credentials " ]]; then
        kubectl create secret generic redis-credentials \
            --from-literal=REDIS_HOST="localhost" \
            --from-literal=REDIS_PORT="6379" \
            --from-literal=REDIS_PASSWORD="" \
            -n $NAMESPACE
        echo -e "${YELLOW}Created redis-credentials (NEEDS UPDATE!)${NC}"
    fi
    
    if [[ " ${SECRETS_TO_CREATE[@]} " =~ " app-secrets " ]]; then
        JWT_SECRET=$(openssl rand -base64 32)
        kubectl create secret generic app-secrets \
            --from-literal=JWT_SECRET="$JWT_SECRET" \
            --from-literal=GOOGLE_CLIENT_ID="REPLACE_ME.apps.googleusercontent.com" \
            --from-literal=GOOGLE_CLIENT_SECRET="REPLACE_ME" \
            --from-literal=GOOGLE_CALLBACK_URL="https://${DOMAIN}/api/v1/auth/google/callback" \
            -n $NAMESPACE
        echo -e "${YELLOW}Created app-secrets with generated JWT (NEEDS UPDATE for Google OAuth!)${NC}"
    fi
    
    echo ""
    echo -e "${RED}IMPORTANT: Update the placeholder secrets with real values!${NC}"
    echo -e "${YELLOW}See docs/DEPLOYMENT.md for detailed instructions${NC}"
else
    echo -e "${GREEN}All required secrets exist${NC}"
fi

echo ""
echo -e "${YELLOW}Setting up CronJobs...${NC}"
cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: CronJob
metadata:
  name: scraper-full-sync
  namespace: $NAMESPACE
spec:
  schedule: "0 2 * * *"  # Run at 2 AM daily
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: mieszkaniownik-backend-sa
          containers:
          - name: scraper
            image: europe-west3-docker.pkg.dev/mieszkaniownik/mieszkaniownik-backend-repo/mieszkaniownik-backend:latest
            command:
            - /bin/sh
            - -c
            - |
              echo "Starting full synchronization..."
              npm run scraper:sync
              echo "Full synchronization completed at \$(date)"
            envFrom:
            - configMapRef:
                name: backend-config
            - secretRef:
                name: postgresql-credentials
            - secretRef:
                name: redis-credentials
            - secretRef:
                name: app-secrets
          restartPolicy: OnFailure
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cleanup-old-offers
  namespace: $NAMESPACE
spec:
  schedule: "0 4 * * 0"  # Run at 4 AM every Sunday
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: mieszkaniownik-backend-sa
          containers:
          - name: cleanup
            image: europe-west3-docker.pkg.dev/mieszkaniownik/mieszkaniownik-backend-repo/mieszkaniownik-backend:latest
            command:
            - /bin/sh
            - -c
            - |
              echo "Starting cleanup of old offers..."
              npm run database:cleanup
              echo "Cleanup completed at \$(date)"
            envFrom:
            - configMapRef:
                name: backend-config
            - secretRef:
                name: postgresql-credentials
          restartPolicy: OnFailure
EOF

echo -e "${GREEN}CronJobs created${NC}"

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}GKE cluster setup completed!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Cluster Information:${NC}"
echo "- Cluster: $CLUSTER_NAME"
echo "- Zone: $CLUSTER_ZONE"
echo "- Namespace: $NAMESPACE"
echo "- Domain: $DOMAIN"
echo ""

INGRESS_IP=$(kubectl get ingress -n $NAMESPACE -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "Not yet assigned")
echo "- Ingress IP: $INGRESS_IP"

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update secrets with real values:"
echo "   kubectl edit secret postgresql-credentials -n $NAMESPACE"
echo "   kubectl edit secret app-secrets -n $NAMESPACE"
echo ""
echo "2. Configure DNS to point $DOMAIN to: $INGRESS_IP"
echo ""
echo "3. Deploy the application:"
echo "   cd $SCRIPT_DIR && ./deploy.sh $ENVIRONMENT"
echo ""
echo "4. Monitor deployment:"
echo "   kubectl get pods -n $NAMESPACE -w"
echo ""
echo "5. Check health:"
echo "   cd $SCRIPT_DIR && ./health-check.sh $ENVIRONMENT"
