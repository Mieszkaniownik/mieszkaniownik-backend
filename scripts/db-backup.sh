#!/bin/bash

set -e

ENVIRONMENT=${1:-production}
BACKUP_DIR="/tmp/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "Starting database backup for $ENVIRONMENT environment..."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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

mkdir -p $BACKUP_DIR

echo -e "${YELLOW}Backing up Cloud SQL instance: $INSTANCE_NAME${NC}"

gcloud sql export sql $INSTANCE_NAME \
    ${BUCKET}/${ENVIRONMENT}_backup_${TIMESTAMP}.sql.gz \
    --database=mieszkaniownik \
    --offload

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Database backup successful!${NC}"
    echo -e "${GREEN}Backup location: ${BUCKET}/${ENVIRONMENT}_backup_${TIMESTAMP}.sql.gz${NC}"
else
    echo -e "${RED}Database backup failed!${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Creating additional backup via pg_dump...${NC}"

DATABASE_URL=$(kubectl get secret postgresql-credentials -n $NAMESPACE -o jsonpath='{.data.DATABASE_URL}' | base64 -d)

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: db-backup-$TIMESTAMP
  namespace: $NAMESPACE
spec:
  containers:
  - name: postgres-client
    image: postgres:15
    command:
    - /bin/sh
    - -c
    - |
      pg_dump "\$DATABASE_URL" -Fc > /backup/mieszkaniownik_${TIMESTAMP}.dump
      echo "Backup completed"
      sleep infinity
    env:
    - name: DATABASE_URL
      value: "$DATABASE_URL"
    volumeMounts:
    - name: backup-volume
      mountPath: /backup
  volumes:
  - name: backup-volume
    emptyDir: {}
  restartPolicy: Never
EOF

echo -e "${YELLOW}Waiting for backup pod to start...${NC}"
kubectl wait --for=condition=ready pod/db-backup-$TIMESTAMP -n $NAMESPACE --timeout=60s

echo -e "${YELLOW}Copying backup from pod...${NC}"
kubectl cp $NAMESPACE/db-backup-$TIMESTAMP:/backup/mieszkaniownik_${TIMESTAMP}.dump ${BACKUP_DIR}/mieszkaniownik_${TIMESTAMP}.dump

echo -e "${YELLOW}Uploading backup to Cloud Storage...${NC}"
gsutil cp ${BACKUP_DIR}/mieszkaniownik_${TIMESTAMP}.dump ${BUCKET}/local_backups/

kubectl delete pod db-backup-$TIMESTAMP -n $NAMESPACE
rm -f ${BACKUP_DIR}/mieszkaniownik_${TIMESTAMP}.dump

echo ""
echo -e "${GREEN}All backups completed successfully!${NC}"
echo ""
echo -e "${YELLOW}Backup locations:${NC}"
echo "1. Cloud SQL export: ${BUCKET}/${ENVIRONMENT}_backup_${TIMESTAMP}.sql.gz"
echo "2. pg_dump backup: ${BUCKET}/local_backups/mieszkaniownik_${TIMESTAMP}.dump"

echo ""
echo -e "${YELLOW}Recent backups:${NC}"
gsutil ls -lh ${BUCKET}/ | tail -n 10

echo ""
echo -e "${YELLOW}Cleaning up old backups (older than 30 days)...${NC}"
CUTOFF_DATE=$(date -d '30 days ago' +%Y%m%d)
gsutil ls ${BUCKET}/ | while read file; do
    FILE_DATE=$(echo $file | grep -oP '\d{8}' | head -1)
    if [ ! -z "$FILE_DATE" ] && [ "$FILE_DATE" -lt "$CUTOFF_DATE" ]; then
        echo "Deleting old backup: $file"
        gsutil rm $file
    fi
done

echo -e "${GREEN}Backup process completed!${NC}"
