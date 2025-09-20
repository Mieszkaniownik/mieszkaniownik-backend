import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { DatabaseModule } from '../database/database.module';
import { AuthService } from "../auth/auth.service";
import { RoleGuard } from "../auth/roles/role.guard";

@Module({
  controllers: [UserController],
  providers: [UserService, AuthService, RoleGuard],
  imports: [DatabaseModule],
  exports: [UserService],
})
export class UserModule {}
