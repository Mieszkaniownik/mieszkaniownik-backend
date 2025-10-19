import { Offer } from "@prisma/client";

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { DatabaseService } from "../database/database.service";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { UpdateOfferDto } from "./dto/update-offer.dto";

@Injectable()
export class OfferService {
  private readonly logger = new Logger(OfferService.name);

  constructor(private readonly database: DatabaseService) {}

  async findAll(): Promise<Offer[]> {
    return this.database.offer.findMany();
  }

  async findOne(id: number): Promise<Offer> {
    const offer = await this.database.offer.findUnique({ where: { id } });
    if (offer === null) {
      throw new NotFoundException(`Offer with ID ${String(id)} not found`);
    }
    return offer;
  }

  async findByLink(link: string): Promise<Offer | null> {
    return this.database.offer.findUnique({ where: { link } });
  }

  async findOneOrCreate(createOfferDto: CreateOfferDto): Promise<{
    offer: Offer;
    created: boolean;
  }> {
    const { link } = createOfferDto;

    if (!link) {
      throw new Error("Link is required to create or update an offer");
    }

    const existingOffer = await this.database.offer.findUnique({
      where: { link },
    });

    if (existingOffer === null) {
      this.logger.debug(`Creating new offer: ${link}`);
      const newOffer = await this.create(createOfferDto);
      return { offer: newOffer, created: true };
    }

    this.logger.debug(`Updating existing offer: ${link}`);
    const updatedOffer = await this.update(
      existingOffer.id,
      createOfferDto as UpdateOfferDto,
    );
    return { offer: updatedOffer, created: false };
  }

  async create(createOfferDto: CreateOfferDto): Promise<Offer> {
    const existing = await this.database.offer.findFirst({
      where: {
        link: createOfferDto.link,
      },
    });

    if (existing !== null) {
      throw new ConflictException("Offer with this link already exists");
    }

    const dataToCreate = Object.assign({}, createOfferDto, {
      createdAt: createOfferDto.createdAt ?? new Date(),
    });

    return this.database.offer.create({
      data: dataToCreate,
    });
  }

  async update(id: number, updateOfferDto: UpdateOfferDto): Promise<Offer> {
    await this.findOne(id);

    return this.database.offer.update({
      where: { id },
      data: Object.assign({}, updateOfferDto, {
        updatedAt: new Date(),
      }),
    });
  }

  async remove(id: number): Promise<Offer> {
    await this.findOne(id);
    return this.database.offer.delete({
      where: { id },
    });
  }

  async deleteExpiredOffers(): Promise<{ count: number }> {
    const thresholdDate = new Date();
    thresholdDate.setMonth(thresholdDate.getMonth() - 3);

    const result = await this.database.offer.deleteMany({
      where: {
        updatedAt: {
          lte: thresholdDate,
        },
        available: false,
      },
    });

    return { count: result.count };
  }

  async markAsUnavailable(id: number): Promise<Offer> {
    await this.findOne(id);
    return this.database.offer.update({
      where: { id },
      data: {
        available: false,
        updatedAt: new Date(),
      },
    });
  }

  async getStatistics(): Promise<{
    total: number;
    available: number;
    bySource: Record<string, number>;
    byCity: Record<string, number>;
  }> {
    const [total, available, bySource, byCity] = await Promise.all([
      this.database.offer.count(),
      this.database.offer.count({ where: { available: true } }),
      this.database.offer.groupBy({
        by: ["source"],
        _count: { id: true },
      }),
      this.database.offer.groupBy({
        by: ["city"],
        _count: { id: true },
        orderBy: {
          _count: {
            id: "desc",
          },
        },
        take: 10,
      }),
    ]);

    return {
      total,
      available,
      bySource: Object.fromEntries(
        bySource.map((item) => [item.source, item._count.id]),
      ),
      byCity: Object.fromEntries(
        byCity.map((item) => [item.city, item._count.id]),
      ),
    };
  }
}
