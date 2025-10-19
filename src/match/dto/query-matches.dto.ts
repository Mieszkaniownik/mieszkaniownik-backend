import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Min } from "class-validator";

import { ApiPropertyOptional } from "@nestjs/swagger";

export enum MatchSortBy {
  NEWEST = "newest",
  OLDEST = "oldest",
  PRICE_LOW = "price-low",
  PRICE_HIGH = "price-high",
  FOOTAGE_LOW = "footage-low",
  FOOTAGE_HIGH = "footage-high",
  SCORE_HIGH = "score-high",
  SCORE_LOW = "score-low",
}

export class QueryMatchesDto {
  @ApiPropertyOptional({
    description: "Sort matches by field",
    enum: MatchSortBy,
    default: MatchSortBy.NEWEST,
  })
  @IsOptional()
  @IsEnum(MatchSortBy)
  sortBy?: MatchSortBy = MatchSortBy.NEWEST;

  @ApiPropertyOptional({
    description: "Filter by specific alert ID",
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  alertId?: number;

  @ApiPropertyOptional({
    description: "Page number for pagination",
    type: Number,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Number of items per page",
    type: Number,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
