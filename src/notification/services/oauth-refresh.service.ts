/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";

import { Injectable, Logger } from "@nestjs/common";

interface OAuthTokens {
  accessToken?: string | null;
  refreshToken?: string | null;
  expiryDate?: number | null;
}

@Injectable()
export class OAuthRefreshService {
  private readonly logger = new Logger(OAuthRefreshService.name);
  private oauth2Client: OAuth2Client | null = null;
  private tokenRefreshInterval: NodeJS.Timeout | null = null;
  private currentTokens: OAuthTokens = {};

  constructor() {
    this.initializeOAuthClient();
  }

  private initializeOAuthClient(): void {
    const clientId = process.env.EMAIL_OAUTH_CLIENT_ID;
    const clientSecret = process.env.EMAIL_OAUTH_CLIENT_SECRET;

    if (
      clientId === undefined ||
      clientId === "" ||
      clientSecret === undefined ||
      clientSecret === ""
    ) {
      this.logger.warn(
        "Gmail OAuth credentials not configured - token refresh disabled",
      );
      return;
    }

    try {
      this.oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        "https://developers.google.com/oauthplayground",
      );

      const refreshToken = process.env.EMAIL_OAUTH_REFRESH_TOKEN;
      if (
        refreshToken !== undefined &&
        refreshToken !== "" &&
        this.oauth2Client !== null
      ) {
        this.oauth2Client.setCredentials({
          refresh_token: process.env.EMAIL_OAUTH_REFRESH_TOKEN,
        });
      }

      this.logger.log("OAuth2 client initialized successfully");

      this.startTokenRefreshMonitoring();
    } catch (error) {
      this.logger.error(
        "Failed to initialize OAuth2 client:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.oauth2Client) {
      this.logger.warn("OAuth2 client not initialized");
      return null;
    }

    try {
      const fiveMinutesInMs = 300_000;
      if (
        this.currentTokens.accessToken &&
        this.currentTokens.expiryDate &&
        Date.now() < this.currentTokens.expiryDate - fiveMinutesInMs
      ) {
        this.logger.debug("Using cached access token");
        return this.currentTokens.accessToken;
      }

      this.logger.log("Refreshing OAuth access token...");
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      this.currentTokens = {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token,
        expiryDate: credentials.expiry_date,
      };

      this.logger.log(
        `Access token refreshed successfully. Expires at: ${credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : "unknown"}`,
      );

      if (credentials.access_token) {
        process.env.EMAIL_OAUTH_ACCESS_TOKEN = credentials.access_token;
      }

      return credentials.access_token ?? null;
    } catch (error) {
      this.logger.error(
        "Failed to refresh access token:",
        error instanceof Error ? error.message : String(error),
      );

      if (error instanceof Error && error.message.includes("invalid_grant")) {
        this.logger.error(
          "CRITICAL: Refresh token is invalid or expired. Please generate a new refresh token!",
        );
        this.logger.error(
          "Visit https://developers.google.com/oauthplayground to generate new tokens",
        );
      }

      return null;
    }
  }

  private async proactiveRefresh(): Promise<void> {
    try {
      const token = await this.getAccessToken();
      if (token) {
        this.logger.debug("Proactive token refresh completed");
      } else {
        this.logger.warn("Proactive token refresh failed");
      }
    } catch (error) {
      this.logger.error(
        "Error during proactive token refresh:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private startTokenRefreshMonitoring(): void {
    const refreshIntervalMinutes = 45;
    const msPerMinute = 60 * 1000;
    const refreshIntervalMs = refreshIntervalMinutes * msPerMinute;

    void this.proactiveRefresh();

    this.tokenRefreshInterval = setInterval(() => {
      void this.proactiveRefresh();
    }, refreshIntervalMs);

    this.logger.log(
      `Token refresh monitoring started (interval: ${String(refreshIntervalMinutes)} minutes)`,
    );
  }

  async getTokenStatus(): Promise<{
    configured: boolean;
    hasValidToken: boolean;
    expiresAt?: Date;
    expiresInMinutes?: number;
  }> {
    const configured = Boolean(
      this.oauth2Client && process.env.EMAIL_OAUTH_REFRESH_TOKEN,
    );

    if (!configured) {
      return { configured: false, hasValidToken: false };
    }

    const token = await this.getAccessToken();
    const hasValidToken = Boolean(token);

    if (this.currentTokens.expiryDate) {
      const expiresAt = new Date(this.currentTokens.expiryDate);
      const msPerMinute = 60_000;
      const expiresInMinutes = Math.floor(
        (this.currentTokens.expiryDate - Date.now()) / msPerMinute,
      );

      return {
        configured,
        hasValidToken,
        expiresAt,
        expiresInMinutes,
      };
    }

    return { configured, hasValidToken };
  }

  async forceRefresh(): Promise<string | null> {
    this.logger.log("Forcing token refresh...");
    this.currentTokens = {};
    return await this.getAccessToken();
  }

  isConfigured(): boolean {
    return Boolean(
      this.oauth2Client &&
        process.env.EMAIL_OAUTH_CLIENT_ID &&
        process.env.EMAIL_OAUTH_CLIENT_SECRET &&
        process.env.EMAIL_OAUTH_REFRESH_TOKEN,
    );
  }

  onModuleDestroy(): void {
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.logger.log("Token refresh monitoring stopped");
    }
  }
}
