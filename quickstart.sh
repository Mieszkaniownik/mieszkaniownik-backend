set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    print_info "Checking prerequisites..."
    
    commands=("gcloud" "kubectl" "helm" "terraform" "docker")
    
    for cmd in "${commands[@]}"; do
        if ! command -v $cmd &> /dev/null; then
            print_error "$cmd is not installed. Please install it first."
            exit 1
        fi
    done
    
    print_info "All prerequisites are installed ✓"
}

setup_gcloud() {
    print_info "Setting up Google Cloud..."
    
    read -p "Enter your GCP Project ID: " PROJECT_ID
    gcloud config set project $PROJECT_ID
    
    print_info "Enabling required APIs..."
    gcloud services enable \
        container.googleapis.com \
        compute.googleapis.com \
        cloudbuild.googleapis.com \
        artifactregistry.googleapis.com \
        sqladmin.googleapis.com \
        redis.googleapis.com
    
    print_info "GCloud setup complete ✓"
}

deploy_infrastructure() {
    print_info "Deploying infrastructure with Terraform..."
    
    cd terraform
    
    if [ ! -f "terraform.tfvars" ]; then
        print_warning "terraform.tfvars not found. Creating from example..."
        cp terraform.tfvars.example terraform.tfvars
        print_warning "Please edit terraform/terraform.tfvars and run this script again."
        exit 1
    fi
    
    terraform init
    terraform plan -out=tfplan
    
    read -p "Do you want to apply this plan? (yes/no): " APPLY
    if [ "$APPLY" == "yes" ]; then
        terraform apply tfplan
        print_info "Infrastructure deployed ✓"
    else
        print_warning "Infrastructure deployment cancelled."
        exit 0
    fi
    
    cd ..
}

configure_kubectl() {
    print_info "Configuring kubectl..."
    
    read -p "Enter your cluster name (default: mieszkaniownik-backend-cluster): " CLUSTER_NAME
    CLUSTER_NAME=${CLUSTER_NAME:-mieszkaniownik-backend-cluster}
    
    read -p "Enter your region (default: europe-west3): " REGION
    REGION=${REGION:-europe-west3}
    
    gcloud container clusters get-credentials $CLUSTER_NAME --region $REGION
    
    print_info "kubectl configured ✓"
}

create_secrets() {
    print_info "Creating Kubernetes secrets..."
    
    read -p "Enter namespace (default: production): " NAMESPACE
    NAMESPACE=${NAMESPACE:-production}
    
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    print_warning "You need to create secrets manually. See docs/DEPLOYMENT.md for instructions."
    
    cat <<EOF

Please run the following commands with your actual values:

kubectl create secret generic postgresql-credentials \\
  --from-literal=postgres-password='YOUR_DB_PASSWORD' \\
  --from-literal=password='YOUR_DB_PASSWORD' \\
  -n $NAMESPACE

kubectl create secret generic app-secrets \\
  --from-literal=JWT_SECRET='YOUR_JWT_SECRET' \\
  --from-literal=GOOGLE_CLIENT_ID='YOUR_GOOGLE_CLIENT_ID' \\
  --from-literal=GOOGLE_CLIENT_SECRET='YOUR_GOOGLE_CLIENT_SECRET' \\
  --from-literal=DISCORD_WEBHOOK_URL='YOUR_DISCORD_WEBHOOK' \\
  --from-literal=EMAIL_USER='YOUR_EMAIL' \\
  --from-literal=EMAIL_PASS='YOUR_EMAIL_PASSWORD' \\
  -n $NAMESPACE

EOF
    
    read -p "Have you created the secrets? (yes/no): " SECRETS_CREATED
    if [ "$SECRETS_CREATED" != "yes" ]; then
        print_warning "Please create secrets and run this script again."
        exit 1
    fi
}

