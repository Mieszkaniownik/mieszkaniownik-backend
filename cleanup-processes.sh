#!/bin/bash

################################################################################
# Cleanup Script for Mieszkaniownik Project
# Usage: ./cleanup-processes.sh
################################################################################

set -e

echo "=================================================="
echo "      Mieszkaniownik Process Cleanup Script"
echo "=================================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

CLEANED=0

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

echo "Step 1: Killing backend Node processes..."
if pkill -9 -f "node.*nest" 2>/dev/null || pkill -9 -f "node.*dist/src/main" 2>/dev/null; then
    print_status "Killed backend Node processes"
    CLEANED=$((CLEANED + 1))
else
    print_warning "No backend Node processes found"
fi

echo ""
echo "Step 2: Killing Puppeteer/Chromium browser processes..."
CHROMIUM_COUNT=$(ps aux | grep -E "chromium.*puppeteer|chrome.*puppeteer" | grep -v grep | wc -l)
if [ "$CHROMIUM_COUNT" -gt 0 ]; then
    pkill -9 -f "chromium.*puppeteer" 2>/dev/null || true
    pkill -9 -f "chrome.*puppeteer" 2>/dev/null || true
    pkill -9 -f "puppeteer_dev_chrome_profile" 2>/dev/null || true
    print_status "Killed $CHROMIUM_COUNT Puppeteer browser processes"
    CLEANED=$((CLEANED + 1))
else
    print_warning "No Puppeteer browser processes found"
fi

echo ""
echo "Step 3: Killing npm/vite development servers..."
NPM_PIDS=$(ps aux | grep -E "npm.*(start|dev)|vite" | grep -v grep | awk '{print $2}')
if [ ! -z "$NPM_PIDS" ]; then
    echo "$NPM_PIDS" | xargs -r kill -9 2>/dev/null || true
    print_status "Killed npm/vite processes"
    CLEANED=$((CLEANED + 1))
else
    print_warning "No npm/vite processes found"
fi

echo ""
echo "Step 4: Cleaning up Puppeteer temporary directories..."
TEMP_DIRS=$(ls -d /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null | wc -l)
if [ "$TEMP_DIRS" -gt 0 ]; then
    rm -rf /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null || true
    print_status "Cleaned up $TEMP_DIRS Puppeteer temp directories"
    CLEANED=$((CLEANED + 1))
else
    print_warning "No Puppeteer temp directories found"
fi

echo ""
echo "Step 5: Cleaning up orphaned Chrome crash dumps..."
if [ -d "$HOME/.config/chromium/Crash Reports" ]; then
    CRASH_COUNT=$(find "$HOME/.config/chromium/Crash Reports" -type f 2>/dev/null | wc -l)
    if [ "$CRASH_COUNT" -gt 0 ]; then
        find "$HOME/.config/chromium/Crash Reports" -type f -delete 2>/dev/null || true
        print_status "Cleaned up $CRASH_COUNT crash report files"
        CLEANED=$((CLEANED + 1))
    fi
fi

echo ""
echo "Step 6: Checking for remaining problematic processes..."
REMAINING=$(ps aux | grep -E "chromium.*puppeteer|node.*mieszkaniownik" | grep -v grep | wc -l)
if [ "$REMAINING" -eq 0 ]; then
    print_status "All processes cleaned up successfully"
else
    print_warning "$REMAINING processes still running (may be VS Code related)"
fi

echo ""
echo "Step 7: Checking system resources..."
OPEN_FILES=$(lsof 2>/dev/null | wc -l)
echo "   Open files: $OPEN_FILES"

# Check file descriptor limits
SOFT_LIMIT=$(ulimit -n)
echo "   File descriptor limit (soft): $SOFT_LIMIT"

if [ "$OPEN_FILES" -gt 1000000 ]; then
    print_warning "High number of open files detected: $OPEN_FILES"
    echo "   Consider increasing system limits if issues persist"
else
    print_status "Open files count is reasonable: $OPEN_FILES"
fi

echo ""
echo "=================================================="
if [ "$CLEANED" -gt 0 ]; then
    echo -e "${GREEN}Cleanup completed! Cleaned $CLEANED item(s)${NC}"
else
    echo -e "${YELLOW}System was already clean${NC}"
fi
echo "=================================================="
echo ""
echo "You can now safely start the application:"
echo "  Backend:  cd backend && npm run start"
echo "  Frontend: cd frontend && npm run dev"
echo ""
