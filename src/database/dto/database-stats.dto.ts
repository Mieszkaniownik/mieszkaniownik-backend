import { ApiProperty } from "@nestjs/swagger";

export class DatabaseStatsDto {
  @ApiProperty()
  users: number;

  @ApiProperty()
  offers: number;

  @ApiProperty()
  alerts: number;

  @ApiProperty()
  matches: number;

  @ApiProperty()
  notifications: number;

  @ApiProperty()
  timestamp: Date;
}
