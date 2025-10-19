import { BuildingType, OwnerType, ParkingType } from "@prisma/client";

import { Injectable, Logger } from "@nestjs/common";

import { CreateOfferDto } from "../../offer/dto/create-offer.dto";

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
      title: data.title ?? "",
      price: data.price ?? 0,
      city: data.city.trim() === "" ? "Nieznane" : data.city.trim(),
      source: "olx",
    };

    if (data.district !== undefined && data.district !== "") {
      dto.district = data.district ?? undefined;
    }
    if (
      data.footage !== undefined &&
      data.footage !== null &&
      data.footage !== 0
    ) {
      dto.footage = data.footage;
    }
    if (data.description !== undefined && data.description !== "") {
      dto.description = data.description ?? undefined;
    }
    if (data.summary !== undefined && data.summary !== "") {
      dto.summary = data.summary ?? undefined;
    }
    if (data.street !== undefined && data.street !== "") {
      dto.street = data.street ?? undefined;
    }
    if (data.streetNumber !== undefined && data.streetNumber !== "") {
      dto.streetNumber = data.streetNumber ?? undefined;
    }
    if (data.latitude !== null && data.latitude !== undefined) {
      dto.latitude = data.latitude;
    }
    if (data.longitude !== null && data.longitude !== undefined) {
      dto.longitude = data.longitude;
    }
    if (data.rooms !== null && data.rooms !== undefined) {
      dto.rooms = data.rooms;
    }
    if (data.floor !== null && data.floor !== undefined) {
      dto.floor = data.floor;
    }
    if (data.furniture !== null && data.furniture !== undefined) {
      dto.furniture = data.furniture;
    }
    if (data.elevator !== null && data.elevator !== undefined) {
      dto.elevator = data.elevator;
    }
    if (data.pets !== null && data.pets !== undefined) {
      dto.pets = data.pets;
    }
    if (data.negotiable !== null && data.negotiable !== undefined) {
      dto.negotiable = data.negotiable;
    }
    if (data.ownerType !== null && data.ownerType !== undefined) {
      dto.ownerType = data.ownerType;
    }
    if (data.buildingType !== null && data.buildingType !== undefined) {
      dto.buildingType = data.buildingType;
    }
    if (data.parkingType !== null && data.parkingType !== undefined) {
      dto.parkingType = data.parkingType;
    }
    if (
      data.rentAdditional !== undefined &&
      data.rentAdditional !== null &&
      data.rentAdditional !== 0
    ) {
      dto.rentAdditional = data.rentAdditional;
    }
    if (
      data.contact !== undefined &&
      data.contact !== null &&
      data.contact !== ""
    ) {
      dto.contact = data.contact;
    }
    if (data.views !== undefined) {
      dto.views = data.views;
    }
    if (data.createdAt !== null && data.createdAt !== undefined) {
      dto.createdAt = data.createdAt;
    }
    if (data.isNew !== undefined) {
      dto.isNew = data.isNew;
    }
    if (data.images !== undefined && data.images.length > 0) {
      dto.images = data.images;
    }
    if (
      data.infoAdditional !== undefined &&
      data.infoAdditional !== null &&
      data.infoAdditional !== ""
    ) {
      dto.infoAdditional = data.infoAdditional;
    }
    if (
      data.furnishing !== undefined &&
      data.furnishing !== null &&
      data.furnishing !== ""
    ) {
      dto.furnishing = data.furnishing;
    }
    if (data.media !== undefined && data.media !== null && data.media !== "") {
      dto.media = data.media;
    }

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
      title: data.title ?? "",
      price: data.price,
      city: data.city.trim() === "" ? "Nieznane" : data.city.trim(),
      source: "otodom",
    };

    if (
      data.district !== undefined &&
      data.district !== null &&
      data.district !== ""
    ) {
      dto.district = data.district;
    }
    if (
      data.footage !== undefined &&
      data.footage !== null &&
      data.footage !== 0
    ) {
      dto.footage = data.footage;
    }
    if (
      data.description !== undefined &&
      data.description !== null &&
      data.description !== ""
    ) {
      dto.description = data.description;
    }
    if (
      data.summary !== undefined &&
      data.summary !== null &&
      data.summary !== ""
    ) {
      dto.summary = data.summary;
    }
    if (
      data.street !== undefined &&
      data.street !== null &&
      data.street !== ""
    ) {
      dto.street = data.street;
    }
    if (
      data.streetNumber !== undefined &&
      data.streetNumber !== null &&
      data.streetNumber !== ""
    ) {
      dto.streetNumber = data.streetNumber;
    }
    if (data.latitude !== null && data.latitude !== undefined) {
      dto.latitude = data.latitude;
    }
    if (data.longitude !== null && data.longitude !== undefined) {
      dto.longitude = data.longitude;
    }
    if (data.rooms !== null && data.rooms !== undefined) {
      dto.rooms = data.rooms;
    }
    if (data.floor !== null && data.floor !== undefined) {
      dto.floor = data.floor;
    }
    if (data.furniture !== null && data.furniture !== undefined) {
      dto.furniture = data.furniture;
    }
    if (data.elevator !== null && data.elevator !== undefined) {
      dto.elevator = data.elevator;
    }
    if (data.ownerType) {
      dto.ownerType = data.ownerType;
    }
    if (data.buildingType) {
      dto.buildingType = data.buildingType;
    }
    if (
      data.contact !== undefined &&
      data.contact !== null &&
      data.contact !== ""
    ) {
      dto.contact = data.contact;
    }
    if (data.views !== undefined) {
      dto.views = data.views;
    }
    if (data.createdAt !== null && data.createdAt !== undefined) {
      dto.createdAt = data.createdAt;
    }
    if (data.isNew !== undefined) {
      dto.isNew = data.isNew;
    }
    if (data.images !== undefined && data.images.length > 0) {
      dto.images = data.images;
    }
    if (
      data.infoAdditional !== undefined &&
      data.infoAdditional !== null &&
      data.infoAdditional !== ""
    ) {
      dto.infoAdditional = data.infoAdditional;
    }
    if (
      data.furnishing !== undefined &&
      data.furnishing !== null &&
      data.furnishing !== ""
    ) {
      dto.furnishing = data.furnishing;
    }
    if (data.media !== undefined && data.media !== null && data.media !== "") {
      dto.media = data.media;
    }

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
        data.city && data.city.trim() !== "" ? data.city.trim() : "Nieznane",
      source,
    };

    for (const key of Object.keys(data)) {
      if (
        key !== "url" &&
        key !== "link" &&
        key !== "source" &&
        data[key] !== undefined &&
        data[key] !== null
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        dto[key] = data[key];
      }
    }

    return dto;
  }
}
