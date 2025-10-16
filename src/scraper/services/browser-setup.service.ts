import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import { OtodomAuthService } from './otodom-auth.service';

@Injectable()
export class BrowserSetupService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserSetupService.name);
  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/116.0.1938.69',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0',
  ];

  private activeBrowsers = new Set<Browser>();
  private readonly MAX_CONCURRENT_BROWSERS = 3;
  private browserQueue: Array<() => void> = [];

  constructor(private readonly otodomAuth: OtodomAuthService) {}

  async onModuleDestroy() {
    this.logger.log('Closing all active browsers...');
    await Promise.all(
      Array.from(this.activeBrowsers).map(async (browser) => {
        try {
          await browser.close();
        } catch (error) {
          this.logger.warn(`Error closing browser: ${error}`);
        }
      }),
    );
    this.activeBrowsers.clear();
  }

  async createBrowser(): Promise<Browser> {
    while (this.activeBrowsers.size >= this.MAX_CONCURRENT_BROWSERS) {
      this.logger.log(
        `Browser limit reached (${this.activeBrowsers.size}/${this.MAX_CONCURRENT_BROWSERS}). Waiting...`,
      );
      await new Promise<void>((resolve) => {
        this.browserQueue.push(resolve);
      });
    }

    try {
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--window-size=1920,1080',
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
          '--disable-background-networking',
          '--disable-component-extensions-with-background-pages',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-ipc-flooding-protection',

          '--disable-dev-shm-usage',
          '--disable-software-rasterizer',
          '--single-process',
          '--no-zygote',
          '--disable-accelerated-2d-canvas',
          '--memory-pressure-off',
          '--disable-notifications',
          '--disable-speech-api',
          '--disable-audio-output',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-component-update',
          '--disable-domain-reliability',
          '--disable-features=TranslateUI,BlinkGenPropertyTrees',
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-sync',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-default-browser-check',
          '--safebrowsing-disable-auto-update',
        ],

        protocolTimeout: 60000,
      });

      this.activeBrowsers.add(browser);
      this.logger.log(
        `Browser created. Active browsers: ${this.activeBrowsers.size}/${this.MAX_CONCURRENT_BROWSERS}`,
      );

      browser.on('disconnected', () => {
        this.activeBrowsers.delete(browser);
        this.processQueue();
      });

      return browser;
    } catch (error) {
      this.logger.error(`Failed to create browser: ${error}`);
      throw error;
    }
  }

  private processQueue() {
    if (
      this.browserQueue.length > 0 &&
      this.activeBrowsers.size < this.MAX_CONCURRENT_BROWSERS
    ) {
      const next = this.browserQueue.shift();
      if (next) {
        next();
      }
    }
  }

  async closeBrowser(browser: Browser): Promise<void> {
    try {
      await browser.close();
      this.activeBrowsers.delete(browser);
      this.logger.log(
        `Browser closed. Active browsers: ${this.activeBrowsers.size}/${this.MAX_CONCURRENT_BROWSERS}`,
      );
      this.processQueue();
    } catch (error) {
      this.logger.warn(`Error closing browser: ${error}`);
    }
  }

  async setupPage(browser: Browser, forOtodom = false): Promise<Page> {
    const page = await browser.newPage();
    const userAgent =
      this.userAgents[Math.floor(Math.random() * this.userAgents.length)];

    await page.setUserAgent(userAgent);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      'Sec-Ch-Ua':
        '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Linux"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    });

    await page.setViewport({ width: 1920, height: 1080 });

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['pl-PL', 'pl', 'en-US', 'en'],
      });

      Object.defineProperty(window, 'chrome', {
        value: {
          runtime: {},
        },
        writable: true,
      });
    });

    if (forOtodom && this.otodomAuth.isAuthConfigured()) {
      try {
        this.logger.log('Attempting to apply Otodom authentication cookies...');
        const authenticated = await this.otodomAuth.applyCookiesToPage(page);
        if (authenticated) {
          this.logger.log(
            'Successfully applied Otodom authentication cookies to page',
          );
        } else {
          this.logger.warn(
            'Otodom authentication cookies not available or expired',
          );
          this.logger.warn(
            'Page will load without authentication - may receive limited content',
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to apply Otodom auth cookies: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        this.logger.warn(
          'Continuing without authentication - CloudFront may block or limit content',
        );
      }
    } else if (forOtodom) {
      this.logger.warn('Otodom authentication requested but not configured');
      this.logger.warn(
        'Set OTODOM_EMAIL and OTODOM_PASSWORD to enable authentication',
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
    processFn: (page: Page) => Promise<T>,
  ): Promise<T> {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      browser = await this.createBrowser();
      page = await this.setupPage(browser, forOtodom);

      const navigationTimeout = forOtodom ? 60000 : 30000;

      try {
        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: navigationTimeout,
        });
      } catch (navError) {
        this.logger.warn(
          `Navigation with networkidle0 failed, retrying with domcontentloaded: ${navError instanceof Error ? navError.message : 'Unknown error'}`,
        );
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: navigationTimeout,
        });
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      if (forOtodom) {
        const pageContent = await page.content();
        if (
          pageContent.includes('403 ERROR') ||
          pageContent.includes('Request blocked') ||
          pageContent.includes('cloudfront')
        ) {
          this.logger.error(
            `CloudFront blocked request for ${url}. Authentication cookies applied but bot detection triggered.`,
          );
          throw new Error(
            'CloudFront 403: Request blocked by Otodom bot protection',
          );
        }
      }

      await page.evaluate(() => {
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

      return await processFn(page);
    } catch (error) {
      this.logger.error(
        `Error scraping ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    } finally {
      try {
        if (page && !page.isClosed()) {
          await page.close();
          this.logger.debug(`Closed page for ${url}`);
        }
      } catch (closeError) {
        this.logger.warn(
          `Failed to close page for ${url}: ${closeError instanceof Error ? closeError.message : 'Unknown error'}`,
        );
      }

      try {
        if (browser) {
          await this.closeBrowser(browser);
          this.logger.debug(`Closed browser for ${url}`);
        }
      } catch (closeError) {
        this.logger.warn(
          `Failed to close browser for ${url}: ${closeError instanceof Error ? closeError.message : 'Unknown error'}`,
        );
      }
    }
  }
}
