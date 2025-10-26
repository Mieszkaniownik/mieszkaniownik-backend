import type { Profile } from "passport-discord";
import { Strategy } from "passport-discord";
import type { VerifyCallback } from "passport-oauth2";

import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, "discord") {
  constructor() {
    const clientID = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;

    if (
      clientID === undefined ||
      clientID === "" ||
      clientSecret === undefined ||
      clientSecret === ""
    ) {
      throw new Error(`
        Discord OAuth configuration missing!
      `);
    }

    super({
      clientID,
      clientSecret,
      callbackURL:
        process.env.DISCORD_CALLBACK_URL ??
        "http://localhost:5001/auth/discord/callback",
      scope: ["identify", "email"],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    try {
      const id = profile.id;
      const username = profile.username;
      const email = profile.email;
      const avatar = profile.avatar;

      const globalName = profile.global_name;
      let name: string | undefined;
      let surname: string | undefined;

      if (globalName !== null) {
        const nameParts = globalName.split(" ");
        name = nameParts[0];
        surname =
          nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;
      }

      const user = {
        discordId: id,
        email: email ?? "",
        username,
        name,
        surname,
        avatar,
        accessToken,
        refreshToken,
      };

      if (user.discordId === "" || user.email === "") {
        done(new Error("Missing required profile information"));
        return;
      }

      done(null, user);
    } catch (error) {
      done(error as Error);
    }
  }
}
