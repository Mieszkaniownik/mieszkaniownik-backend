export class MatchResponseDto {
  id: number;
  alertId: number;
  offerId: number;
  matchedAt: Date;
  notificationSent: boolean;
  alert?: {
    id: number;
    name: string;
    city: string;
  };
  offer?: {
    id: number;
    title: string;
    price: number;
    city: string;
    link: string;
  };
}
