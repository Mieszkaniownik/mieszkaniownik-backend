import {
  BuildingType,
  NotificationMethod,
  OwnerType,
  ParkingType,
} from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class CreateAlertDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== null && value !== ""
      ? Number.parseFloat(String(value))
      : undefined,
  )
  @IsDecimal()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== null && value !== ""
      ? Number.parseFloat(String(value))
      : undefined,
  )
  @IsDecimal()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== null && value !== ""
      ? Number.parseFloat(String(value))
      : undefined,
  )
  @IsDecimal()
  @Min(0)
  maxFootage?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== null && value !== ""
      ? Number.parseFloat(String(value))
      : undefined,
  )
  @IsDecimal()
  @Min(0)
  minFootage?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== null && value !== ""
      ? Number.parseInt(String(value))
      : undefined,
  )
  @IsInt()
  @Min(1)
  @Max(20)
  maxRooms?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== null && value !== ""
      ? Number.parseInt(String(value))
      : undefined,
  )
  @IsInt()
  @Min(1)
  @Max(20)
  minRooms?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== null && value !== ""
      ? Number.parseInt(String(value))
      : undefined,
  )
  @IsInt()
  @Min(0)
  @Max(50)
  maxFloor?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== null && value !== ""
      ? Number.parseInt(String(value))
      : undefined,
  )
  @IsInt()
  @Min(0)
  @Max(50)
  minFloor?: number;

  @IsOptional()
  @IsEnum(OwnerType)
  ownerType?: OwnerType;

  @IsOptional()
  @IsEnum(BuildingType)
  buildingType?: BuildingType;

  @IsOptional()
  @IsEnum(ParkingType)
  parkingType?: ParkingType;

  @IsOptional()
  @IsBoolean()
  elevator?: boolean;

  @IsOptional()
  @IsBoolean()
  furniture?: boolean;

  @IsOptional()
  @IsBoolean()
  pets?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsUrl()
  discordWebhook?: string;

  @IsOptional()
  @IsEnum(NotificationMethod)
  notificationMethod?: NotificationMethod;

  @IsInt()
  @Min(0)
  userId: number;
}
