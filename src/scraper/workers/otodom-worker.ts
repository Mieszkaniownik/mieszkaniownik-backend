import { isMainThread, parentPort, workerData } from 'worker_threads';
import * as puppeteer from 'puppeteer';
import type { Browser, Cookie } from 'puppeteer';

export interface ScraperWorkerData {
  pageNum: number;
  sortOrder: string;
  baseUrl: string;
  userAgents: string[];
  isNewOffersOnly?: boolean;
  cookies?: Cookie[];
}

export interface ScraperWorkerResult {
  success: boolean;
  offers: string[];
  hasNextPage: boolean;
  error?: string;
  pageNum: number;
  source: 'olx' | 'otodom';
  newOffers?: string[];
}

if (!isMainThread && parentPort) {
  const data = workerData as ScraperWorkerData;

  async function scrapeOtodomPage(): Promise<ScraperWorkerResult> {
    let browser: Browser | undefined;

    try {
      console.log(
        `WorkerResultOtodom Worker: Scraping page ${data.pageNum} (new offers only: ${data.isNewOffersOnly || false})`,
      );
      const url = `${data.baseUrl}/pl/wyniki/wynajem/mieszkanie/cala-polska?ownerTypeSingleSelect=ALL&by=LATEST&direction=DESC&page=${data.pageNum}&limit=72`;

      browser = await puppeteer.launch({
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
        ],
      });

      const page = await browser.newPage();
      const userAgent =
        data.userAgents[Math.floor(Math.random() * data.userAgents.length)];

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
          value: { runtime: {} },
          writable: true,
        });
      });

      if (data.cookies && data.cookies.length > 0) {
        try {
          await page.setCookie(...data.cookies);
          console.log(
            `Otodom Worker: Applied ${data.cookies.length} authentication cookies`,
          );
        } catch (cookieError) {
          console.warn(
            `Otodom Worker: Failed to apply cookies: ${cookieError instanceof Error ? cookieError.message : 'Unknown error'}`,
          );
        }
      }

      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 3000 + 2000),
      );

      try {
        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: 60000,
        });
      } catch (navError) {
        console.warn(
          `Otodom Worker: Navigation with networkidle0 failed, retrying with domcontentloaded: ${navError instanceof Error ? navError.message : 'Unknown error'}`,
        );
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      await page.waitForSelector(
        'article[data-sentry-component="AdvertCard"]',
        {
          timeout: 10000,
        },
      );

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const offers = await page.evaluate((): string[] => {
        const linkElements = document.querySelectorAll(
          'a[data-cy="listing-item-link"][href*="/pl/oferta/"]',
        );
        console.log(`Found ${linkElements.length} Otodom offer links on page`);
        return Array.from(linkElements)
          .map((link) => {
            const href = link.getAttribute('href');
            return href && href.startsWith('/')
              ? `https://www.otodom.pl${href}`
              : href;
          })
          .filter((href): href is string => href !== null);
      });

      let hasNextPage = false;
      if (!data.isNewOffersOnly) {
        hasNextPage = await page.evaluate(() => {
          const nextButton = document.querySelector(
            '[data-cy="pagination.next-page"]:not([disabled])',
          );
          return !!nextButton;
        });
      }

      console.log(
        `WorkerResultOtodom Worker: Found ${offers.length} offers on page ${data.pageNum}, hasNextPage: ${hasNextPage}`,
      );

      return {
        success: true,
        offers: offers,
        hasNextPage,
        pageNum: data.pageNum,
        source: 'otodom',
      };
    } catch (error) {
      console.error(
        `WorkerResultOtodom Worker: Error scraping page ${data.pageNum}:`,
        error,
      );
      return {
        success: false,
        offers: [],
        hasNextPage: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        pageNum: data.pageNum,
        source: 'otodom',
      };
    } finally {
      if (browser) {
        try {
          await browser.close();
          console.log(`Otodom Worker: Browser closed for page ${data.pageNum}`);
        } catch (closeError) {
          console.error(
            `Otodom Worker: Error closing browser for page ${data.pageNum}:`,
            closeError,
          );
        }
      }
    }
  }

  scrapeOtodomPage()
    .then((result) => {
      parentPort!.postMessage(result);
      process.exit(0);
    })
    .catch((error) => {
      parentPort!.postMessage({
        success: false,
        offers: [],
        hasNextPage: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        pageNum: data.pageNum,
        source: 'otodom',
      });
      process.exit(1);
    });
}
