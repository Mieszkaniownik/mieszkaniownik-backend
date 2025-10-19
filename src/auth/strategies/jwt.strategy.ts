import { Role } from "@prisma/client";
import { ExtractJwt, Strategy } from "passport-jwt";

import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";

import { AuthService } from "../auth.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: "mieszkaniownik-jwt-secret",
    });
  }

  async validate(payload: { email: string; sub: string; role: Role }) {
    const user = await this.authService.validateToken(payload);
    return Object.assign({}, user, { role: payload.role });
  }
}
