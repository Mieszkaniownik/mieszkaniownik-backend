import { Module, forwardRef } from '@nestjs/common';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';
import { DatabaseModule } from '../database/database.module';
import { AlertModule } from '../alert/alert.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [DatabaseModule, AlertModule, forwardRef(() => NotificationModule)],
  controllers: [MatchController],
  providers: [MatchService],
  exports: [MatchService],
})
export class MatchModule {}
