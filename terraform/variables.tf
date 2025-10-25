# Terraform variables

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "mieszkaniownik-backend"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "europe-west3"
}

variable "node_zones" {
  description = "Zones for GKE nodes"
  type        = list(string)
  default     = ["europe-west3-a", "europe-west3-b", "europe-west3-c"]
}

variable "environment" {
  description = "Environment (development/staging/production)"
  type        = string
  default     = "production"
}

variable "gke_subnet_cidr" {
  description = "CIDR for GKE subnet"
  type        = string
  default     = "10.0.0.0/20"
}

variable "gke_pods_cidr" {
  description = "CIDR for GKE pods"
  type        = string
  default     = "10.4.0.0/14"
}

variable "gke_services_cidr" {
  description = "CIDR for GKE services"
  type        = string
  default     = "10.8.0.0/20"
}

variable "gke_machine_type" {
  description = "Machine type for GKE nodes"
  type        = string
  default     = "e2-small"
}

variable "gke_node_count" {
  description = "Initial number of GKE nodes per zone"
  type        = number
  default     = 1
}

variable "gke_min_nodes" {
  description = "Minimum number of GKE nodes per zone"
  type        = number
  default     = 1
}

variable "gke_max_nodes" {
  description = "Maximum number of GKE nodes per zone"
  type        = number
  default     = 5
}

variable "db_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-f1-micro"
}

variable "db_disk_size" {
  description = "Database disk size in GB"
  type        = number
  default     = 10
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "mieszkaniownik"
}

variable "db_user" {
  description = "Database user"
  type        = string
  default     = "mieszkaniownik"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "redis_memory_gb" {
  description = "Redis memory size in GB"
  type        = number
  default     = 1
}

variable "github_owner" {
  description = "GitHub repository owner"
  type        = string
  default     = "Mieszkaniownik"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "mieszkaniownik-backend"
}

variable "domain" {
  description = "Domain name for the application"
  type        = string
  default     = "mieszkaniownik.wsparcie.dev"
}
