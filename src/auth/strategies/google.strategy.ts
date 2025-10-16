import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientID || !clientSecret) {
      throw new Error(`
        Google OAuth configuration missing!
      `);
    }

    super({
      clientID,
      clientSecret,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        'http://localhost:5001/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): void {
    try {
      const { id, name, emails, photos } = profile;

      const user = {
        googleId: String(id),
        email: emails && emails[0] ? String(emails[0].value) : '',
        name: name && name.givenName ? String(name.givenName) : undefined,
        surname: name && name.familyName ? String(name.familyName) : undefined,
        picture: photos && photos[0] ? String(photos[0].value) : undefined,
        accessToken,
        refreshToken,
      };

      if (!user.googleId || !user.email) {
        return done(new Error('Missing required profile information'), false);
      }

      return done(null, user);
    } catch (error) {
      return done(error as Error, false);
    }
  }
}
