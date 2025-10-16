import { Injectable, Logger } from '@nestjs/common';
import { BuildingType, OwnerType, ParkingType } from '@prisma/client';
import { CreateOfferDto } from '../../offer/dto/create-offer.dto';

@Injectable()
export class ScraperOfferMapperService {
  private readonly logger = new Logger(ScraperOfferMapperService.name);

  mapOlxToCreateOfferDto(data: {
    url: string;
    title: string | null;
    price: number | null;
    city: string;
    district?: string | null;
    footage?: number | null;
    description?: string | null;
    summary?: string | null;
    street?: string | null;
    streetNumber?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    rooms?: number | null;
    floor?: number | null;
    furniture?: boolean | null;
    elevator?: boolean | null;
    pets?: boolean | null;
    negotiable?: boolean | null;
    ownerType?: OwnerType | null;
    buildingType?: BuildingType | null;
    parkingType?: ParkingType | null;
    rentAdditional?: number | null;
    contact?: string | null;
    views?: number;
    createdAt?: Date | null;
    isNew?: boolean;
    images?: string[];
    infoAdditional?: string | null;
    furnishing?: string | null;
    media?: string | null;
  }): CreateOfferDto {
    const dto: CreateOfferDto = {
      link: data.url,
      title: data.title || '',
      price: data.price || 0,
      city:
        data.city && data.city.trim() !== '' ? data.city.trim() : 'Nieznane',
      source: 'olx',
    };

    if (data.district) dto.district = data.district;
    if (data.footage) dto.footage = data.footage;
    if (data.description) dto.description = data.description;
    if (data.summary) dto.summary = data.summary;
    if (data.street) dto.street = data.street;
    if (data.streetNumber) dto.streetNumber = data.streetNumber;
    if (data.latitude !== null && data.latitude !== undefined)
      dto.latitude = data.latitude;
    if (data.longitude !== null && data.longitude !== undefined)
      dto.longitude = data.longitude;
    if (data.rooms !== null && data.rooms !== undefined) dto.rooms = data.rooms;
    if (data.floor !== null && data.floor !== undefined) dto.floor = data.floor;
    if (data.furniture !== null && data.furniture !== undefined)
      dto.furniture = data.furniture;
    if (data.elevator !== null && data.elevator !== undefined)
      dto.elevator = data.elevator;
    if (data.pets !== null && data.pets !== undefined) dto.pets = data.pets;
    if (data.negotiable !== null && data.negotiable !== undefined)
      dto.negotiable = data.negotiable;
    if (data.ownerType) dto.ownerType = data.ownerType;
    if (data.buildingType) dto.buildingType = data.buildingType;
    if (data.parkingType) dto.parkingType = data.parkingType;
    if (data.rentAdditional) dto.rentAdditional = data.rentAdditional;
    if (data.contact) dto.contact = data.contact;
    if (data.views !== undefined) dto.views = data.views;
    if (data.createdAt) dto.createdAt = data.createdAt;
    if (data.isNew !== undefined) dto.isNew = data.isNew;
    if (data.images && data.images.length > 0) dto.images = data.images;
    if (data.infoAdditional) dto.infoAdditional = data.infoAdditional;
    if (data.furnishing) dto.furnishing = data.furnishing;
    if (data.media) dto.media = data.media;

    return dto;
  }

  mapOtodomToCreateOfferDto(data: {
    url: string;
    title: string | null;
    price: number;
    city: string;
    district?: string | null;
    footage?: number | null;
    description?: string | null;
    summary?: string | null;
    street?: string | null;
    streetNumber?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    rooms?: number | null;
    floor?: number | null;
    furniture?: boolean | null;
    elevator?: boolean | null;
    ownerType?: OwnerType | null;
    buildingType?: BuildingType | null;
    contact?: string | null;
    views?: number;
    createdAt?: Date | null;
    isNew?: boolean;
    images?: string[];
    infoAdditional?: string | null;
    furnishing?: string | null;
    media?: string | null;
  }): CreateOfferDto {
    const dto: CreateOfferDto = {
      link: data.url,
      title: data.title || '',
      price: data.price,
      city:
        data.city && data.city.trim() !== '' ? data.city.trim() : 'Nieznane',
      source: 'otodom',
    };

    if (data.district) dto.district = data.district;
    if (data.footage) dto.footage = data.footage;
    if (data.description) dto.description = data.description;
    if (data.summary) dto.summary = data.summary;
    if (data.street) dto.street = data.street;
    if (data.streetNumber) dto.streetNumber = data.streetNumber;
    if (data.latitude !== null && data.latitude !== undefined)
      dto.latitude = data.latitude;
    if (data.longitude !== null && data.longitude !== undefined)
      dto.longitude = data.longitude;
    if (data.rooms !== null && data.rooms !== undefined) dto.rooms = data.rooms;
    if (data.floor !== null && data.floor !== undefined) dto.floor = data.floor;
    if (data.furniture !== null && data.furniture !== undefined)
      dto.furniture = data.furniture;
    if (data.elevator !== null && data.elevator !== undefined)
      dto.elevator = data.elevator;
    if (data.ownerType) dto.ownerType = data.ownerType;
    if (data.buildingType) dto.buildingType = data.buildingType;
    if (data.contact) dto.contact = data.contact;
    if (data.views !== undefined) dto.views = data.views;
    if (data.createdAt) dto.createdAt = data.createdAt;
    if (data.isNew !== undefined) dto.isNew = data.isNew;
    if (data.images && data.images.length > 0) dto.images = data.images;
    if (data.infoAdditional) dto.infoAdditional = data.infoAdditional;
    if (data.furnishing) dto.furnishing = data.furnishing;
    if (data.media) dto.media = data.media;

    return dto;
  }

  mapGenericToCreateOfferDto(
    source: string,
    data: Partial<CreateOfferDto> & {
      url: string;
      title: string;
      price: number;
      city: string;
    },
  ): CreateOfferDto {
    const dto: CreateOfferDto = {
      link: data.url,
      title: data.title,
      price: data.price,
      city:
        data.city && data.city.trim() !== '' ? data.city.trim() : 'Nieznane',
      source,
    };

    Object.keys(data).forEach((key) => {
      if (
        key !== 'url' &&
        key !== 'link' &&
        key !== 'source' &&
        data[key] !== undefined &&
        data[key] !== null
      ) {
        dto[key] = data[key];
      }
    });

    return dto;
  }
}
