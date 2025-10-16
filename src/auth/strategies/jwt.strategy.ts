import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '@prisma/client';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'mieszkaniownik-jwt-secret',
    });
  }

  async validate(payload: { email: string; sub: string; role: Role }) {
    console.log('JWT Strategy payload:', payload);
    const user = await this.authService.validateToken(payload);
    console.log('JWT Strategy validated user:', user);
    return { ...user, role: payload.role };
  }
}
