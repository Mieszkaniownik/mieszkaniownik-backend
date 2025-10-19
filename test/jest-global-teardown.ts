import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function globalTeardown() {
  // eslint-disable-next-line no-console
  console.log("\nCleaning up browser processes after tests...\n");

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

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // eslint-disable-next-line no-console
    console.log("Post-test cleanup completed\n");
  } catch {}
}

// eslint-disable-next-line import/no-default-export
export default globalTeardown;
