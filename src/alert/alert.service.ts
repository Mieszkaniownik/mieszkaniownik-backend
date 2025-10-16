import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AlertStatus,
  OwnerType,
  BuildingType,
  ParkingType,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { QueryAlertsDto, AlertSortBy } from './dto/query-alerts.dto';

@Injectable()
export class AlertService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(userId: number, createAlertDto: CreateAlertDto) {
    return this.databaseService.alert.create({
      data: {
        ...createAlertDto,
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

  async findAll(userId: number, query?: QueryAlertsDto) {
    const { status, sortBy, city, search, limit } = query || {};

    const where: any = {
      userId,
      status: status || { not: AlertStatus.DELETED },
    };

    if (city) {
      where.city = city;
    }

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    let orderBy: any = { createdAt: 'desc' };

    if (sortBy) {
      switch (sortBy) {
        case AlertSortBy.NEWEST:
          orderBy = { createdAt: 'desc' };
          break;
        case AlertSortBy.OLDEST:
          orderBy = { createdAt: 'asc' };
          break;
        case AlertSortBy.MATCHES:
          orderBy = { matchesCount: 'desc' };
          break;
        case AlertSortBy.NAME:
          orderBy = { name: 'asc' };
          break;
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
      ...(limit && { take: limit }),
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
            matchedAt: 'desc',
          },
        },
        _count: {
          select: {
            matches: true,
          },
        },
      },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
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

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
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

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
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
    console.log('MATCHING DEBUG:', {
      offerCity: offer.city,
      alertCity: alert.city,
      offerPrice: offer.price,
      alertMinPrice: alert.minPrice,
      alertMaxPrice: alert.maxPrice,
    });

    const hasValidAlertCity = alert.city && alert.city.trim() !== '';
    if (hasValidAlertCity && offer.city !== alert.city) {
      console.log('City mismatch:', {
        offerCity: offer.city,
        alertCity: alert.city,
        hasValidAlertCity,
      });
      return false;
    }

    const hasValidAlertDistrict =
      alert.district && alert.district.trim() !== '';
    if (hasValidAlertDistrict && offer.district !== alert.district) {
      console.log('District mismatch:', {
        offerDistrict: offer.district,
        alertDistrict: alert.district,
      });
      return false;
    }

    if (
      alert.minPrice &&
      offer.price !== undefined &&
      offer.price < alert.minPrice
    ) {
      console.log('Price too low:', {
        offerPrice: offer.price,
        minPrice: alert.minPrice,
      });
      return false;
    }

    if (
      alert.maxPrice &&
      offer.price !== undefined &&
      offer.price > alert.maxPrice
    ) {
      console.log('Price too high:', {
        offerPrice: offer.price,
        maxPrice: alert.maxPrice,
      });
      return false;
    }

    if (
      alert.minFootage &&
      offer.footage !== undefined &&
      offer.footage < alert.minFootage
    ) {
      console.log('Footage too small:', {
        offerFootage: offer.footage,
        minFootage: alert.minFootage,
      });
      return false;
    }

    if (
      alert.maxFootage &&
      offer.footage !== undefined &&
      offer.footage > alert.maxFootage
    ) {
      console.log('Footage too large:', {
        offerFootage: offer.footage,
        maxFootage: alert.maxFootage,
      });
      return false;
    }

    if (
      (alert.minRooms && offer.rooms && offer.rooms < alert.minRooms) ||
      (alert.maxRooms && offer.rooms && offer.rooms > alert.maxRooms)
    ) {
      console.log('Rooms range mismatch:', {
        offerRooms: offer.rooms,
        alertMinRooms: alert.minRooms,
        alertMaxRooms: alert.maxRooms,
      });
      return false;
    }

    if (
      (alert.minFloor && offer.floor && offer.floor < alert.minFloor) ||
      (alert.maxFloor && offer.floor && offer.floor > alert.maxFloor)
    ) {
      console.log('Floor range mismatch:', {
        offerFloor: offer.floor,
        alertMinFloor: alert.minFloor,
        alertMaxFloor: alert.maxFloor,
      });
      return false;
    }

    if (
      alert.ownerType !== null &&
      alert.ownerType !== undefined &&
      offer.ownerType !== alert.ownerType
    ) {
      console.log('Owner type mismatch:', {
        offerOwnerType: offer.ownerType,
        alertOwnerType: alert.ownerType,
      });
      return false;
    }

    if (
      alert.buildingType !== null &&
      alert.buildingType !== undefined &&
      offer.buildingType !== alert.buildingType
    ) {
      console.log('Building type mismatch:', {
        offerBuildingType: offer.buildingType,
        alertBuildingType: alert.buildingType,
      });
      return false;
    }

    if (
      alert.parkingType !== null &&
      alert.parkingType !== undefined &&
      offer.parkingType !== alert.parkingType
    ) {
      console.log('Parking type mismatch:', {
        offerParkingType: offer.parkingType,
        alertParkingType: alert.parkingType,
      });
      return false;
    }

    if (
      alert.furniture !== null &&
      alert.furniture !== undefined &&
      offer.furniture !== alert.furniture
    ) {
      console.log('Furniture mismatch:', {
        offerFurniture: offer.furniture,
        alertFurniture: alert.furniture,
      });
      return false;
    }

    if (
      alert.elevator !== null &&
      alert.elevator !== undefined &&
      offer.elevator !== alert.elevator
    ) {
      console.log('Elevator mismatch:', {
        offerElevator: offer.elevator,
        alertElevator: alert.elevator,
      });
      return false;
    }

    if (
      alert.pets !== null &&
      alert.pets !== undefined &&
      offer.pets !== alert.pets
    ) {
      console.log('Pets mismatch:', {
        offerPets: offer.pets,
        alertPets: alert.pets,
      });
      return false;
    }

    if (alert.keywords && alert.keywords.length > 0) {
      const searchText =
        `${offer.title || ''} ${offer.description || ''}`.toLowerCase();
      const hasMatchingKeyword = alert.keywords.some(
        (keyword) =>
          keyword.toLowerCase().trim() !== '' &&
          searchText.includes(keyword.toLowerCase().trim()),
      );

      if (!hasMatchingKeyword) {
        console.log('Keywords mismatch:', {
          offerTitle: offer.title,
          offerDescription: offer.description?.substring(0, 100),
          alertKeywords: alert.keywords,
        });
        return false;
      }

      console.log('Keywords matched!', {
        matchedKeywords: alert.keywords.filter((keyword) =>
          searchText.includes(keyword.toLowerCase().trim()),
        ),
      });
    }

    console.log('MATCH FOUND!');
    return true;
  }
}
