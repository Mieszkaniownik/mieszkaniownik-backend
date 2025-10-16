import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EmailService } from '../services/email.service';

@ApiTags('health')
@Controller('health/email')
export class EmailHealthController {
  constructor(private readonly emailService: EmailService) {}

  @Get()
  @ApiOperation({
    summary: 'Check Email service health status',
  })
  @ApiResponse({
    status: 200,
    description: 'Email health check completed',
  })
  async checkEmailHealth() {
    try {
      const isInitialized = await this.emailService.isTransporterReady();

      return {
        status: isInitialized ? 'healthy' : 'unhealthy',
        service: 'email',
        timestamp: new Date().toISOString(),
        details: {
          transporterReady: isInitialized,
          configuration: this.getEmailConfigStatus(),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'email',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private getEmailConfigStatus() {
    const hasOAuth2Gmail = !!(
      process.env.EMAIL_OAUTH_CLIENT_ID &&
      process.env.EMAIL_OAUTH_CLIENT_SECRET &&
      process.env.EMAIL_OAUTH_REFRESH_TOKEN &&
      process.env.EMAIL_OAUTH_USER
    );

    const hasOAuth2Outlook = !!(
      process.env.OUTLOOK_CLIENT_ID &&
      process.env.OUTLOOK_CLIENT_SECRET &&
      process.env.OUTLOOK_REFRESH_TOKEN &&
      process.env.OUTLOOK_USER
    );

    const hasSMTP = !!(process.env.EMAIL_HOST || process.env.SMTP_HOST);

    return {
      oauth2Gmail: hasOAuth2Gmail,
      oauth2Outlook: hasOAuth2Outlook,
      smtp: hasSMTP,
      fallbackToEthereal: !hasOAuth2Gmail && !hasOAuth2Outlook && !hasSMTP,
    };
  }
}
