import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Offer } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { link } from 'fs';

@Injectable()
export class OfferService {
  constructor(private readonly database: DatabaseService) {}

  async findAll(): Promise<Offer[]> {
    return this.database.offer.findMany();
  }

  
  async findOneOrCreate(createOfferDto: CreateOfferDto){
    const myOffer = this.database.offer.findUnique({where: {link}});
    if (myOffer == null)
    {
      return this.create(createOfferDto);
    }
    else
    {
      return this.update(myOffer.id, createOfferDto as UpdateOfferDto)
    }
  }

  async findOne(id: number): Promise<Offer> {
    const offer = await this.database.offer.findUnique({ where: { id } });
    if (!offer) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }
    return offer;
  }

  async create(createOfferDto: CreateOfferDto): Promise<Offer> {
    const existing = await this.database.offer.findFirst({
      where: {
        link: createOfferDto.link,
      },
    });

    if (existing) {
      throw new ConflictException('Offer with this link already exists');
    }

    return this.database.offer.create({
      data: createOfferDto,
    });
  }

  async update(id: number, updateOfferDto: UpdateOfferDto): Promise<Offer> {
    await this.findOne(id); // Ensure it exists first

    return this.database.offer.update({
      where: { id },
      data: updateOfferDto,
    });
  }

  async remove(id: number): Promise<Offer> {
    await this.findOne(id);
    return this.database.offer.delete({
      where: { id },
    });
  }

  // Additional utility: disable by date
  async deleteExpiredOffers(): Promise<{ count: number }> {
    const result = await this.database.offer.deleteMany({
      where: {
        valid_to: {
          lte: new Date(),
        },
      },
    });

    return { count: result.count };
  }
}
