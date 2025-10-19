import {
  Controller,
  Get,
  Logger,
  Query,
  Req,
  SetMetadata,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { UserRequest } from "../auth/dto/user-request";
import { AnalyseService } from "./analyse.service";
import { AnalyseQueryDto } from "./dto/analyse-query.dto";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@ApiTags("analyse")
@ApiBearerAuth()
@Controller("analyse")
@UseGuards(AuthGuard)
export class AnalyseController {
  private readonly logger = new Logger(AnalyseController.name);

  constructor(private readonly analyseService: AnalyseService) {}

  @Get("offers")
  @Public()
  @ApiOperation({
    summary: "Get analyzed offer data with statistics",
    description: "Returns analyzed offers with computed metrics.",
  })
  @ApiOkResponse({
    description: "Successfully retrieved analyzed offer data",
  })
  async getAnalyzedOffers(@Query() query: AnalyseQueryDto) {
    try {
      this.logger.log("Analyse offers requested with filters:", query);

      const analyzedData = await this.analyseService.analyseOffers(query);

      this.logger.log(
        `Returning ${String(analyzedData.offers.length)} analyzed offers`,
      );

      return {
        success: true,
        data: analyzedData,
        message: `Analyzed ${String(analyzedData.offers.length)} offers`,
      };
    } catch (error) {
      this.logger.error("Error analyzing offers:", error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  @Get("matches")
  @ApiOperation({
    summary: "Get analyzed data for user matches",
    description:
      "Returns analyzed offers from user's matches with computed metrics and statistics.",
  })
  @ApiOkResponse({
    description: "Successfully retrieved analyzed match data",
  })
  @ApiUnauthorizedResponse({
    description: "Unauthorized - authentication required",
  })
  async getAnalyzedMatches(
    @Query() query: AnalyseQueryDto,
    @Req() request: UserRequest,
  ) {
    try {
      const userId = request.user.id;
      this.logger.log(
        `Analyse matches requested by user ${String(userId)} with filters:`,
        query,
      );

      const analyzedData = await this.analyseService.analyseOffers(
        query,
        userId,
      );

      this.logger.log(
        `Returning ${String(analyzedData.offers.length)} analyzed matches for user ${String(userId)}`,
      );

      return {
        success: true,
        data: analyzedData,
        message: `Analyzed ${String(analyzedData.offers.length)} matches`,
      };
    } catch (error) {
      this.logger.error("Error analyzing user matches:", error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  @Get("stats")
  @Public()
  @ApiOperation({
    summary: "Get data availability statistics",
    description: "Returns statistics about data completeness and quality",
  })
  @ApiOkResponse({
    description: "Successfully retrieved data availability statistics",
  })
  async getDataStats(@Req() request?: UserRequest) {
    try {
      const userId = request?.user.id;

      if (userId === undefined) {
        this.logger.log("Data stats requested for all offers");
      } else {
        this.logger.log(
          `Data stats requested for user ${String(userId)} matches`,
        );
      }

      const stats = await this.analyseService.getDataAvailabilityStats(userId);

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error("Error getting data stats:", error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
