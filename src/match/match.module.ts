import { Module, forwardRef } from "@nestjs/common";

import { AlertModule } from "../alert/alert.module";
import { DatabaseModule } from "../database/database.module";
import { NotificationModule } from "../notification/notification.module";
import { MatchController } from "./match.controller";
import { MatchService } from "./match.service";

@Module({
  imports: [DatabaseModule, AlertModule, forwardRef(() => NotificationModule)],
  controllers: [MatchController],
  providers: [MatchService],
  exports: [MatchService],
})
export class MatchModule {}
