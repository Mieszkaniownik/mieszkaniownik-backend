import { Strategy, VerifyCallback } from "passport-google-oauth20";

import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor() {
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (
      clientID === undefined ||
      clientID === "" ||
      clientSecret === undefined ||
      clientSecret === ""
    ) {
      throw new Error(`
        Google OAuth configuration missing!
      `);
    }

    super({
      clientID,
      clientSecret,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ??
        "http://localhost:5001/auth/google/callback",
      scope: ["email", "profile"],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: unknown,
    done: VerifyCallback,
  ): void {
    try {
      const profileData = profile as Record<string, unknown>;
      const id = profileData.id;
      const name = profileData.name as Record<string, unknown> | undefined;
      const emails = profileData.emails as
        | Record<string, unknown>[]
        | undefined;
      const photos = profileData.photos as
        | Record<string, unknown>[]
        | undefined;

      const emailValue = emails?.[0]?.value;
      const pictureValue = photos?.[0]?.value;

      const user = {
        googleId: String(id),
        email: typeof emailValue === "string" ? emailValue : "",
        name:
          name?.givenName !== undefined && typeof name.givenName === "string"
            ? name.givenName
            : undefined,
        surname:
          name?.familyName !== undefined && typeof name.familyName === "string"
            ? name.familyName
            : undefined,
        picture: typeof pictureValue === "string" ? pictureValue : undefined,
        accessToken,
        refreshToken,
      };

      if (user.googleId === "" || user.email === "") {
        done(new Error("Missing required profile information"), false);
        return;
      }

      done(null, user);
    } catch (error) {
      done(error as Error, false);
    }
  }
}
