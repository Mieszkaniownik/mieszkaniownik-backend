import Redis from "ioredis";
import * as fs from "node:fs";
import path from "node:path";
import * as puppeteer from "puppeteer";
import type { Browser, Cookie, Page } from "puppeteer";

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";

export interface OtodomAuthCookies {
  cookies: Cookie[];
  expiresAt: number;
  sessionId?: string;
}

@Injectable()
export class OtodomAuthService implements OnModuleInit {
  private readonly logger = new Logger(OtodomAuthService.name);
  private readonly REDIS_KEY = "otodom:auth:cookies";
  private readonly REDIS_SESSION_KEY = "otodom:auth:session";
  private readonly COOKIE_TTL = 24 * 60 * 60;
  private isAuthenticating = false;
  private authenticationPromise: Promise<OtodomAuthCookies | null> | null =
    null;
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number.parseInt(process.env.REDIS_PORT ?? "6379", 10),
      password: process.env.REDIS_PASSWORD,
    });
  }

  async onModuleInit() {
    if (!this.isAuthConfigured()) {
      this.logger.warn(
        "Otodom authentication is NOT configured. Set OTODOM_EMAIL and OTODOM_PASSWORD environment variables to enable.",
      );
      this.logger.warn(
        "Without authentication, Otodom may block or serve limited content to the scraper.",
      );
      return;
    }

    this.logger.log(
      "Otodom authentication service initialized with credentials",
    );
    this.logger.log(
      `Using email: ${process.env.OTODOM_EMAIL?.slice(0, 3) ?? "unknown"}***@${process.env.OTODOM_EMAIL?.split("@")[1] ?? "unknown"}`,
    );

    try {
      const auth = await this.ensureAuthenticated();
      if (auth === null) {
        this.logger.error(
          "Initial Otodom authentication failed - check credentials and network",
        );
      } else {
        this.logger.log(
          `Initial Otodom authentication successful - ${String(auth.cookies.length)} cookies cached`,
        );
        this.logger.log(
          `Session valid until: ${new Date(auth.expiresAt).toISOString()}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Initial Otodom authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      this.logger.error(
        "The scraper will continue without authentication (may receive limited data)",
      );
    }
  }

  isAuthConfigured(): boolean {
    const email = process.env.OTODOM_EMAIL;
    const password = process.env.OTODOM_PASSWORD;
    return (
      email !== undefined &&
      email !== "" &&
      email.trim() !== "" &&
      password !== undefined &&
      password !== "" &&
      password.trim() !== ""
    );
  }

  async ensureAuthenticated(): Promise<OtodomAuthCookies | null> {
    if (!this.isAuthConfigured()) {
      this.logger.debug("Otodom auth not configured, skipping authentication");
      return null;
    }

    if (this.isAuthenticating && this.authenticationPromise !== null) {
      this.logger.debug("Authentication in progress, waiting...");
      return this.authenticationPromise;
    }

    try {
      const cachedAuth = await this.getCachedAuth();
      if (cachedAuth !== null && this.isAuthValid(cachedAuth)) {
        this.logger.debug("Using cached Otodom authentication");
        return cachedAuth;
      }

      this.logger.log("Cached auth expired or invalid, re-authenticating...");
      this.isAuthenticating = true;
      this.authenticationPromise = this.performLogin();

      const auth = await this.authenticationPromise;

      if (auth !== null) {
        await this.cacheAuth(auth);
      }

      return auth;
    } catch (error) {
      this.logger.error(
        `Error ensuring authentication: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return null;
    } finally {
      this.isAuthenticating = false;
      this.authenticationPromise = null;
    }
  }

  private async performLogin(): Promise<OtodomAuthCookies | null> {
    let browser: Browser | undefined;

    try {
      this.logger.log("Starting Otodom login process...");

      browser = await puppeteer.launch({
        headless: true,
        executablePath: "/usr/bin/chromium",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-gpu",
          "--disable-web-security",
          "--window-size=1920,1080",
          "--disable-blink-features=AutomationControlled",
        ],
      });

      const page = await browser.newPage();

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
      );

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
          value: { runtime: {} },
          writable: true,
        });
      });

      this.logger.log("Navigating to Otodom login page...");
      const loginUrl = new URL("https://login.otodom.pl/");
      loginUrl.searchParams.set(
        "redirect_uri",
        "https://www.otodom.pl/api/internal/hciam/callback",
      );
      loginUrl.searchParams.set(
        "state",
        "eyJyZWZlcnJlciI6Imh0dHBzOlwvXC93d3cub3RvZG9tLnBsXC8ifQ==",
      );
      loginUrl.searchParams.set("ac", "bWFpbg==");
      loginUrl.searchParams.set("response_type", "code");
      loginUrl.searchParams.set("approval_prompt", "auto");
      loginUrl.searchParams.set(
        "code_challenge",
        "pggg1aTMOGh6YLqwnFptG--eG4a7q6ik6C2G_5ZqM5c",
      );
      loginUrl.searchParams.set("code_challenge_method", "S256");
      loginUrl.searchParams.set("client_id", "7qfnltd713ntok0m0ohv2bn29j");

      this.logger.log(`Login URL: ${loginUrl.toString()}`);

      await page.goto(loginUrl.toString(), {
        waitUntil: "networkidle2",
        timeout: 30_000,
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));

      try {
        this.logger.log("Looking for cookie consent banner...");
        const cookieButtonSelectors = [
          "#onetrust-accept-btn-handler",
          "button#onetrust-accept-btn-handler",
          '[id="onetrust-accept-btn-handler"]',
          "button.onetrust-close-btn-handler",
          'button[aria-label="Akceptuję"]',
        ];

        let cookieButtonFound = false;
        for (const selector of cookieButtonSelectors) {
          try {
            const button = await page.waitForSelector(selector, {
              timeout: 5000,
              visible: true,
            });
            if (button !== null) {
              this.logger.log(`Found cookie consent button: ${selector}`);
              await button.click();
              cookieButtonFound = true;
              this.logger.log("Clicked cookie consent button");
              await new Promise((resolve) => setTimeout(resolve, 2000));
              break;
            }
          } catch {
            continue;
          }
        }

        if (!cookieButtonFound) {
          this.logger.log("No cookie consent banner found, continuing...");
        }
      } catch (error) {
        this.logger.log(
          `Cookie consent handling skipped: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      try {
        this.logger.log("Waiting for login form to load...");

        let emailSelector = 'input#username[name="username"][type="email"]';

        try {
          await page.waitForSelector(emailSelector, { timeout: 10_000 });
        } catch {
          this.logger.log("Trying alternative email input selectors...");
          emailSelector = 'input[name="username"], input[type="email"]';
          await page.waitForSelector(emailSelector, { timeout: 10_000 });
        }

        this.logger.log("Login form found, entering credentials...");

        await page.click(emailSelector, { clickCount: 3 });
        const email = process.env.OTODOM_EMAIL ?? "";
        await page.type(emailSelector, email, {
          delay: 100,
        });

        let passwordSelector =
          'input#password[name="password"][type="password"]';

        try {
          await page.waitForSelector(passwordSelector, { timeout: 5000 });
        } catch {
          this.logger.log("Trying alternative password input selectors...");
          passwordSelector = 'input[name="password"], input[type="password"]';
          await page.waitForSelector(passwordSelector, { timeout: 5000 });
        }

        await page.click(passwordSelector, { clickCount: 3 });
        const password = process.env.OTODOM_PASSWORD ?? "";
        await page.type(passwordSelector, password, {
          delay: 100,
        });

        let submitSelector =
          'button#Login[data-testid="login-submit-button"][type="submit"]';

        try {
          await page.waitForSelector(submitSelector, { timeout: 5000 });
        } catch {
          this.logger.log("Trying alternative submit button selectors...");
          submitSelector =
            'button[data-testid="login-submit-button"], button[type="submit"]';
          await page.waitForSelector(submitSelector, { timeout: 5000 });
        }

        this.logger.log("Submitting login form...");

        try {
          const beforeScreenshot = await page.screenshot({
            encoding: "base64",
          });
          this.logger.debug(
            `Screenshot before login submission captured (${String(beforeScreenshot.length)} chars)`,
          );
        } catch {
          this.logger.debug("Could not capture before-login screenshot");
        }

        await Promise.all([
          page.waitForNavigation({
            waitUntil: "networkidle2",
            timeout: 45_000,
          }),
          page.click(submitSelector),
        ]);

        await new Promise((resolve) => setTimeout(resolve, 5000));

        const currentUrl = page.url();
        this.logger.log(`After login, current URL: ${currentUrl}`);

        if (
          currentUrl.includes("/logowanie") ||
          currentUrl.includes("/login")
        ) {
          const errorMessage = await page
            .evaluate(() => {
              const selectors = [
                '[data-cy*="error"]',
                ".error-message",
                ".alert-error",
                '[class*="error"]',
                '[role="alert"]',
              ];

              for (const selector of selectors) {
                const errorElement = document.querySelector(selector);
                const textContent = errorElement?.textContent ?? null;
                if (textContent !== null) {
                  return textContent.trim();
                }
              }
              return null;
            })
            .catch(() => null);

          const error =
            errorMessage !== null && errorMessage !== ""
              ? new Error(`Login failed: ${errorMessage}`)
              : new Error("Login failed: Still on login page after submission");
          throw error;
        }

        this.logger.log("Login successful, extracting cookies...");

        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const cookies = await page.cookies();

        const sessionCookie = cookies.find(
          (c) =>
            c.name.toLowerCase().includes("session") ||
            c.name.toLowerCase().includes("auth") ||
            c.name.toLowerCase().includes("token"),
        );

        const authData: OtodomAuthCookies = {
          cookies,
          expiresAt: Date.now() + this.COOKIE_TTL * 1000,
          sessionId: sessionCookie?.value,
        };

        this.logger.log(
          `Successfully authenticated to Otodom. Got ${String(cookies.length)} cookies.`,
        );
        this.logger.log(
          `Cookie names: ${cookies.map((c) => c.name).join(", ")}`,
        );
        if (sessionCookie !== undefined) {
          this.logger.log(
            `Session cookie: ${sessionCookie.name} (${sessionCookie.value.slice(0, 10)}...)`,
          );
        }

        return authData;
      } catch (error) {
        this.logger.error(
          `Error during login form interaction: ${error instanceof Error ? error.message : "Unknown error"}`,
        );

        try {
          const screenshot = await page.screenshot({ encoding: "base64" });
          this.logger.debug(
            `Login page screenshot captured (${String(screenshot.length)} chars)`,
          );

          const htmlContent = await page.content();
          const debugDirectory = path.join(process.cwd(), "debug");

          if (!fs.existsSync(debugDirectory)) {
            fs.mkdirSync(debugDirectory, { recursive: true });
          }

          const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
          fs.writeFileSync(
            path.join(debugDirectory, `otodom-login-${timestamp}.html`),
            htmlContent,
          );
          fs.writeFileSync(
            path.join(debugDirectory, `otodom-login-${timestamp}.png`),
            Buffer.from(screenshot, "base64"),
          );

          this.logger.debug(
            `Debug files saved to ${debugDirectory}/otodom-login-${timestamp}.*`,
          );
        } catch {
          this.logger.debug("Could not capture screenshot or HTML");
        }

        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Otodom login failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return null;
    } finally {
      if (browser !== undefined) {
        await browser.close();
      }
    }
  }

  private async getCachedAuth(): Promise<OtodomAuthCookies | null> {
    try {
      const cached = await this.redis.get(this.REDIS_KEY);
      if (cached === null || cached === "") {
        return null;
      }

      const auth = JSON.parse(cached) as OtodomAuthCookies;
      return auth;
    } catch (error) {
      this.logger.warn(
        `Error getting cached auth: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return null;
    }
  }

  private async cacheAuth(auth: OtodomAuthCookies): Promise<void> {
    try {
      await this.redis.setex(
        this.REDIS_KEY,
        this.COOKIE_TTL,
        JSON.stringify(auth),
      );
      this.logger.log("Cached Otodom authentication in Redis");
    } catch (error) {
      this.logger.warn(
        `Error caching auth: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private isAuthValid(auth: OtodomAuthCookies): boolean {
    return auth.expiresAt > Date.now();
  }

  async applyCookiesToPage(page: Page): Promise<boolean> {
    try {
      const auth = await this.ensureAuthenticated();
      if (auth === null) {
        this.logger.debug("No valid authentication available");
        return false;
      }

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      await page.setCookie(...auth.cookies);
      this.logger.debug(
        `Applied ${String(auth.cookies.length)} cookies to page for authentication`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error applying cookies: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return false;
    }
  }

  async getCookiesForWorker(): Promise<Cookie[] | null> {
    try {
      const auth = await this.ensureAuthenticated();
      return auth?.cookies ?? null;
    } catch (error) {
      this.logger.error(
        `Error getting cookies for worker: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return null;
    }
  }

  async clearAuth(): Promise<void> {
    try {
      await this.redis.del(this.REDIS_KEY);
      await this.redis.del(this.REDIS_SESSION_KEY);
      this.logger.log("Cleared cached Otodom authentication");
    } catch (error) {
      this.logger.warn(
        `Error clearing auth: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async forceReauth(): Promise<OtodomAuthCookies | null> {
    await this.clearAuth();
    return this.ensureAuthenticated();
  }

  async getAuthStatus(): Promise<{
    configured: boolean;
    authenticated: boolean;
    expiresAt?: number;
    cookieCount?: number;
  }> {
    const configured = this.isAuthConfigured();

    if (!configured) {
      return { configured: false, authenticated: false };
    }

    const auth = await this.getCachedAuth();

    if (auth === null || !this.isAuthValid(auth)) {
      return { configured: true, authenticated: false };
    }

    return {
      configured: true,
      authenticated: true,
      expiresAt: auth.expiresAt,
      cookieCount: auth.cookies.length,
    };
  }
}
