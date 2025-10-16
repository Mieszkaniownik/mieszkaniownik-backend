import {
  IsString,
  IsNumber,
  IsInt,
  IsBoolean,
  IsDate,
  IsOptional,
  Min,
  Max,
  IsIn,
  IsNotEmpty,
  IsArray,
} from 'class-validator';
import { OwnerType, BuildingType, ParkingType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateOfferDto {
  @ApiProperty({ description: 'Unique link to the offer' })
  @IsString()
  @IsNotEmpty()
  link: string;

  @ApiProperty({ description: 'Title of the offer' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Price in PLN' })
  @IsNumber()
  @Min(0)
  @Max(10000000)
  price: number;

  @ApiProperty({ description: 'City where the offer is located' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({ description: 'District within the city' })
  @IsString()
  @IsOptional()
  district?: string;

  @ApiPropertyOptional({ description: 'Footage in square meters' })
  @IsNumber()
  @Min(0)
  @Max(1000)
  @IsOptional()
  footage?: number;

  @ApiPropertyOptional({ description: 'Description of the offer' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'AI-generated summary' })
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiPropertyOptional({ description: 'Street name' })
  @IsString()
  @IsOptional()
  street?: string;

  @ApiPropertyOptional({ description: 'Street number' })
  @IsString()
  @IsOptional()
  streetNumber?: string;

  @ApiPropertyOptional({ description: 'Latitude coordinate' })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude coordinate' })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ description: 'Type of owner' })
  @IsIn(Object.values(OwnerType))
  @IsOptional()
  ownerType?: OwnerType;

  @ApiPropertyOptional({ description: 'Type of building' })
  @IsIn(Object.values(BuildingType))
  @IsOptional()
  buildingType?: BuildingType;

  @ApiPropertyOptional({ description: 'Type of parking' })
  @IsIn(Object.values(ParkingType))
  @IsOptional()
  parkingType?: ParkingType;

  @ApiPropertyOptional({ description: 'Number of rooms' })
  @IsInt()
  @Min(0)
  @Max(10)
  @IsOptional()
  rooms?: number;

  @ApiPropertyOptional({ description: 'Floor number' })
  @IsInt()
  @Min(0)
  @Max(50)
  @IsOptional()
  floor?: number;

  @ApiPropertyOptional({ description: 'Has elevator' })
  @IsBoolean()
  @IsOptional()
  elevator?: boolean;

  @ApiPropertyOptional({ description: 'Is furnished' })
  @IsBoolean()
  @IsOptional()
  furniture?: boolean;

  @ApiPropertyOptional({ description: 'Pets allowed' })
  @IsBoolean()
  @IsOptional()
  pets?: boolean;

  @ApiPropertyOptional({ description: 'Additional rent (czynsz)' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  rentAdditional?: number;

  @ApiPropertyOptional({ description: 'Price is negotiable' })
  @IsBoolean()
  @IsOptional()
  negotiable?: boolean;

  @ApiPropertyOptional({ description: 'Contact information' })
  @IsString()
  @IsOptional()
  contact?: string;

  @ApiPropertyOptional({ description: 'Number of views' })
  @IsInt()
  @Min(0)
  @IsOptional()
  views?: number;

  @ApiPropertyOptional({ description: 'Creation date' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  createdAt?: Date;

  @ApiProperty({ description: 'Source of the offer (olx, otodom, etc.)' })
  @IsString()
  @IsNotEmpty()
  source: string;

  @ApiPropertyOptional({ description: 'Is this a new offer' })
  @IsBoolean()
  @IsOptional()
  isNew?: boolean;

  @ApiPropertyOptional({ description: 'Array of image URLs' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ApiPropertyOptional({ description: 'Additional information' })
  @IsString()
  @IsOptional()
  infoAdditional?: string;

  @ApiPropertyOptional({ description: 'Media information' })
  @IsString()
  @IsOptional()
  media?: string;

  @ApiPropertyOptional({ description: 'Furnishing details' })
  @IsString()
  @IsOptional()
  furnishing?: string;
}

export function dtoToString(dto: CreateOfferDto): string {
  return `
Link: ${dto.link}
Title: ${dto.title}
Price: ${dto.price}
Footage: ${dto.footage ?? 'N/A'}
Rooms: ${dto.rooms ?? 'N/A'}
City: ${dto.city}
District: ${dto.district ?? 'N/A'}
Street: ${dto.street ?? 'N/A'}
Street Number: ${dto.streetNumber ?? 'N/A'}
Building Type: ${dto.buildingType ?? 'N/A'}
Owner Type: ${dto.ownerType ?? 'N/A'}
Furniture: ${dto.furniture !== undefined ? dto.furniture : 'N/A'}
Negotiable: ${dto.negotiable !== undefined ? dto.negotiable : 'N/A'}
Pets allowed: ${dto.pets !== undefined ? dto.pets : 'N/A'}
Floor: ${dto.floor ?? 'N/A'}
Elevator: ${dto.elevator !== undefined ? dto.elevator : 'N/A'}
Source: ${dto.source}
Views: ${dto.views ?? 0}
`.trim();
}