build_and_push_image() {
    print_info "Building and pushing Docker image..."
    
    read -p "Enter your GCP Project ID: " PROJECT_ID
    read -p "Enter image tag (default: v1.0.0): " IMAGE_TAG
    IMAGE_TAG=${IMAGE_TAG:-v1.0.0}
    
    REGION="europe-west3"
    IMAGE_URL="$REGION-docker.pkg.dev/$PROJECT_ID/mieszkaniownik-repo/mieszkaniownik-backend:$IMAGE_TAG"
    
    print_info "Authenticating Docker..."
    gcloud auth configure-docker $REGION-docker.pkg.dev
    
    print_info "Building image..."
    docker build -t $IMAGE_URL .
    
    print_info "Pushing image..."
    docker push $IMAGE_URL
    
    print_info "Image pushed: $IMAGE_URL ✓"
    
    echo $IMAGE_TAG > .last-deployed-tag
}

deploy_application() {
    print_info "Deploying application with Helm..."
    
    read -p "Enter namespace (default: production): " NAMESPACE
    NAMESPACE=${NAMESPACE:-production}
    
    read -p "Enter image tag (default: from .last-deployed-tag or v1.0.0): " IMAGE_TAG
    if [ -f ".last-deployed-tag" ]; then
        IMAGE_TAG=${IMAGE_TAG:-$(cat .last-deployed-tag)}
    else
        IMAGE_TAG=${IMAGE_TAG:-v1.0.0}
    fi
    
    read -p "Enter values file (default: values-prod.yaml): " VALUES_FILE
    VALUES_FILE=${VALUES_FILE:-values-prod.yaml}
    
    cd helm-chart-backend
    
    helm upgrade --install mieszkaniownik-backend . \
        --namespace $NAMESPACE \
        --create-namespace \
        --values $VALUES_FILE \
        --set backend.image.tag=$IMAGE_TAG \
        --wait \
        --timeout 10m
    
    cd ..
    
    print_info "Application deployed ✓"
}

verify_deployment() {
    print_info "Verifying deployment..."
    
    read -p "Enter namespace (default: production): " NAMESPACE
    NAMESPACE=${NAMESPACE:-production}
    
    echo ""
    print_info "Pods status:"
    kubectl get pods -n $NAMESPACE
    
    echo ""
    print_info "Services:"
    kubectl get svc -n $NAMESPACE
    
    echo ""
    print_info "Ingress:"
    kubectl get ingress -n $NAMESPACE
    
    echo ""
    print_info "HPA:"
    kubectl get hpa -n $NAMESPACE
    
    echo ""
    print_info "CronJobs:"
    kubectl get cronjobs -n $NAMESPACE
}

show_menu() {
    echo ""
    echo "======================================"
    echo "Mieszkaniownik Backend Deployment"
    echo "======================================"
    echo "1. Check prerequisites"
    echo "2. Setup GCloud"
    echo "3. Deploy infrastructure (Terraform)"
    echo "4. Configure kubectl"
    echo "5. Create secrets"
    echo "6. Build and push Docker image"
    echo "7. Deploy application (Helm)"
    echo "8. Verify deployment"
    echo "9. Full deployment (all steps)"
    echo "0. Exit"
    echo "======================================"
}

full_deployment() {
    print_info "Starting full deployment..."
    check_prerequisites
    setup_gcloud
    deploy_infrastructure
    configure_kubectl
    create_secrets
    build_and_push_image
    deploy_application
    verify_deployment
    print_info "Full deployment complete! ✓"
}

while true; do
    show_menu
    read -p "Select an option: " option
    
    case $option in
        1) check_prerequisites ;;
        2) setup_gcloud ;;
        3) deploy_infrastructure ;;
        4) configure_kubectl ;;
        5) create_secrets ;;
        6) build_and_push_image ;;
        7) deploy_application ;;
        8) verify_deployment ;;
        9) full_deployment ;;
        0) 
            print_info "Exiting..."
            exit 0
            ;;
        *) 
            print_error "Invalid option. Please try again."
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
done
