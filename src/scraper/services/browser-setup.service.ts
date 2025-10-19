import * as puppeteer from "puppeteer";
import type { Browser, Page } from "puppeteer";

import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";

import { OtodomAuthService } from "./otodom-auth.service";

@Injectable()
export class BrowserSetupService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserSetupService.name);
  private readonly userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/116.0.1938.69",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0",
  ];

  private olxBrowsers = new Set<Browser>();
  private otodomBrowsers = new Set<Browser>();
  private readonly MAX_OLX_BROWSERS = 2;
  private readonly MAX_OTODOM_BROWSERS = 2;
  private olxBrowserQueue: (() => void)[] = [];
  private otodomBrowserQueue: (() => void)[] = [];
  private readonly BROWSER_CLOSE_TIMEOUT = 5000;
  private cleanupInProgress = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(private readonly otodomAuth: OtodomAuthService) {
    this.setupSignalHandlers();
    this.startBrowserMonitoring();
  }

  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];

    for (const signal of signals) {
      process.on(signal, async () => {
        if (!this.cleanupInProgress) {
          this.logger.warn(
            `Received ${signal} signal. Cleaning up browsers...`,
          );
          this.cleanupInProgress = true;

          if (this.monitoringInterval !== null) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
          }

          await this.emergencyCleanup();
          process.exit(0);
        }
      });
    }

    this.logger.log("Signal handlers registered for graceful shutdown");
  }

  private startBrowserMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      const totalBrowsers = this.olxBrowsers.size + this.otodomBrowsers.size;
      const maxTotal = this.MAX_OLX_BROWSERS + this.MAX_OTODOM_BROWSERS;

      if (totalBrowsers > maxTotal) {
        this.logger.warn(
          `Browser count exceeds expected limits! Active: ${String(totalBrowsers)}, Expected max: ${String(maxTotal)} (OLX: ${String(this.olxBrowsers.size)}/${String(this.MAX_OLX_BROWSERS)}, Otodom: ${String(this.otodomBrowsers.size)}/${String(this.MAX_OTODOM_BROWSERS)})`,
        );
      } else if (totalBrowsers > 0) {
        this.logger.debug(
          `Active browsers: ${String(totalBrowsers)}/${String(maxTotal)} (OLX: ${String(this.olxBrowsers.size)}, Otodom: ${String(this.otodomBrowsers.size)})`,
        );
      }
    }, 30_000);

    this.logger.log("Browser monitoring started");
  }

  private async emergencyCleanup(): Promise<void> {
    const allBrowsers = [...this.olxBrowsers, ...this.otodomBrowsers];

    if (allBrowsers.length === 0) {
      this.logger.log("No browsers to clean up");
      return;
    }

    this.logger.log(
      `Attempting to close ${String(allBrowsers.length)} browsers...`,
    );

    const closePromises = allBrowsers.map(async (browser, index) => {
      try {
        const timeout = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error("Browser close timeout"));
          }, this.BROWSER_CLOSE_TIMEOUT);
        });

        await Promise.race([browser.close(), timeout]);
        this.logger.debug(`Browser ${String(index + 1)} closed successfully`);
      } catch (error) {
        this.logger.warn(
          `Failed to close browser ${String(index + 1)}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    await Promise.allSettled(closePromises);

    this.olxBrowsers.clear();
    this.otodomBrowsers.clear();
    this.logger.log("Emergency cleanup completed");
  }

  async onModuleDestroy() {
    this.logger.log("Closing all active browsers...");

    if (this.monitoringInterval !== null) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    await this.emergencyCleanup();
  }

  async createBrowser(forOtodom = false): Promise<Browser> {
    const activeBrowsers = forOtodom ? this.otodomBrowsers : this.olxBrowsers;
    const maxBrowsers = forOtodom
      ? this.MAX_OTODOM_BROWSERS
      : this.MAX_OLX_BROWSERS;
    const browserQueue = forOtodom
      ? this.otodomBrowserQueue
      : this.olxBrowserQueue;
    const poolName = forOtodom ? "Otodom" : "OLX";

    while (activeBrowsers.size >= maxBrowsers) {
      this.logger.log(
        `${poolName} browser limit reached (${String(activeBrowsers.size)}/${String(maxBrowsers)}). Waiting...`,
      );
      await new Promise<void>((resolve) => {
        browserQueue.push(resolve);
      });
    }

    try {
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: "/usr/bin/chromium",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--window-size=1920,1080",
          "--disable-blink-features=AutomationControlled",
          "--no-first-run",
          "--disable-background-networking",
          "--disable-component-extensions-with-background-pages",
          "--disable-default-apps",
          "--disable-extensions",
          "--disable-ipc-flooding-protection",

          "--disable-dev-shm-usage",
          "--disable-software-rasterizer",
          "--single-process",
          "--no-zygote",
          "--disable-accelerated-2d-canvas",
          "--memory-pressure-off",
          "--disable-notifications",
          "--disable-speech-api",
          "--disable-audio-output",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-breakpad",
          "--disable-component-update",
          "--disable-domain-reliability",
          "--disable-features=TranslateUI,BlinkGenPropertyTrees",
          "--disable-hang-monitor",
          "--disable-prompt-on-repost",
          "--disable-sync",
          "--metrics-recording-only",
          "--mute-audio",
          "--no-default-browser-check",
          "--safebrowsing-disable-auto-update",
        ],

        protocolTimeout: 60_000,
      });

      activeBrowsers.add(browser);
      this.logger.log(
        `${poolName} browser created. Active browsers: ${String(activeBrowsers.size)}/${String(maxBrowsers)}`,
      );

      browser.on("disconnected", () => {
        activeBrowsers.delete(browser);
        this.processQueue(forOtodom);
      });

      return browser;
    } catch (error) {
      this.logger.error(
        `Failed to create browser: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private processQueue(forOtodom = false) {
    const activeBrowsers = forOtodom ? this.otodomBrowsers : this.olxBrowsers;
    const maxBrowsers = forOtodom
      ? this.MAX_OTODOM_BROWSERS
      : this.MAX_OLX_BROWSERS;
    const browserQueue = forOtodom
      ? this.otodomBrowserQueue
      : this.olxBrowserQueue;

    if (browserQueue.length > 0 && activeBrowsers.size < maxBrowsers) {
      const next = browserQueue.shift();
      if (next !== undefined) {
        next();
      }
    }
  }

  async closeBrowser(browser: Browser, forOtodom = false): Promise<void> {
    const activeBrowsers = forOtodom ? this.otodomBrowsers : this.olxBrowsers;
    const maxBrowsers = forOtodom
      ? this.MAX_OTODOM_BROWSERS
      : this.MAX_OLX_BROWSERS;
    const poolName = forOtodom ? "Otodom" : "OLX";

    try {
      const timeout = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Browser close timeout"));
        }, this.BROWSER_CLOSE_TIMEOUT);
      });

      await Promise.race([browser.close(), timeout]);
      activeBrowsers.delete(browser);
      this.logger.log(
        `${poolName} browser closed. Active browsers: ${String(activeBrowsers.size)}/${String(maxBrowsers)}`,
      );
      this.processQueue(forOtodom);
    } catch (error) {
      activeBrowsers.delete(browser);
      this.logger.warn(
        `Error closing ${poolName} browser: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.processQueue(forOtodom);
    }
  }

  async setupPage(browser: Browser, forOtodom = false): Promise<Page> {
    const page = await browser.newPage();
    const userAgent =
      this.userAgents[Math.floor(Math.random() * this.userAgents.length)];

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    await page.setUserAgent(userAgent);
    await page.setExtraHTTPHeaders({
      "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Sec-Ch-Ua":
        '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Linux"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    });

    await page.setViewport({ width: 1920, height: 1080 });

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        get: () => {},
      });

      Object.defineProperty(navigator, "languages", {
        get: () => ["pl-PL", "pl", "en-US", "en"],
      });

      Object.defineProperty(window, "chrome", {
        value: {
          runtime: {},
        },
        writable: true,
      });
    });

    if (forOtodom && this.otodomAuth.isAuthConfigured()) {
      try {
        this.logger.log("Attempting to apply Otodom authentication cookies...");
        const authenticated = await this.otodomAuth.applyCookiesToPage(page);
        if (authenticated) {
          this.logger.log(
            "Successfully applied Otodom authentication cookies to page",
          );
        } else {
          this.logger.warn(
            "Otodom authentication cookies not available or expired",
          );
          this.logger.warn(
            "Page will load without authentication - may receive limited content",
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to apply Otodom auth cookies: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        this.logger.warn(
          "Continuing without authentication - CloudFront may block or limit content",
        );
      }
    } else if (forOtodom) {
      this.logger.warn("Otodom authentication requested but not configured");
      this.logger.warn(
        "Set OTODOM_EMAIL and OTODOM_PASSWORD to enable authentication",
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 3000 + 2000),
    );

    return page;
  }

  getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  async scrapeWithBrowser<T>(
    url: string,
    forOtodom: boolean,
    processFunction: (page: Page) => Promise<T>,
  ): Promise<T> {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      browser = await this.createBrowser(forOtodom);
      page = await this.setupPage(browser, forOtodom);

      const navigationTimeout = forOtodom ? 60_000 : 30_000;

      try {
        await page.goto(url, {
          waitUntil: "networkidle0",
          timeout: navigationTimeout,
        });
      } catch {
        this.logger.debug(
          `Page took too long to reach networkidle0, using domcontentloaded strategy instead for: ${url}`,
        );
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: navigationTimeout,
        });
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      if (forOtodom) {
        const pageContent = await page.content();
        if (
          pageContent.includes("403 ERROR") ||
          pageContent.includes("Request blocked") ||
          pageContent.includes("cloudfront")
        ) {
          this.logger.error(
            `CloudFront blocked request for ${url}. Authentication cookies applied but bot detection triggered.`,
          );
          throw new Error(
            "CloudFront 403: Request blocked by Otodom bot protection",
          );
        }
      }

      await page.evaluate(async () => {
        return new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              window.scrollTo(0, 0);
              resolve();
            }
          }, 100);
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));

      return await processFunction(page);
    } catch (error) {
      this.logger.error(
        `Error scraping ${url}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    } finally {
      try {
        if (page !== null && !page.isClosed()) {
          await page.close();
          this.logger.debug(`Closed page for ${url}`);
        }
      } catch (closeError) {
        this.logger.warn(
          `Failed to close page for ${url}: ${closeError instanceof Error ? closeError.message : "Unknown error"}`,
        );
      }

      try {
        if (browser !== null) {
          await this.closeBrowser(browser, forOtodom);
          this.logger.debug(`Closed browser for ${url}`);
        }
      } catch (closeError) {
        this.logger.warn(
          `Failed to close browser for ${url}: ${closeError instanceof Error ? closeError.message : "Unknown error"}`,
        );
      }
    }
  }
}
