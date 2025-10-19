#!/bin/bash

# myPCP Clinic Automation System - Online Deployment Script
# This script helps you deploy your system to the cloud

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

echo "🚀 myPCP Clinic Automation System - Online Deployment"
echo "=================================================="
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    print_status "Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit - myPCP Clinic Automation System"
    print_success "Git repository initialized"
else
    print_status "Git repository already exists"
fi

echo ""
echo "📋 Deployment Options:"
echo "1. Railway (Recommended - Easiest)"
echo "2. Render (Also Great)"
echo "3. Heroku (Classic)"
echo "4. Manual GitHub Setup"
echo ""

read -p "Choose deployment option (1-4): " choice

case $choice in
    1)
        print_status "Setting up for Railway deployment..."
        
        # Check if Railway CLI is installed
        if ! command -v railway &> /dev/null; then
            print_status "Installing Railway CLI..."
            npm install -g @railway/cli
        fi
        
        print_success "Railway CLI ready"
        print_warning "Next steps:"
        echo "1. Go to https://railway.app"
        echo "2. Sign up with GitHub"
        echo "3. Create new project"
        echo "4. Deploy from GitHub repository"
        echo "5. Add environment variables in Railway dashboard"
        echo ""
        print_status "Your app will be available at: https://your-app.railway.app"
        ;;
        
    2)
        print_status "Setting up for Render deployment..."
        print_warning "Next steps:"
        echo "1. Go to https://render.com"
        echo "2. Sign up with GitHub"
        echo "3. Create new Web Service"
        echo "4. Connect your GitHub repository"
        echo "5. Add environment variables in Render dashboard"
        echo ""
        print_status "Your app will be available at: https://your-app.onrender.com"
        ;;
        
    3)
        print_status "Setting up for Heroku deployment..."
        
        # Check if Heroku CLI is installed
        if ! command -v heroku &> /dev/null; then
            print_error "Heroku CLI not found. Please install it first:"
            echo "Visit: https://devcenter.heroku.com/articles/heroku-cli"
            exit 1
        fi
        
        print_success "Heroku CLI ready"
        print_warning "Next steps:"
        echo "1. Run: heroku login"
        echo "2. Run: heroku create mypcp-clinic-automation"
        echo "3. Add environment variables with: heroku config:set KEY=value"
        echo "4. Run: git push heroku main"
        echo ""
        print_status "Your app will be available at: https://mypcp-clinic-automation.herokuapp.com"
        ;;
        
    4)
        print_status "Setting up for manual GitHub deployment..."
        print_warning "Next steps:"
        echo "1. Create a new repository on GitHub"
        echo "2. Run these commands:"
        echo "   git remote add origin https://github.com/YOUR_USERNAME/mypcp-automation.git"
        echo "   git branch -M main"
        echo "   git push -u origin main"
        echo "3. Choose a deployment platform (Railway, Render, etc.)"
        echo "4. Connect your GitHub repository"
        echo "5. Add environment variables"
        ;;
        
    *)
        print_error "Invalid option. Please choose 1-4."
        exit 1
        ;;
esac

echo ""
print_success "Deployment setup completed!"
echo ""
print_warning "Important: Don't forget to:"
echo "1. Add your environment variables to the deployment platform"
echo "2. Update webhook URLs to point to your live app"
echo "3. Update Google OAuth redirect URI"
echo "4. Test your live application"
echo ""
print_status "For detailed instructions, see DEPLOYMENT.md"
