import { AlertStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Min } from "class-validator";

import { PartialType } from "@nestjs/mapped-types";

import { CreateAlertDto } from "./create-alert.dto";

export class UpdateAlertDto extends PartialType(CreateAlertDto) {
  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== null && value !== ""
      ? Number.parseInt(String(value))
      : 0,
  )
  @IsInt()
  @Min(0)
  matchesCount?: number;
}
