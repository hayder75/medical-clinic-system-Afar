#!/bin/bash

# Medical Clinic System - Auto Migration Script
# Run this script on the client's server after transferring the updated code

echo "=========================================="
echo "Medical Clinic System - Migration Script"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Configuration
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root. Consider running as a regular user."
fi

echo "Step 1: Stopping existing services..."
echo "--------------------------------------"
pm2 stop all 2>/dev/null || print_warning "PM2 not running or not installed"
pkill -f "node server.js" 2>/dev/null || print_warning "No backend process found"
pkill -f "vite" 2>/dev/null || print_warning "No frontend process found"
print_status "Services stopped"
echo ""

echo "Step 2: Installing Backend Dependencies..."
echo "-------------------------------------------"
cd "$BACKEND_DIR"
npm install --production
if [ $? -eq 0 ]; then
    print_status "Backend dependencies installed"
else
    print_error "Backend dependencies installation failed"
    exit 1
fi
echo ""

echo "Step 3: Running Database Migrations..."
echo "---------------------------------------"
cd "$BACKEND_DIR"

# Generate Prisma client
npx prisma generate
if [ $? -eq 0 ]; then
    print_status "Prisma client generated"
else
    print_error "Prisma client generation failed"
    exit 1
fi

# Apply migrations
npx prisma migrate deploy
if [ $? -eq 0 ]; then
    print_status "Database migrations applied"
else
    print_warning "No new migrations or migration failed - trying db push"
    npx prisma db push --accept-data-loss
fi
echo ""

echo "Step 4: Updating Lab Template Options..."
echo "-----------------------------------------"
cd "$BACKEND_DIR"
node update-lab-options.js
if [ $? -eq 0 ]; then
    print_status "Lab template options updated"
else
    print_warning "Lab template update script failed or not needed"
fi
echo ""

echo "Step 5: Installing Frontend Dependencies..."
echo "--------------------------------------------"
cd "$FRONTEND_DIR"
npm install
if [ $? -eq 0 ]; then
    print_status "Frontend dependencies installed"
else
    print_error "Frontend dependencies installation failed"
    exit 1
fi
echo ""

echo "Step 6: Starting Services..."
echo "-----------------------------"

# Check if PM2 is available
if command -v pm2 &> /dev/null; then
    echo "Using PM2 to manage services..."
    
    cd "$BACKEND_DIR"
    pm2 start server.js --name medical-backend
    
    cd "$FRONTEND_DIR"
    pm2 start "npm run dev -- --port 3001 --host 0.0.0.0" --name medical-frontend
    
    pm2 save
    print_status "Services started with PM2"
else
    print_warning "PM2 not found. Starting services manually..."
    
    cd "$BACKEND_DIR"
    npm start > backend.log 2>&1 &
    BACKEND_PID=$!
    echo "Backend PID: $BACKEND_PID"
    
    cd "$FRONTEND_DIR"
    npm run dev -- --port 3001 --host 0.0.0.0 > frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"
    
    print_status "Services started in background"
fi
echo ""

# Wait for services to start
sleep 5

echo "Step 7: Verifying Services..."
echo "------------------------------"

# Check backend
if curl -s http://localhost:3000/api/auth/login-users > /dev/null 2>&1; then
    print_status "Backend is running on port 3000"
else
    print_error "Backend is NOT responding on port 3000"
fi

# Check frontend port
if fuser 3001/tcp > /dev/null 2>&1; then
    print_status "Frontend is running on port 3001"
else
    print_error "Frontend is NOT responding on port 3001"
fi
echo ""

echo "=========================================="
echo "Migration Complete!"
echo "=========================================="
echo ""
echo "Access the application at:"
echo "  Frontend: http://localhost:3001"
echo "  Backend:  http://localhost:3000"
echo ""
echo "If using PM2, check status with: pm2 status"
echo "View logs with: pm2 logs"
echo ""
