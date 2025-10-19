import {
  AlertStatus,
  BuildingType,
  OwnerType,
  ParkingType,
} from "@prisma/client";

import { Injectable, NotFoundException } from "@nestjs/common";

import { DatabaseService } from "../database/database.service";
import { CreateAlertDto } from "./dto/create-alert.dto";
import { AlertSortBy, QueryAlertsDto } from "./dto/query-alerts.dto";
import { UpdateAlertDto } from "./dto/update-alert.dto";

@Injectable()
export class AlertService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(userId: number, createAlertDto: CreateAlertDto) {
    const data = Object.assign({}, createAlertDto, { userId });
    return this.databaseService.alert.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });
  }

  async findAll(userId: number, query?: QueryAlertsDto) {
    const { status, sortBy, city, search, limit } = query ?? {};

    const where = {
      userId,
      status: status ?? { not: AlertStatus.DELETED },
      ...(city !== undefined && city !== "" && { city }),
      ...(search !== undefined &&
        search !== "" && {
          name: {
            contains: search,
            mode: "insensitive" as const,
          },
        }),
    };

    let orderBy: Record<string, string> = { createdAt: "desc" };

    if (sortBy !== undefined) {
      switch (sortBy) {
        case AlertSortBy.NEWEST: {
          orderBy = { createdAt: "desc" };
          break;
        }
        case AlertSortBy.OLDEST: {
          orderBy = { createdAt: "asc" };
          break;
        }
        case AlertSortBy.MATCHES: {
          orderBy = { matchesCount: "desc" };
          break;
        }
        case AlertSortBy.NAME: {
          orderBy = { name: "asc" };
          break;
        }
      }
    }

    return this.databaseService.alert.findMany({
      where,
      include: {
        _count: {
          select: {
            matches: true,
          },
        },
      },
      orderBy,
      ...(limit !== undefined && limit > 0 && { take: limit }),
    });
  }

  async findOne(id: number, userId: number) {
    const alert = await this.databaseService.alert.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
        matches: {
          include: {
            offer: true,
          },
          orderBy: {
            matchedAt: "desc",
          },
        },
        _count: {
          select: {
            matches: true,
          },
        },
      },
    });

    if (alert === null) {
      throw new NotFoundException(`Alert with ID ${String(id)} not found`);
    }

    return alert;
  }

  async update(id: number, userId: number, updateAlertDto: UpdateAlertDto) {
    const alert = await this.databaseService.alert.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (alert === null) {
      throw new NotFoundException(`Alert with ID ${String(id)} not found`);
    }

    return this.databaseService.alert.update({
      where: { id },
      data: updateAlertDto,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });
  }

  async remove(id: number, userId: number) {
    const alert = await this.databaseService.alert.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (alert === null) {
      throw new NotFoundException(`Alert with ID ${String(id)} not found`);
    }

    return this.databaseService.alert.update({
      where: { id },
      data: {
        status: AlertStatus.DELETED,
      },
    });
  }

  async toggleStatus(id: number, userId: number) {
    const alert = await this.findOne(id, userId);

    const newStatus =
      alert.status === AlertStatus.ACTIVE
        ? AlertStatus.PAUSED
        : AlertStatus.ACTIVE;

    return this.databaseService.alert.update({
      where: { id },
      data: {
        status: newStatus,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });
  }

  async getActiveAlerts() {
    return this.databaseService.alert.findMany({
      where: {
        status: AlertStatus.ACTIVE,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });
  }

  checkOfferMatch(
    offer: {
      price?: number;
      city?: string;
      district?: string;
      footage?: number;
      ownerType?: OwnerType;
      buildingType?: BuildingType;
      parkingType?: ParkingType;
      rooms?: number;
      floor?: number;
      furniture?: boolean;
      elevator?: boolean;
      pets?: boolean;
      title?: string;
      description?: string;
    },
    alert: {
      city?: string;
      district?: string;
      minPrice?: number;
      maxPrice?: number;
      minFootage?: number;
      maxFootage?: number;
      minRooms?: number;
      maxRooms?: number;
      minFloor?: number;
      maxFloor?: number;
      ownerType?: OwnerType;
      buildingType?: BuildingType;
      parkingType?: ParkingType;
      elevator?: boolean;
      furniture?: boolean;
      pets?: boolean;
      keywords?: string[];
    },
  ): boolean {
    const hasValidAlertCity =
      alert.city !== undefined && alert.city.trim() !== "";
    if (hasValidAlertCity && offer.city !== alert.city) {
      return false;
    }

    const hasValidAlertDistrict =
      alert.district !== undefined && alert.district.trim() !== "";
    if (hasValidAlertDistrict && offer.district !== alert.district) {
      return false;
    }

    if (
      alert.minPrice !== undefined &&
      offer.price !== undefined &&
      offer.price < alert.minPrice
    ) {
      return false;
    }

    if (
      alert.maxPrice !== undefined &&
      offer.price !== undefined &&
      offer.price > alert.maxPrice
    ) {
      return false;
    }

    if (
      alert.minFootage !== undefined &&
      offer.footage !== undefined &&
      offer.footage < alert.minFootage
    ) {
      return false;
    }

    if (
      alert.maxFootage !== undefined &&
      offer.footage !== undefined &&
      offer.footage > alert.maxFootage
    ) {
      return false;
    }

    if (
      (alert.minRooms !== undefined &&
        offer.rooms !== undefined &&
        offer.rooms < alert.minRooms) ||
      (alert.maxRooms !== undefined &&
        offer.rooms !== undefined &&
        offer.rooms > alert.maxRooms)
    ) {
      return false;
    }

    if (
      (alert.minFloor !== undefined &&
        offer.floor !== undefined &&
        offer.floor < alert.minFloor) ||
      (alert.maxFloor !== undefined &&
        offer.floor !== undefined &&
        offer.floor > alert.maxFloor)
    ) {
      return false;
    }

    if (alert.ownerType !== undefined && offer.ownerType !== alert.ownerType) {
      return false;
    }

    if (
      alert.buildingType !== undefined &&
      offer.buildingType !== alert.buildingType
    ) {
      return false;
    }

    if (
      alert.parkingType !== undefined &&
      offer.parkingType !== alert.parkingType
    ) {
      return false;
    }

    if (alert.furniture !== undefined && offer.furniture !== alert.furniture) {
      return false;
    }

    if (alert.elevator !== undefined && offer.elevator !== alert.elevator) {
      return false;
    }

    if (alert.pets !== undefined && offer.pets !== alert.pets) {
      return false;
    }

    if (alert.keywords !== undefined && alert.keywords.length > 0) {
      const searchText =
        `${offer.title ?? ""} ${offer.description ?? ""}`.toLowerCase();
      const hasMatchingKeyword = alert.keywords.some(
        (keyword) =>
          keyword.toLowerCase().trim() !== "" &&
          searchText.includes(keyword.toLowerCase().trim()),
      );

      if (!hasMatchingKeyword) {
        return false;
      }
    }

    return true;
  }
}
