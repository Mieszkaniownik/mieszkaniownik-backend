import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { DiscordService } from "../services/discord.service";

@ApiTags("health")
@Controller("health/discord")
export class DiscordHealthController {
  constructor(private readonly discordService: DiscordService) {}

  @Get()
  @ApiOperation({
    summary: "Check Discord service health status",
  })
  @ApiResponse({
    status: 200,
    description: "Discord health check completed",
  })
  checkDiscordHealth() {
    try {
      const isConnected = this.discordService.testConnection();

      return {
        status: isConnected ? "healthy" : "unhealthy",
        service: "discord",
        timestamp: new Date().toISOString(),
        details: {
          clientReady: isConnected,
          configuration: this.getDiscordConfigStatus(),
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        service: "discord",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private getDiscordConfigStatus() {
    const hasBotToken = Boolean(process.env.DISCORD_BOT_TOKEN);

    return {
      botToken: hasBotToken,
      fallbackDisabled: !hasBotToken,
    };
  }
}
