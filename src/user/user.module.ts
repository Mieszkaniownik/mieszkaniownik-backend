import { Module, forwardRef } from '@nestjs/common';

import { CoreModule } from '../core/core.module';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { DatabaseModule } from '../database/database.module';
import { AuthService } from '../auth/auth.service';
import { RoleGuard } from '../auth/roles/role.guard';
import { AuthGuard } from '../auth/auth.guard';

@Module({
  controllers: [UserController],
  providers: [UserService, AuthService, AuthGuard, RoleGuard],
  imports: [forwardRef(() => DatabaseModule), CoreModule],
  exports: [UserService],
})
export class UserModule {}
