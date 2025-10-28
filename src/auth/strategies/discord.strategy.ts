import { Strategy as OAuth2Strategy } from "passport-oauth2";
import type { VerifyCallback } from "passport-oauth2";

import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";

interface DiscordProfile {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  global_name?: string;
  discriminator: string;
  verified?: boolean;
}

@Injectable()
export class DiscordStrategy extends PassportStrategy(OAuth2Strategy, "discord") {
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
      authorizationURL: "https://discord.com/api/oauth2/authorize",
      tokenURL: "https://discord.com/api/oauth2/token",
      clientID,
      clientSecret,
      callbackURL:
        process.env.DISCORD_CALLBACK_URL ??
        "http://localhost:5001/auth/discord/callback",
      scope: ["identify", "email"],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    _profile: unknown,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const response = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Discord API error: ${response.statusText}`);
      }

      const discordProfile = (await response.json()) as DiscordProfile;

      const id = discordProfile.id;
      const username = discordProfile.username;
      const email = discordProfile.email;
      const avatar = discordProfile.avatar;

      const globalName = discordProfile.global_name;
      let name: string | undefined;
      let surname: string | undefined;

      if (globalName !== undefined && globalName !== "") {
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
