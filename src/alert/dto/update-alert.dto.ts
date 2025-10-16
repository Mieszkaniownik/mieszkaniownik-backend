import { PartialType } from '@nestjs/mapped-types';
import { AlertStatus } from '@prisma/client';
import { CreateAlertDto } from './create-alert.dto';
import { IsOptional, IsInt, IsEnum, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateAlertDto extends PartialType(CreateAlertDto) {
  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;

  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(String(value)) : 0))
  @IsInt()
  @Min(0)
  matchesCount?: number;
}
