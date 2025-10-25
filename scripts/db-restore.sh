#!/bin/bash

set -e

ENVIRONMENT=${1:-production}
BACKUP_FILE=$2

echo "WARNING: This will restore the database and overwrite existing data!"
echo "Environment: $ENVIRONMENT"
echo "Backup file: $BACKUP_FILE"
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

read -p "Are you absolutely sure you want to proceed? (type 'yes' to confirm): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Restore cancelled${NC}"
    exit 0
fi

PROJECT_ID=$(gcloud config get-value project)
if [ "$ENVIRONMENT" == "production" ]; then
    INSTANCE_NAME="mieszkaniownik-backend-postgres-production"
    BUCKET="gs://${PROJECT_ID}-mieszkaniownik-backend-backups"
    NAMESPACE="production"
else
    INSTANCE_NAME="mieszkaniownik-backend-postgres-development"
    BUCKET="gs://${PROJECT_ID}-mieszkaniownik-backend-backups"
    NAMESPACE="development"
fi

if [ -z "$BACKUP_FILE" ]; then
    echo -e "${YELLOW}Available backups:${NC}"
    gsutil ls -lh ${BUCKET}/
    echo ""
    read -p "Enter the backup file path (e.g., ${BUCKET}/production_backup_20250121_120000.sql.gz): " BACKUP_FILE
fi

if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}No backup file specified${NC}"
    exit 1
fi

if ! gsutil ls $BACKUP_FILE &> /dev/null; then
    echo -e "${RED}Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo ""
echo -e "${RED}FINAL WARNING: This will OVERWRITE the $ENVIRONMENT database!${NC}"
read -p "Type 'RESTORE' in capital letters to proceed: " final_confirm
if [ "$final_confirm" != "RESTORE" ]; then
    echo -e "${YELLOW}Restore cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}Scaling down application pods...${NC}"
kubectl scale deployment/mieszkaniownik-backend -n $NAMESPACE --replicas=0

kubectl wait --for=delete pod -l app.kubernetes.io/name=mieszkaniownik-backend -n $NAMESPACE --timeout=60s || true

echo ""
echo -e "${YELLOW}Restoring database from: $BACKUP_FILE${NC}"

gcloud sql import sql $INSTANCE_NAME \
    $BACKUP_FILE \
    --database=mieszkaniownik

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Database restore successful!${NC}"
else
    echo -e "${RED}Database restore failed!${NC}"
    echo -e "${YELLOW}Scaling application back up...${NC}"
    kubectl scale deployment/mieszkaniownik-backend -n $NAMESPACE --replicas=3
    exit 1
fi

echo ""
echo -e "${YELLOW}Running database migrations...${NC}"
kubectl run prisma-migrate-restore \
    --rm -i \
    --restart=Never \
    --namespace=$NAMESPACE \
    --image=europe-west3-docker.pkg.dev/mieszkaniownik/mieszkaniownik-backend-repo/mieszkaniownik-backend:latest \
    --env="DATABASE_URL=$(kubectl get secret postgresql-credentials -n $NAMESPACE -o jsonpath='{.data.DATABASE_URL}' | base64 -d)" \
    --command -- npx prisma migrate deploy

echo ""
echo -e "${YELLOW}Scaling application back up...${NC}"
kubectl scale deployment/mieszkaniownik-backend -n $NAMESPACE --replicas=3

kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=mieszkaniownik-backend -n $NAMESPACE --timeout=300s

echo ""
echo -e "${YELLOW}Verifying application health...${NC}"
sleep 10

POD_NAME=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=mieszkaniownik-backend -o jsonpath='{.items[0].metadata.name}')
HEALTH_CHECK=$(kubectl exec -n $NAMESPACE $POD_NAME -- curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")

if [ "$HEALTH_CHECK" == "200" ]; then
    echo -e "${GREEN}Application is healthy after restore${NC}"
else
    echo -e "${RED}Application health check failed (HTTP $HEALTH_CHECK)${NC}"
    echo -e "${RED}Please investigate immediately!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}Database restore completed successfully!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Restored from: $BACKUP_FILE${NC}"
echo -e "${YELLOW}Application is running with restored data${NC}"
echo ""
echo -e "${YELLOW}Recommendation: Monitor the application closely and verify data integrity${NC}"
