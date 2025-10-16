import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { CoreModule } from '../core/core.module';

import { DatabaseModule } from '../database/database.module';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

const providers: any[] = [AuthService, JwtStrategy];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(GoogleStrategy);
} else {
  console.warn(
    'Google OAuth disabled: Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET',
  );
}

@Module({
  controllers: [AuthController],
  providers,
  imports: [
    DatabaseModule,
    UserModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    CoreModule,
  ],
  exports: [AuthService],
})
export class AuthModule {}
