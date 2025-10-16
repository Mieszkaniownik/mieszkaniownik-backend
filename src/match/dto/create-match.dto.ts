import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsBoolean, IsOptional } from 'class-validator';

export class CreateMatchDto {
  @ApiProperty()
  @IsInt()
  alertId: number;

  @ApiProperty()
  @IsInt()
  offerId: number;

  @IsOptional()
  @IsBoolean()
  notificationSent?: boolean;
}
