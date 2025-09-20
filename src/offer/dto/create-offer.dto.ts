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
  IsNotEmpty
} from 'class-validator';
import { Listing_type } from "@prisma/client";
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOfferDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  link: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(10000000)
  price: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  @IsOptional()
  footage?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  @IsOptional()
  rooms?: number;

  @ApiPropertyOptional()
  @IsDate()
  added_at?: Date;

  @ApiPropertyOptional()
  @IsDate()
  @IsOptional()
  udpated_at?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  valid_to?: Date;

  @ApiPropertyOptional()
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional()
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional()
  @IsIn(Object.values(Listing_type))
  @IsOptional()
  type?: Listing_type;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  furniture?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  negotiable?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  pets_allowed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  floor?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  elevator?: boolean;
}
export function dto_toString(dto: CreateOfferDto): string {
  return `
Link: ${dto.link}
Price: ${dto.price}
Footage: ${dto.footage}
Rooms: ${dto.rooms ?? 'N/A'}
Added at: ${dto.added_at.toISOString()}
Updated at: ${dto.udpated_at?.toISOString() ?? 'N/A'}
Valid to: ${dto.valid_to?.toISOString() ?? 'N/A'}
City: ${dto.city}
Address: ${dto.address}
Type: ${dto.type ?? 'N/A'}
Furniture: ${dto.furniture !== undefined ? dto.furniture : 'N/A'}
Negotiable: ${dto.negotiable !== undefined ? dto.negotiable : 'N/A'}
Pets allowed: ${dto.pets_allowed !== undefined ? dto.pets_allowed : 'N/A'}
Floor: ${dto.floor ?? 'N/A'}
Elevator: ${dto.elevator !== undefined ? dto.elevator : 'N/A'}
`.trim();
}
