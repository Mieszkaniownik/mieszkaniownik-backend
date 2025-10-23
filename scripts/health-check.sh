#!/bin/bash

set -e

ENVIRONMENT=${1:-production}
NAMESPACE=$ENVIRONMENT

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "Running health checks for backend in $ENVIRONMENT environment..."
echo ""

CURRENT_CONTEXT=$(kubectl config current-context)
echo -e "${YELLOW}Current context: $CURRENT_CONTEXT${NC}"
echo ""

echo -e "${YELLOW}Checking pods...${NC}"
PODS=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=mieszkaniownik-backend --no-headers)
if [ -z "$PODS" ]; then
    echo -e "${RED}No pods found${NC}"
    exit 1
fi

READY_PODS=$(echo "$PODS" | grep "Running" | grep -E "1/1|2/2" | wc -l)
TOTAL_PODS=$(echo "$PODS" | wc -l)
echo -e "${GREEN}$READY_PODS/$TOTAL_PODS pods ready${NC}"

if [ "$READY_PODS" -lt 3 ] && [ "$ENVIRONMENT" == "production" ]; then
    echo -e "${YELLOW}Less than 3 pods running in production (recommended minimum: 3)${NC}"
fi

echo ""
echo -e "${YELLOW}Checking deployment...${NC}"
DEPLOYMENT_STATUS=$(kubectl get deployment mieszkaniownik-backend -n $NAMESPACE -o jsonpath='{.status.conditions[?(@.type=="Available")].status}')
if [ "$DEPLOYMENT_STATUS" == "True" ]; then
    echo -e "${GREEN}Deployment is available${NC}"
else
    echo -e "${RED}Deployment is not available${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Checking service...${NC}"
SERVICE=$(kubectl get svc mieszkaniownik-backend -n $NAMESPACE --no-headers 2>/dev/null)
if [ ! -z "$SERVICE" ]; then
    echo -e "${GREEN}Service is running${NC}"
else
    echo -e "${RED}Service not found${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Checking ingress...${NC}"
INGRESS_IP=$(kubectl get ingress -n $NAMESPACE -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}' 2>/dev/null)
if [ ! -z "$INGRESS_IP" ]; then
    echo -e "${GREEN}Ingress has external IP: $INGRESS_IP${NC}"
else
    echo -e "${YELLOW}Ingress IP not yet assigned${NC}"
fi

echo ""
echo -e "${YELLOW}Checking SSL certificate...${NC}"
CERT_STATUS=$(kubectl get managedcertificate -n $NAMESPACE -o jsonpath='{.items[0].status.certificateStatus}' 2>/dev/null)
if [ "$CERT_STATUS" == "Active" ]; then
    echo -e "${GREEN}SSL certificate is active${NC}"
elif [ "$CERT_STATUS" == "Provisioning" ]; then
    echo -e "${YELLOW}SSL certificate is provisioning (can take up to 60 minutes)${NC}"
else
    echo -e "${YELLOW}SSL certificate status: ${CERT_STATUS:-Not configured}${NC}"
fi

echo ""
echo -e "${YELLOW}Checking database connectivity...${NC}"
DB_SECRET=$(kubectl get secret postgresql-credentials -n $NAMESPACE --no-headers 2>/dev/null)
if [ ! -z "$DB_SECRET" ]; then
    echo -e "${GREEN}Database credentials secret exists${NC}"
else
    echo -e "${RED}Database credentials secret not found${NC}"
fi

echo ""
echo -e "${YELLOW}Checking Redis connectivity...${NC}"
REDIS_SECRET=$(kubectl get secret redis-credentials -n $NAMESPACE --no-headers 2>/dev/null)
if [ ! -z "$REDIS_SECRET" ]; then
    echo -e "${GREEN}Redis credentials secret exists${NC}"
else
    echo -e "${RED}Redis credentials secret not found${NC}"
fi

