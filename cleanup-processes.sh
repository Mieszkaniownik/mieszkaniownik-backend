#!/bin/bash

################################################################################
# Cleanup Script for Mieszkaniownik Project
# Usage: ./cleanup-processes.sh [--silent] [--force]
# 
# Options:
#   --silent: Minimal output
#   --force:  Force kill all processes without confirmation
################################################################################

set +e

SILENT=false
FORCE=false

for arg in "$@"; do
    case $arg in
        --silent) SILENT=true ;;
        --force) FORCE=true ;;
    esac
done

if [ "$SILENT" = false ]; then
    echo "=================================================="
    echo "      Mieszkaniownik Process Cleanup Script"
    echo "=================================================="
    echo ""
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

CLEANED=0

print_status() {
    [ "$SILENT" = false ] && echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    [ "$SILENT" = false ] && echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

[ "$SILENT" = false ] && echo "Step 1: Killing backend Node processes..."
if pgrep -f "node.*nest start" > /dev/null 2>&1; then
    pkill -9 -f "node.*nest start" 2>/dev/null || true
    print_status "Killed backend Node processes"
    CLEANED=$((CLEANED + 1))
elif pgrep -f "node.*dist/src/main" > /dev/null 2>&1; then
    pkill -9 -f "node.*dist/src/main" 2>/dev/null || true
    print_status "Killed backend production processes"
    CLEANED=$((CLEANED + 1))
else
    print_warning "No backend Node processes found"
fi

[ "$SILENT" = false ] && echo ""
[ "$SILENT" = false ] && echo "Step 2: Killing Puppeteer/Chromium browser processes..."
CHROMIUM_COUNT=$(ps aux 2>/dev/null | grep -E "chromium.*puppeteer|chrome.*puppeteer|puppeteer_dev_chrome_profile" | grep -v grep | wc -l)
if [ "$CHROMIUM_COUNT" -gt 0 ]; then
    pkill -9 -f "puppeteer_dev_chrome_profile" 2>/dev/null || true
    pkill -9 -f "chromium.*--no-sandbox.*--disable-setuid-sandbox" 2>/dev/null || true
    pkill -9 -f "chromium.*--headless" 2>/dev/null || true
    sleep 1
    print_status "Killed $CHROMIUM_COUNT Puppeteer browser processes"
    CLEANED=$((CLEANED + 1))
else
    print_warning "No Puppeteer browser processes found"
fi

[ "$SILENT" = false ] && echo ""
[ "$SILENT" = false ] && echo "Step 3: Killing npm/vite development servers..."
CURRENT_PPID=$$
BASH_PID=$PPID
NPM_PIDS=$(ps aux | grep -E "npm.*(start:dev|dev)" | grep -v grep | grep -v "$CURRENT_PPID" | grep -v "$BASH_PID" | awk '{print $2}')
VITE_PIDS=$(ps aux | grep -E "[v]ite" | grep -v grep | awk '{print $2}')
if [ ! -z "$NPM_PIDS" ] || [ ! -z "$VITE_PIDS" ]; then
    [ ! -z "$NPM_PIDS" ] && echo "$NPM_PIDS" | xargs -r kill -9 2>/dev/null || true
    [ ! -z "$VITE_PIDS" ] && echo "$VITE_PIDS" | xargs -r kill -9 2>/dev/null || true
    print_status "Killed npm/vite development server processes"
    CLEANED=$((CLEANED + 1))
else
    print_warning "No npm/vite development server processes found"
fi

[ "$SILENT" = false ] && echo ""
[ "$SILENT" = false ] && echo "Step 4: Cleaning up Puppeteer temporary directories..."
TEMP_DIRS=$(ls -d /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null | wc -l)
if [ "$TEMP_DIRS" -gt 0 ]; then
    rm -rf /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null || true
    print_status "Cleaned up $TEMP_DIRS Puppeteer temp directories"
    CLEANED=$((CLEANED + 1))
else
    print_warning "No Puppeteer temp directories found"
fi

[ "$SILENT" = false ] && echo ""
[ "$SILENT" = false ] && echo "Step 5: Cleaning up orphaned Chrome crash dumps..."
if [ -d "$HOME/.config/chromium/Crash Reports" ]; then
    CRASH_COUNT=$(find "$HOME/.config/chromium/Crash Reports" -type f 2>/dev/null | wc -l)
    if [ "$CRASH_COUNT" -gt 0 ]; then
        find "$HOME/.config/chromium/Crash Reports" -type f -delete 2>/dev/null || true
        print_status "Cleaned up $CRASH_COUNT crash report files"
        CLEANED=$((CLEANED + 1))
    fi
fi

[ "$SILENT" = false ] && echo ""
[ "$SILENT" = false ] && echo "Step 6: Checking for remaining problematic processes..."
REMAINING=$(ps aux | grep -E "chromium.*puppeteer|node.*mieszkaniownik" | grep -v grep | wc -l)
if [ "$REMAINING" -eq 0 ]; then
    print_status "All processes cleaned up successfully"
else
    print_warning "$REMAINING processes still running (may be VS Code related)"
fi

if [ "$SILENT" = false ]; then
    echo ""
    echo "Step 7: Checking system resources..."
    OPEN_FILES=$(lsof 2>/dev/null | wc -l)
    echo "   Open files: $OPEN_FILES"

    SOFT_LIMIT=$(ulimit -n)
    echo "   File descriptor limit (soft): $SOFT_LIMIT"

    if [ "$OPEN_FILES" -gt 1000000 ]; then
        print_warning "High number of open files detected: $OPEN_FILES"
        echo "   Consider increasing system limits if issues persist"
    else
        print_status "Open files count is reasonable: $OPEN_FILES"
    fi
fi

if [ "$SILENT" = false ]; then
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
else
    exit 0
fi
