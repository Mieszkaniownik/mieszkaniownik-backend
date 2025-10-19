import { BuildingType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class AnalyseQueryDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  minViews?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  maxViews?: number;

  @IsOptional()
  @IsEnum(BuildingType)
  buildingType?: BuildingType;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  minPricePerSqm?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  maxPricePerSqm?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  minFootage?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  maxFootage?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  minRooms?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  maxRooms?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  alertId?: number;
}
