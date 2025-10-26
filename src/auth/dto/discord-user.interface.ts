export interface DiscordUser {
  discordId: string;
  email: string;
  name?: string;
  surname?: string;
  username?: string;
  avatar?: string;
  accessToken?: string;
  refreshToken?: string;
}
