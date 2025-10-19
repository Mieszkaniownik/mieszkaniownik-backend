#!/bin/bash
CHROMIUM_COUNT=$(ps aux 2>/dev/null | grep -E "puppeteer_dev_chrome_profile" | grep -v grep | wc -l)

if [ "$CHROMIUM_COUNT" -gt 5 ]; then
    echo "   Warning: Found $CHROMIUM_COUNT orphaned Puppeteer browser processes"
    echo "   Running cleanup... (this may take a few seconds)"

    pkill -9 -f "puppeteer_dev_chrome_profile" 2>/dev/null || true
    pkill -9 -f "chromium.*--no-sandbox.*--disable-setuid-sandbox" 2>/dev/null || true
    pkill -9 -f "chromium.*--headless" 2>/dev/null || true

    rm -rf /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null || true
    
    echo "   Cleanup completed"
    echo ""
fi
