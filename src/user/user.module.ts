import { Module, forwardRef } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { AuthService } from "../auth/auth.service";
import { RoleGuard } from "../auth/roles/role.guard";
import { CoreModule } from "../core/core.module";
import { DatabaseModule } from "../database/database.module";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

@Module({
  controllers: [UserController],
  providers: [UserService, AuthService, AuthGuard, RoleGuard],
  imports: [forwardRef(() => DatabaseModule), CoreModule],
  exports: [UserService],
})
export class UserModule {}
