#!/bin/bash

set -e

PROJECT_ID=$1

if [ -z "$PROJECT_ID" ]; then
    echo "Usage: ./build-helm-image.sh <PROJECT_ID>"
    echo "Example: ./build-helm-image.sh my-gcp-project"
    exit 1
fi

echo "Building Helm builder image for project: $PROJECT_ID"

docker build -f cloudbuild-helm.Dockerfile -t gcr.io/$PROJECT_ID/helm .

docker push gcr.io/$PROJECT_ID/helm

echo "Helm builder image pushed successfully!"
echo "Use in cloudbuild.yaml: gcr.io/$PROJECT_ID/helm"
