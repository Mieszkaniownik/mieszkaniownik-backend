import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { AnalyseController } from "./analyse.controller";
import { AnalyseService } from "./analyse.service";

@Module({
  imports: [DatabaseModule],
  controllers: [AnalyseController],
  providers: [AnalyseService],
  exports: [AnalyseService],
})
export class AnalyseModule {}
