import {
  BuildingType,
  AlertStatus,
  NotificationMethod,
  OwnerType,
  ParkingType,
} from '@prisma/client';

export class AlertResponseDto {
  id: number;
  name: string;
  city: string;
  district?: string;
  maxPrice?: number;
  minPrice?: number;
  maxFootage?: number;
  minFootage?: number;
  maxRooms?: number;
  minRooms?: number;
  maxFloor?: number;
  minFloor?: number;
  ownerType?: OwnerType;
  buildingType?: BuildingType;
  parkingType?: ParkingType;
  elevator?: boolean;
  furniture?: boolean;
  pets?: boolean;
  keywords?: string[];
  discordWebhook?: string;
  notificationMethod: NotificationMethod;
  status: AlertStatus;
  createdAt: Date;
  updatedAt: Date;
  matchesCount: number;
  userId: number;
}
