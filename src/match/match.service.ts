import { BuildingType, OwnerType, ParkingType } from "@prisma/client";

import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";

import { AlertService } from "../alert/alert.service";
import { DatabaseService } from "../database/database.service";
import { NotificationService } from "../notification/notification.service";
import { CreateMatchDto } from "./dto/create-match.dto";
import { MatchSortBy, QueryMatchesDto } from "./dto/query-matches.dto";

@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly alertService: AlertService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
  ) {}

  async create(createMatchDto: CreateMatchDto) {
    try {
      return await this.databaseService.match.create({
        data: createMatchDto,
        include: {
          alert: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
          offer: {
            select: {
              id: true,
              title: true,
              price: true,
              city: true,
              link: true,
              images: true,
            },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        this.logger.warn(
          `Match already exists for alert ${String(createMatchDto.alertId)} and offer ${String(createMatchDto.offerId)}`,
        );
        return null;
      }
      throw error;
    }
  }

  async findAllByAlert(alertId: number, userId: number) {
    await this.alertService.findOne(alertId, userId);

    return this.databaseService.match.findMany({
      where: {
        alertId,
      },
      include: {
        alert: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        offer: {
          select: {
            id: true,
            title: true,
            price: true,
            city: true,
            district: true,
            link: true,
            footage: true,
            rooms: true,
            floor: true,
            furniture: true,
            elevator: true,
            pets: true,
            createdAt: true,
            images: true,
            description: true,
            negotiable: true,
            buildingType: true,
            street: true,
            streetNumber: true,
            isNew: true,
          },
        },
      },
      orderBy: {
        matchedAt: "desc",
      },
    });
  }

  async findAllByUser(userId: number, query?: QueryMatchesDto) {
    const { sortBy, alertId, page = 1, limit = 50 } = query ?? {};

    const where: Record<string, unknown> = {
      alert: {
        userId,
      },
    };

    if (alertId !== undefined && alertId !== 0) {
      where.alertId = alertId;
    }

    let orderBy: Record<string, unknown> = { matchedAt: "desc" };

    if (sortBy !== undefined) {
      switch (sortBy) {
        case MatchSortBy.NEWEST: {
          orderBy = { matchedAt: "desc" };
          break;
        }
        case MatchSortBy.OLDEST: {
          orderBy = { matchedAt: "asc" };
          break;
        }
        case MatchSortBy.PRICE_LOW: {
          orderBy = { offer: { price: "asc" } };
          break;
        }
        case MatchSortBy.PRICE_HIGH: {
          orderBy = { offer: { price: "desc" } };
          break;
        }
        case MatchSortBy.FOOTAGE_LOW: {
          orderBy = { offer: { footage: "asc" } };
          break;
        }
        case MatchSortBy.FOOTAGE_HIGH: {
          orderBy = { offer: { footage: "desc" } };
          break;
        }
        case MatchSortBy.SCORE_HIGH:
        case MatchSortBy.SCORE_LOW: {
          orderBy = { matchedAt: "desc" };
          break;
        }
      }
    }

    const skip = (page - 1) * limit;

    return this.databaseService.match.findMany({
      where,
      include: {
        alert: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        offer: {
          select: {
            id: true,
            title: true,
            price: true,
            city: true,
            district: true,
            link: true,
            footage: true,
            rooms: true,
            floor: true,
            furniture: true,
            elevator: true,
            pets: true,
            createdAt: true,
            images: true,
            description: true,
            negotiable: true,
            buildingType: true,
            street: true,
            streetNumber: true,
            isNew: true,
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    });
  }

  async findOne(id: number, userId: number) {
    const match = await this.databaseService.match.findFirst({
      where: {
        id,
        alert: {
          userId,
        },
      },
      include: {
        alert: {
          select: {
            id: true,
            name: true,
            city: true,
            userId: true,
          },
        },
        offer: {
          select: {
            id: true,
            title: true,
            price: true,
            city: true,
            district: true,
            link: true,
            footage: true,
            rooms: true,
            floor: true,
            furniture: true,
            elevator: true,
            pets: true,
            description: true,
            createdAt: true,
            images: true,
            negotiable: true,
            buildingType: true,
            street: true,
            streetNumber: true,
            isNew: true,
          },
        },
      },
    });

    if (match === null) {
      throw new NotFoundException(`Match with ID ${String(id)} not found`);
    }

    return match;
  }

  async markNotificationSent(id: number) {
    return this.databaseService.match.update({
      where: { id },
      data: {
        notificationSent: true,
      },
    });
  }

  async processNewOffer(offerId: number) {
    this.logger.log(`Processing new offer ${String(offerId)} for matching`);

    const offer = await this.databaseService.offer.findUnique({
      where: { id: offerId },
    });

    if (offer === null) {
      this.logger.error(`Offer ${String(offerId)} not found`);
      return;
    }

    const alerts = await this.alertService.getActiveAlerts();

    let matchCount = 0;

    for (const alert of alerts) {
      const offerData: {
        ownerType?: OwnerType;
        buildingType?: BuildingType;
        parkingType?: ParkingType;
        city?: string;
        district?: string;
        price?: number;
        footage?: number;
        rooms?: number;
        floor?: number;
        furniture?: boolean;
        elevator?: boolean;
        pets?: boolean;
        title?: string;
        description?: string;
      } = {};

      if (offer.ownerType) {
        offerData.ownerType = offer.ownerType;
      }
      if (offer.buildingType) {
        offerData.buildingType = offer.buildingType;
      }
      if (offer.parkingType) {
        offerData.parkingType = offer.parkingType;
      }
      if (offer.city !== "") {
        offerData.city = offer.city;
      }
      if (offer.district !== null && offer.district !== "") {
        offerData.district = offer.district;
      }
      offerData.price = Number(offer.price);
      if (offer.footage !== null) {
        offerData.footage = Number(offer.footage);
      }
      if (offer.rooms !== null) {
        offerData.rooms = offer.rooms;
      }
      if (offer.floor !== null) {
        offerData.floor = offer.floor;
      }
      if (offer.furniture !== null) {
        offerData.furniture = offer.furniture;
      }
      if (offer.elevator !== null) {
        offerData.elevator = offer.elevator;
      }
      if (offer.pets !== null) {
        offerData.pets = offer.pets;
      }
      if (offer.title !== "") {
        offerData.title = offer.title;
      }
      if (offer.description !== null && offer.description !== "") {
        offerData.description = offer.description;
      }

      const alertData: {
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
      } = {};

      if (alert.ownerType !== null) {
        alertData.ownerType = alert.ownerType;
      }
      if (alert.buildingType !== null) {
        alertData.buildingType = alert.buildingType;
      }
      if (alert.parkingType !== null) {
        alertData.parkingType = alert.parkingType;
      }
      if (alert.city.trim() !== "") {
        alertData.city = alert.city;
      }
      if (alert.district !== null && alert.district.trim() !== "") {
        alertData.district = alert.district;
      }
      if (alert.minPrice !== null) {
        alertData.minPrice = Number(alert.minPrice);
      }
      if (alert.maxPrice !== null) {
        alertData.maxPrice = Number(alert.maxPrice);
      }
      if (alert.minFootage !== null) {
        alertData.minFootage = Number(alert.minFootage);
      }
      if (alert.maxFootage !== null) {
        alertData.maxFootage = Number(alert.maxFootage);
      }
      if (alert.minRooms !== null) {
        alertData.minRooms = alert.minRooms;
      }
      if (alert.maxRooms !== null) {
        alertData.maxRooms = alert.maxRooms;
      }
      if (alert.minFloor !== null) {
        alertData.minFloor = alert.minFloor;
      }
      if (alert.maxFloor !== null) {
        alertData.maxFloor = alert.maxFloor;
      }
      if (alert.furniture !== null) {
        alertData.furniture = alert.furniture;
      }
      if (alert.elevator !== null) {
        alertData.elevator = alert.elevator;
      }
      if (alert.pets !== null) {
        alertData.pets = alert.pets;
      }
      if (alert.keywords.length > 0) {
        alertData.keywords = alert.keywords;
      }

      this.logger.log(
        `Checking match for alert ${String(alert.id)} (${alert.name}) against offer ${String(offer.id)} (${offer.title})`,
      );
      this.logger.log(`Alert criteria: ${JSON.stringify(alertData)}`);
      this.logger.log(`Offer data: ${JSON.stringify(offerData)}`);

      const isMatch = this.alertService.checkOfferMatch(offerData, alertData);
      this.logger.log(`Match result: ${String(isMatch)}`);

      if (isMatch) {
        try {
          const match = await this.create({
            alertId: alert.id,
            offerId: offer.id,
            notificationSent: false,
          });

          if (match !== null) {
            matchCount++;
            this.logger.log(
              `Created match between alert ${String(alert.id)} and offer ${String(offer.id)}`,
            );

            try {
              await this.notificationService.notifyMatch(match.id);
              this.logger.log(
                `Notification queued for match ${String(match.id)}`,
              );
            } catch (notificationError) {
              this.logger.error(
                `Failed to queue notification for match ${String(match.id)}:`,
                notificationError,
              );
            }
          }
        } catch (error) {
          this.logger.error(
            `Failed to create match for alert ${String(alert.id)} and offer ${String(offer.id)}:`,
            error,
          );
        }
      }
    }

    this.logger.log(
      `Created ${String(matchCount)} matches for offer ${String(offerId)}`,
    );
    return matchCount;
  }

  async getMatchStats(userId: number) {
    try {
      const [stats, totalMatches, unreadMatches] = await Promise.all([
        this.databaseService.match
          .groupBy({
            by: ["alertId"],
            where: {
              alert: {
                userId,
              },
            },
            _count: {
              _all: true,
            },
          })
          .catch(() => []),
        this.databaseService.match.count({
          where: {
            alert: {
              userId,
            },
          },
        }),
        this.databaseService.match.count({
          where: {
            alert: {
              userId,
            },
            notificationSent: false,
          },
        }),
      ]);

      return {
        totalMatches,
        unreadMatches,
        matchesByAlert: stats,
      };
    } catch (error) {
      this.logger.error("Error getting match stats:", error);
      return {
        totalMatches: 0,
        unreadMatches: 0,
        matchesByAlert: [],
      };
    }
  }

  async remove(id: number, userId: number) {
    await this.findOne(id, userId);

    await this.databaseService.match.delete({
      where: { id },
    });

    this.logger.log(`Match ${String(id)} deleted by user ${String(userId)}`);

    return {
      success: true,
      message: `Match ${String(id)} has been deleted`,
    };
  }
}
