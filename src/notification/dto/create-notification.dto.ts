import { IsString, IsNotEmpty, IsEnum, IsInt } from 'class-validator';
import { NotificationMethod } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty()
  @IsEnum(NotificationMethod)
  method: NotificationMethod;

  @ApiProperty()
  @IsInt()
  userId: number;

  @ApiProperty()
  @IsInt()
  alertId: number;
}
