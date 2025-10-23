#!/bin/bash
set -e

ENVIRONMENT=${1:-production}
REVISION=${2:-0}
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Rolling back backend deployment in $ENVIRONMENT environment..."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ "$ENVIRONMENT" == "production" ]; then
    CLUSTER_NAME="mieszkaniownik-backend-cluster"
    CLUSTER_ZONE="europe-west3-a"
    NAMESPACE="production"
else
    CLUSTER_NAME="mieszkaniownik-backend-cluster"
    CLUSTER_ZONE="europe-west3-a"
    NAMESPACE="development"
fi

echo -e "${YELLOW}Connecting to GKE cluster: $CLUSTER_NAME${NC}"
gcloud container clusters get-credentials $CLUSTER_NAME --zone $CLUSTER_ZONE

echo -e "${YELLOW}Current deployment history:${NC}"
kubectl rollout history deployment/mieszkaniownik-backend -n $NAMESPACE

echo ""
read -p "Are you sure you want to rollback? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Rollback cancelled${NC}"
    exit 0
fi

if [ "$REVISION" == "0" ]; then
    echo -e "${YELLOW}Rolling back to previous revision...${NC}"
    kubectl rollout undo deployment/mieszkaniownik-backend -n $NAMESPACE
else
    echo -e "${YELLOW}Rolling back to revision $REVISION...${NC}"
    kubectl rollout undo deployment/mieszkaniownik-backend -n $NAMESPACE --to-revision=$REVISION
fi

echo -e "${YELLOW}Waiting for rollback to complete...${NC}"
kubectl rollout status deployment/mieszkaniownik-backend -n $NAMESPACE --timeout=5m

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Rollback successful!${NC}"
else
    echo -e "${RED}Rollback failed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Current Deployment Status ===${NC}"
kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=mieszkaniownik-backend

echo ""
echo -e "${YELLOW}Running quick health check...${NC}"
sleep 10

POD_NAME=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=mieszkaniownik-backend -o jsonpath='{.items[0].metadata.name}')
if [ ! -z "$POD_NAME" ]; then
    HEALTH_CHECK=$(kubectl exec -n $NAMESPACE $POD_NAME -- curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
    if [ "$HEALTH_CHECK" == "200" ]; then
        echo -e "${GREEN}Health check passed after rollback${NC}"
    else
        echo -e "${RED}Health check failed after rollback (HTTP $HEALTH_CHECK)${NC}"
        echo -e "${RED}Please investigate immediately!${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}Rollback completed successfully!${NC}"
echo -e "${YELLOW}Recommendation: Monitor the application closely for the next few minutes${NC}"
