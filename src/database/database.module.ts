import { Module, forwardRef } from '@nestjs/common';

import { AuthService } from '../auth/auth.service';
import { CoreModule } from '../core/core.module';
import { RoleGuard } from '../auth/roles/role.guard';
import { UserModule } from '../user/user.module';
import { DatabaseController } from './database.controller';
import { DatabaseService } from './database.service';
import { AuthGuard } from '../auth/auth.guard';

@Module({
  providers: [DatabaseService, AuthService, AuthGuard, RoleGuard],
  controllers: [DatabaseController],
  exports: [DatabaseService],
  imports: [forwardRef(() => UserModule), CoreModule],
})
export class DatabaseModule {}
