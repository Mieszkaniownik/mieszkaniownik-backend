import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function globalTeardown() {
  // eslint-disable-next-line no-console
  console.log("\nCleaning up browser processes after tests...\n");

  try {
    await execAsync('pkill -9 -f "puppeteer_dev_chrome_profile" || true');
    await execAsync(
      'pkill -9 -f "chromium.*--no-sandbox.*--disable-setuid-sandbox" || true',
    );
    await execAsync('pkill -9 -f "chromium.*--headless" || true');

    await execAsync("rm -rf /tmp/puppeteer_dev_chrome_profile-* || true");

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // eslint-disable-next-line no-console
    console.log("Post-test cleanup completed\n");
  } catch (error) {
    console.warn("Warning: Post-test cleanup had issues:", error);
  }
}

// eslint-disable-next-line import/no-default-export
export default globalTeardown;