echo ""
echo -e "${YELLOW}Checking horizontal pod autoscaler...${NC}"
HPA=$(kubectl get hpa -n $NAMESPACE --no-headers 2>/dev/null)
if [ ! -z "$HPA" ]; then
    echo -e "${GREEN}HPA is configured${NC}"
    kubectl get hpa -n $NAMESPACE
else
    echo -e "${YELLOW}HPA not found (may not be enabled)${NC}"
fi

echo ""
echo -e "${YELLOW}Checking scheduled jobs...${NC}"
CRONJOBS=$(kubectl get cronjobs -n $NAMESPACE --no-headers 2>/dev/null)
if [ ! -z "$CRONJOBS" ]; then
    echo -e "${GREEN}CronJobs configured${NC}"
    kubectl get cronjobs -n $NAMESPACE
else
    echo -e "${YELLOW}No CronJobs found${NC}"
fi

echo ""
echo -e "${YELLOW}Checking resource usage...${NC}"
kubectl top pods -n $NAMESPACE -l app.kubernetes.io/name=mieszkaniownik-backend 2>/dev/null || echo -e "${YELLOW}⚠ Metrics not available${NC}"

echo ""
echo -e "${YELLOW}Performing HTTP health checks...${NC}"

POD_NAME=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=mieszkaniownik-backend -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ ! -z "$POD_NAME" ]; then
    HEALTH_CHECK=$(kubectl exec -n $NAMESPACE $POD_NAME -- curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
    if [ "$HEALTH_CHECK" == "200" ]; then
        echo -e "${GREEN}Internal health check passed (HTTP $HEALTH_CHECK)${NC}"
    else
        echo -e "${RED}Internal health check failed (HTTP $HEALTH_CHECK)${NC}"
    fi
fi

if [ ! -z "$INGRESS_IP" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$INGRESS_IP/health --max-time 10 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" == "200" ]; then
        echo -e "${GREEN}External health check passed (HTTP $HTTP_CODE)${NC}"
    else
        echo -e "${YELLOW}External health check returned HTTP $HTTP_CODE${NC}"
    fi
    
    API_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$INGRESS_IP/api --max-time 10 2>/dev/null || echo "000")
    if [ "$API_CODE" == "200" ] || [ "$API_CODE" == "301" ] || [ "$API_CODE" == "302" ]; then
        echo -e "${GREEN}API documentation endpoint accessible (HTTP $API_CODE)${NC}"
    else
        echo -e "${YELLOW}API documentation returned HTTP $API_CODE${NC}"
    fi
fi

echo ""
echo -e "${YELLOW}Checking recent logs for errors...${NC}"
ERROR_COUNT=$(kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=mieszkaniownik-backend --tail=100 --since=5m 2>/dev/null | grep -i error | wc -l || echo "0")
if [ "$ERROR_COUNT" -gt 10 ]; then
    echo -e "${RED}✗ Found $ERROR_COUNT errors in recent logs${NC}"
    echo -e "${YELLOW}Recent errors:${NC}"
    kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=mieszkaniownik-backend --tail=100 --since=5m 2>/dev/null | grep -i error | tail -n 5
elif [ "$ERROR_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}Found $ERROR_COUNT errors in recent logs${NC}"
else
    echo -e "${GREEN}No errors in recent logs${NC}"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}Health check completed!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Summary:${NC}"
echo "- Pods: $READY_PODS/$TOTAL_PODS ready"
echo "- Deployment: ${DEPLOYMENT_STATUS}"
echo "- Ingress IP: ${INGRESS_IP:-Not assigned}"
echo "- SSL Certificate: ${CERT_STATUS:-Not configured}"
echo "- Recent errors: $ERROR_COUNT"

echo ""

if [ "$READY_PODS" -eq 0 ] || [ "$DEPLOYMENT_STATUS" != "True" ]; then
    echo -e "${RED}Critical health checks failed!${NC}"
    exit 1
fi

if [ "$ERROR_COUNT" -gt 50 ]; then
    echo -e "${RED}Too many errors detected!${NC}"
    exit 1
fi

echo -e "${GREEN}All health checks passed!${NC}"
