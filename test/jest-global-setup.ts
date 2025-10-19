import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function globalSetup() {
  console.log("\nCleaning up orphaned browser processes before tests...\n");

  try {
    const commands = [
      'pkill -9 -f "puppeteer_dev_chrome_profile" 2>/dev/null || true',
      'pkill -9 -f "chromium.*--no-sandbox.*--disable-setuid-sandbox" 2>/dev/null || true',
      'pkill -9 -f "chromium.*--headless" 2>/dev/null || true',
      "rm -rf /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null || true",
    ];

    for (const cmd of commands) {
      try {
        await execAsync(cmd);
      } catch {}
    }

    console.log("Pre-test cleanup completed\n");
  } catch {
    console.log("Pre-test cleanup skipped\n");
  }
}

export default globalSetup;
