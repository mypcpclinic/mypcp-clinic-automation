#!/bin/bash

# myPCP Clinic Automation System - Deployment Script
# This script helps deploy the system to various cloud platforms

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists node; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    if ! command_exists npm; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node -v)"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    npm ci --only=production
    print_success "Dependencies installed"
}

# Function to run tests
run_tests() {
    print_status "Running tests..."
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        npm test
        print_success "Tests passed"
    else
        print_warning "No tests found, skipping..."
    fi
}

# Function to build for production
build_production() {
    print_status "Building for production..."
    
    # Create production build if needed
    if [ -f "package.json" ] && grep -q '"build"' package.json; then
        npm run build
        print_success "Production build completed"
    else
        print_warning "No build script found, using source files"
    fi
}

# Function to deploy to Railway
deploy_railway() {
    print_status "Deploying to Railway..."
    
    if ! command_exists railway; then
        print_error "Railway CLI is not installed. Please install it first:"
        echo "npm install -g @railway/cli"
        exit 1
    fi
    
    # Login to Railway
    railway login
    
    # Deploy
    railway up
    
    print_success "Deployed to Railway successfully"
}

# Function to deploy to Render
deploy_render() {
    print_status "Deploying to Render..."
    
    if ! command_exists render; then
        print_error "Render CLI is not installed. Please install it first:"
        echo "npm install -g @render/cli"
        exit 1
    fi
    
    # Deploy
    render deploy
    
    print_success "Deployed to Render successfully"
}

# Function to deploy to Heroku
deploy_heroku() {
    print_status "Deploying to Heroku..."
    
    if ! command_exists heroku; then
        print_error "Heroku CLI is not installed. Please install it first:"
        echo "https://devcenter.heroku.com/articles/heroku-cli"
        exit 1
    fi
    
    # Check if Heroku app exists
    if ! heroku apps:info >/dev/null 2>&1; then
        print_status "Creating Heroku app..."
        heroku create
    fi
    
    # Deploy
    git push heroku main
    
    print_success "Deployed to Heroku successfully"
}

# Function to deploy with Docker
deploy_docker() {
    print_status "Building Docker image..."
    
    if ! command_exists docker; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Build Docker image
    docker build -t mypcp-clinic-automation .
    
    print_success "Docker image built successfully"
    
    # Ask if user wants to run the container
    read -p "Do you want to run the Docker container now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Starting Docker container..."
        docker run -d -p 3000:3000 --env-file .env --name mypcp-automation mypcp-clinic-automation
        print_success "Docker container started successfully"
        print_status "Application is running at http://localhost:3000"
    fi
}

# Function to deploy with Docker Compose
deploy_docker_compose() {
    print_status "Deploying with Docker Compose..."
    
    if ! command_exists docker-compose; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Start services
    docker-compose up -d
    
    print_success "Services started with Docker Compose"
    print_status "Application is running at http://localhost:3000"
}

# Function to setup environment
setup_environment() {
    print_status "Setting up environment..."
    
    if [ ! -f ".env" ]; then
        if [ -f "env.example" ]; then
            print_status "Creating .env file from template..."
            cp env.example .env
            print_warning "Please edit .env file with your actual configuration"
        else
            print_error ".env file not found and no template available"
            exit 1
        fi
    fi
    
    print_success "Environment setup completed"
}

# Function to show help
show_help() {
    echo "myPCP Clinic Automation System - Deployment Script"
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  railway          Deploy to Railway"
    echo "  render           Deploy to Render"
    echo "  heroku           Deploy to Heroku"
    echo "  docker           Build and run with Docker"
    echo "  docker-compose   Deploy with Docker Compose"
    echo "  local            Setup for local development"
    echo "  test             Run tests only"
    echo "  help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 railway       # Deploy to Railway"
    echo "  $0 docker        # Build and run with Docker"
    echo "  $0 local         # Setup for local development"
}

# Main function
main() {
    case "${1:-help}" in
        "railway")
            check_prerequisites
            install_dependencies
            run_tests
            build_production
            deploy_railway
            ;;
        "render")
            check_prerequisites
            install_dependencies
            run_tests
            build_production
            deploy_render
            ;;
        "heroku")
            check_prerequisites
            install_dependencies
            run_tests
            build_production
            deploy_heroku
            ;;
        "docker")
            check_prerequisites
            setup_environment
            deploy_docker
            ;;
        "docker-compose")
            check_prerequisites
            setup_environment
            deploy_docker_compose
            ;;
        "local")
            check_prerequisites
            install_dependencies
            setup_environment
            print_success "Local development setup completed"
            print_status "Run 'npm start' to start the server"
            ;;
        "test")
            check_prerequisites
            install_dependencies
            run_tests
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Run main function with all arguments
main "$@"
