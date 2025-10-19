import { Module, forwardRef } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { AuthService } from "../auth/auth.service";
import { RoleGuard } from "../auth/roles/role.guard";
import { CoreModule } from "../core/core.module";
import { UserModule } from "../user/user.module";
import { DatabaseController } from "./database.controller";
import { DatabaseService } from "./database.service";

@Module({
  providers: [DatabaseService, AuthService, AuthGuard, RoleGuard],
  controllers: [DatabaseController],
  exports: [DatabaseService],
  imports: [forwardRef(() => UserModule), CoreModule],
})
export class DatabaseModule {}
