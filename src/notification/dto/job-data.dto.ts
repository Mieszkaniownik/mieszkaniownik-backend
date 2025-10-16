export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  notificationId: number;
}

export interface DiscordJobData {
  webhookUrl: string;
  content: string;
  embeds?: Array<{
    title: string;
    description: string;
    color?: number;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
    image?: {
      url: string;
    };
  }>;
  notificationId: number;
}

export interface MatchNotificationData {
  matchId: number;
  alertId: number;
  offerId: number;
  userId: number;
}
