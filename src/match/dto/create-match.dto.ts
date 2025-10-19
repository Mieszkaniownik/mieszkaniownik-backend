import { IsBoolean, IsInt, IsOptional } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

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
