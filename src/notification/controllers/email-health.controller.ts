import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { EmailService } from "../services/email.service";
import { OAuthRefreshService } from "../services/oauth-refresh.service";

@ApiTags("health")
@Controller("health/email")
export class EmailHealthController {
  constructor(
    private readonly emailService: EmailService,
    private readonly oauthRefreshService: OAuthRefreshService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Check Email service health status",
  })
  @ApiResponse({
    status: 200,
    description: "Email health check completed",
  })
  async checkEmailHealth() {
    try {
      const isInitialized = await this.emailService.isTransporterReady();
      const oauthStatus = await this.oauthRefreshService.getTokenStatus();

      return {
        status: isInitialized ? "healthy" : "unhealthy",
        service: "email",
        timestamp: new Date().toISOString(),
        details: {
          transporterReady: isInitialized,
          configuration: this.getEmailConfigStatus(),
          oauth: {
            configured: oauthStatus.configured,
            hasValidToken: oauthStatus.hasValidToken,
            expiresAt: oauthStatus.expiresAt,
            expiresInMinutes: oauthStatus.expiresInMinutes,
          },
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        service: "email",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  @Get("oauth/status")
  @ApiOperation({
    summary: "Check OAuth token status",
  })
  @ApiResponse({
    status: 200,
    description: "OAuth token status retrieved",
  })
  async getOAuthStatus() {
    const status = await this.oauthRefreshService.getTokenStatus();
    return {
      ...status,
      timestamp: new Date().toISOString(),
    };
  }

  private getEmailConfigStatus() {
    const hasOAuth2Gmail =
      process.env.EMAIL_OAUTH_CLIENT_ID !== undefined &&
      process.env.EMAIL_OAUTH_CLIENT_ID !== "" &&
      process.env.EMAIL_OAUTH_CLIENT_SECRET !== undefined &&
      process.env.EMAIL_OAUTH_CLIENT_SECRET !== "" &&
      process.env.EMAIL_OAUTH_REFRESH_TOKEN !== undefined &&
      process.env.EMAIL_OAUTH_REFRESH_TOKEN !== "" &&
      process.env.EMAIL_OAUTH_USER !== undefined &&
      process.env.EMAIL_OAUTH_USER !== "";

    const hasOAuth2Outlook =
      process.env.OUTLOOK_CLIENT_ID !== undefined &&
      process.env.OUTLOOK_CLIENT_ID !== "" &&
      process.env.OUTLOOK_CLIENT_SECRET !== undefined &&
      process.env.OUTLOOK_CLIENT_SECRET !== "" &&
      process.env.OUTLOOK_REFRESH_TOKEN !== undefined &&
      process.env.OUTLOOK_REFRESH_TOKEN !== "" &&
      process.env.OUTLOOK_USER !== undefined &&
      process.env.OUTLOOK_USER !== "";

    const hasSMTP =
      (process.env.EMAIL_HOST !== undefined && process.env.EMAIL_HOST !== "") ||
      (process.env.SMTP_HOST !== undefined && process.env.SMTP_HOST !== "");

    return {
      oauth2Gmail: hasOAuth2Gmail,
      oauth2Outlook: hasOAuth2Outlook,
      smtp: hasSMTP,
      fallbackToEthereal: !hasOAuth2Gmail && !hasOAuth2Outlook && !hasSMTP,
    };
  }
}
