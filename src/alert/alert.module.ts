import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { AlertController } from "./alert.controller";
import { AlertService } from "./alert.service";

@Module({
  imports: [DatabaseModule],
  controllers: [AlertController],
  providers: [AlertService],
  exports: [AlertService],
})
export class AlertModule {}
