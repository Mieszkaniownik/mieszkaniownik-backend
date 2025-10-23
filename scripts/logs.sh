#!/bin/bash

ENVIRONMENT=${1:-production}
POD_NAME=$2
NAMESPACE=$ENVIRONMENT

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ "$ENVIRONMENT" == "production" ]; then
    CLUSTER_NAME="mieszkaniownik-backend-cluster"
    CLUSTER_ZONE="europe-west3-a"
else
    CLUSTER_NAME="mieszkaniownik-backend-cluster"
    CLUSTER_ZONE="europe-west3-a"
fi

gcloud container clusters get-credentials $CLUSTER_NAME --zone $CLUSTER_ZONE > /dev/null 2>&1

echo -e "${YELLOW}Fetching logs for $ENVIRONMENT environment...${NC}"
echo ""

if [ -z "$POD_NAME" ]; then
    echo -e "${YELLOW}Available pods:${NC}"
    kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=mieszkaniownik-backend
    echo ""
    
    POD_NAME=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=mieszkaniownik-backend -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$POD_NAME" ]; then
        echo -e "${RED}No pods found${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Using pod: $POD_NAME${NC}"
    echo ""
fi

echo -e "${YELLOW}Select log option:${NC}"
echo "1) Tail logs (follow)"
echo "2) Last 100 lines"
echo "3) Last 500 lines"
echo "4) All logs"
echo "5) Search for errors"
echo "6) Search for warnings"
echo "7) Show logs from all pods"
echo "8) Export logs to file"
echo ""
read -p "Enter choice [1-8]: " choice

case $choice in
    1)
        echo -e "${GREEN}Following logs from $POD_NAME...${NC}"
        kubectl logs -f -n $NAMESPACE $POD_NAME
        ;;
    2)
        kubectl logs -n $NAMESPACE $POD_NAME --tail=100
        ;;
    3)
        kubectl logs -n $NAMESPACE $POD_NAME --tail=500
        ;;
    4)
        kubectl logs -n $NAMESPACE $POD_NAME
        ;;
    5)
        echo -e "${RED}Errors in logs:${NC}"
        kubectl logs -n $NAMESPACE $POD_NAME --tail=500 | grep -i error
        ;;
    6)
        echo -e "${YELLOW}Warnings in logs:${NC}"
        kubectl logs -n $NAMESPACE $POD_NAME --tail=500 | grep -i warn
        ;;
    7)
        echo -e "${GREEN}Logs from all pods:${NC}"
        kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=mieszkaniownik-backend --tail=100
        ;;
    8)
        FILENAME="backend-logs-${ENVIRONMENT}-$(date +%Y%m%d_%H%M%S).log"
        echo -e "${YELLOW}Exporting logs to $FILENAME...${NC}"
        kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=mieszkaniownik-backend > $FILENAME
        echo -e "${GREEN}Logs exported to $FILENAME${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac
