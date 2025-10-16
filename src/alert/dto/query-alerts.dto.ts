import { IsOptional, IsEnum, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AlertStatus } from '@prisma/client';

export enum AlertSortBy {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  MATCHES = 'matches',
  NAME = 'name',
}

export class QueryAlertsDto {
  @ApiPropertyOptional({
    description: 'Filter by alert status',
    enum: AlertStatus,
  })
  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;

  @ApiPropertyOptional({
    description: 'Sort alerts by field',
    enum: AlertSortBy,
    default: AlertSortBy.NEWEST,
  })
  @IsOptional()
  @IsEnum(AlertSortBy)
  sortBy?: AlertSortBy = AlertSortBy.NEWEST;

  @ApiPropertyOptional({
    description: 'Filter by city',
    type: String,
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Search by alert name',
    type: String,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Number of items to return',
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
