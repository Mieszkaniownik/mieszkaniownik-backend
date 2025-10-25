#!/bin/bash

set -e

ENVIRONMENT=${1:-production}
VERSION=${2:-latest}
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Deploying backend to $ENVIRONMENT environment..."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ "$ENVIRONMENT" == "production" ]; then
    CLUSTER_NAME="mieszkaniownik-backend-cluster"
    CLUSTER_ZONE="europe-west3-a"
    NAMESPACE="production"
    VALUES_FILE="values-prod.yaml"
else
    CLUSTER_NAME="mieszkaniownik-backend-cluster"
    CLUSTER_ZONE="europe-west3-a"
    NAMESPACE="development"
    VALUES_FILE="values-dev.yaml"
fi

echo -e "${YELLOW}Connecting to GKE cluster: $CLUSTER_NAME${NC}"
gcloud container clusters get-credentials $CLUSTER_NAME --zone $CLUSTER_ZONE

if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Failed to connect to cluster${NC}"
    exit 1
fi

echo -e "${GREEN}Connected to cluster${NC}"

echo -e "${YELLOW}Checking required secrets...${NC}"
REQUIRED_SECRETS=("postgresql-credentials" "redis-credentials" "app-secrets")
for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! kubectl get secret $secret -n $NAMESPACE &> /dev/null; then
        echo -e "${RED}Secret '$secret' not found in namespace '$NAMESPACE'${NC}"
        echo -e "${YELLOW}Please create secrets before deploying. See docs/DEPLOYMENT.md${NC}"
        exit 1
    fi
done
echo -e "${GREEN}All required secrets found${NC}"

echo -e "${YELLOW}Running database migrations...${NC}"
kubectl run prisma-migrate-$RANDOM \
    --rm -i \
    --restart=Never \
    --namespace=$NAMESPACE \
    --image=europe-west3-docker.pkg.dev/mieszkaniownik/mieszkaniownik-backend-repo/mieszkaniownik-backend:$VERSION \
    --env="DATABASE_URL=\$(cat /etc/secrets/DATABASE_URL)" \
    --command -- npx prisma migrate deploy || echo -e "${YELLOW}⚠ Migration job already running or failed${NC}"

echo -e "${YELLOW}Deploying with Helm...${NC}"
cd "$PROJECT_DIR"

helm upgrade --install mieszkaniownik-backend ./helm-chart-backend \
    --namespace $NAMESPACE \
    --create-namespace \
    --values ./helm-chart-backend/values.yaml \
    --values ./helm-chart-backend/$VALUES_FILE \
    --set image.tag=$VERSION \
    --wait \
    --timeout 10m

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Deployment successful!${NC}"
else
    echo -e "${RED}Deployment failed!${NC}"
    exit 1
fi

echo -e "${YELLOW}Verifying deployment...${NC}"
kubectl rollout status deployment/mieszkaniownik-backend -n $NAMESPACE --timeout=5m

echo ""
echo -e "${GREEN}=== Deployment Information ===${NC}"
kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=mieszkaniownik-backend
echo ""
kubectl get services -n $NAMESPACE
echo ""
kubectl get ingress -n $NAMESPACE

INGRESS_IP=$(kubectl get ingress -n $NAMESPACE -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}' 2>/dev/null)
if [ ! -z "$INGRESS_IP" ]; then
    echo ""
    echo -e "${GREEN}Backend API is available at: https://$INGRESS_IP${NC}"
    if [ "$ENVIRONMENT" == "production" ]; then
        echo -e "${GREEN}Production URL: https://api.mieszkaniownik.wsparcie.dev${NC}"
        echo -e "${GREEN}API Docs: https://api.mieszkaniownik.wsparcie.dev/api${NC}"
    fi
fi

echo ""
echo -e "${YELLOW}Checking scheduled jobs...${NC}"
kubectl get cronjobs -n $NAMESPACE 2>/dev/null || echo "No CronJobs configured"

echo ""
echo -e "${GREEN}Deployment completed successfully!${NC}"
