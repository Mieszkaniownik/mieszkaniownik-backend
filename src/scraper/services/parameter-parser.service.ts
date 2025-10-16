import { Injectable } from '@nestjs/common';
import { BuildingType, OwnerType, ParkingType } from '@prisma/client';

export interface ParsedOfferParameters {
  footage: number | null;
  rooms: string | null;
  floor: string | null;
  furniture: boolean | null;
  elevator: boolean | null;
  pets: boolean | null;
  buildingType: BuildingType;
  ownerType: OwnerType | null;
  parkingType: ParkingType | null;
  rentAdditional: number | null;
}

@Injectable()
export class ParameterParserService {
  findParamValue(
    parameters: Record<string, string>,
    targetKey: string,
  ): string | undefined {
    if (parameters[targetKey]) {
      return parameters[targetKey];
    }

    const matchingKey = Object.keys(parameters).find(
      (key) => key.toLowerCase() === targetKey.toLowerCase(),
    );
    return matchingKey ? parameters[matchingKey] : undefined;
  }

  parseBoolean(value: string | undefined, paramName: string): boolean | null {
    if (!value) {
      console.log(`${paramName} status not specified`);
      return null;
    }

    const lowerValue = value.toLowerCase().trim();
    if (lowerValue === 'tak') {
      console.log(`${paramName} detected: true`);
      return true;
    } else if (
      lowerValue === 'nie' ||
      lowerValue === 'brak' ||
      lowerValue === 'no'
    ) {
      console.log(`${paramName} detected: false`);
      return false;
    } else {
      console.log(`${paramName} status unclear - value: "${value}"`);
      return null;
    }
  }

  parseFootage(surfaceStr: string): number | null {
    const footageMatch = surfaceStr.match(/(\d+(?:[,.]\d+)?)\s*m²/);
    return footageMatch ? parseFloat(footageMatch[1].replace(',', '.')) : null;
  }

  parseRooms(roomsStr: string): string | null {
    const roomsLower = roomsStr.toLowerCase();

    if (roomsLower.includes('kawalerka')) {
      return '1';
    } else if (roomsLower.includes('2 pokoje')) {
      return '2';
    } else if (roomsLower.includes('3 pokoje')) {
      return '3';
    } else if (roomsLower.includes('4 i więcej')) {
      return '4';
    } else {
      const roomsMatch = roomsStr.match(/(\d+)/);
      if (roomsMatch) {
        const roomCount = parseInt(roomsMatch[1]);
        return roomCount >= 4 ? '4' : roomsMatch[1];
      }
    }
    return null;
  }

  parseFloor(floorStr: string): string | null {
    const floorLower = floorStr.toLowerCase();

    if (floorLower.includes('wszystkie')) {
      return null;
    } else if (floorLower.includes('suterena')) {
      return '-1';
    } else if (floorLower.includes('parter')) {
      return '0';
    } else if (floorLower.includes('poddasze')) {
      return '99';
    } else if (floorLower.includes('powyżej 10')) {
      return '11';
    } else {
      const floorMatch = floorStr.match(/\d+/);
      if (floorMatch) {
        const floorNum = parseInt(floorMatch[0]);
        if (floorNum >= 1 && floorNum <= 10) {
          return floorMatch[0];
        } else if (floorNum > 10) {
          return '11';
        }
      }
    }
    return null;
  }

  parseBuildingType(buildingTypeStr: string): BuildingType {
    const buildingTypeLower = buildingTypeStr.toLowerCase();

    if (
      buildingTypeLower.includes('dom wolnostojący') ||
      buildingTypeLower.includes('wolnostojący')
    ) {
      return BuildingType.DETACHED;
    } else if (
      buildingTypeLower.includes('dom szeregowy') ||
      buildingTypeLower.includes('szeregowy')
    ) {
      return BuildingType.TERRACED;
    } else if (
      buildingTypeLower.includes('kamienica') ||
      buildingTypeLower.includes('tenement')
    ) {
      return BuildingType.TENEMENT;
    } else if (
      buildingTypeLower.includes('blok') ||
      buildingTypeLower.includes('block')
    ) {
      return BuildingType.BLOCK_OF_FLATS;
    } else if (buildingTypeLower.includes('loft')) {
      return BuildingType.LOFT;
    } else if (
      buildingTypeLower.includes('mieszkanie') ||
      buildingTypeLower.includes('apartment')
    ) {
      return BuildingType.APARTMENT;
    } else {
      return BuildingType.OTHER;
    }
  }

  parseOwnerType(parameters: Record<string, string>): OwnerType | null {
    const ownerTypeStr = this.findParamValue(parameters, 'Prywatne') || '';
    const firmowStr = this.findParamValue(parameters, 'Firmowe') || '';
    const otodomOwnerTypeStr =
      this.findParamValue(parameters, 'typ ogłoszeniodawcy') || '';

    console.log('Owner type detection debug:', {
      Prywatne: this.findParamValue(parameters, 'Prywatne'),
      Firmowe: this.findParamValue(parameters, 'Firmowe'),
      'typ ogłoszeniodawcy': this.findParamValue(
        parameters,
        'typ ogłoszeniodawcy',
      ),
      'All parameters': Object.keys(parameters),
    });

    if (
      ownerTypeStr.toLowerCase().includes('prywatne') ||
      ownerTypeStr.toLowerCase().trim() === 'tak' ||
      otodomOwnerTypeStr.toLowerCase().includes('prywatny')
    ) {
      console.log('Owner type detected as PRIVATE');
      return OwnerType.PRIVATE;
    } else if (
      firmowStr.toLowerCase().trim() === 'tak' ||
      this.findParamValue(parameters, 'Biuro nieruchomości') ||
      otodomOwnerTypeStr.toLowerCase().includes('biuro') ||
      otodomOwnerTypeStr.toLowerCase().includes('firmowy') ||
      otodomOwnerTypeStr.toLowerCase().includes('deweloper') ||
      otodomOwnerTypeStr.toLowerCase().includes('agencja')
    ) {
      console.log('Owner type detected as COMPANY');
      return OwnerType.COMPANY;
    } else {
      console.log('Owner type not detected');
      return null;
    }
  }

  parseParkingType(parkingStr: string): ParkingType | null {
    if (!parkingStr) {
      console.log('Parking information not specified');
      return null;
    }

    const parkingLower = parkingStr.toLowerCase();

    if (
      parkingLower.includes('identyfikator do strefy płatnego parkowania') ||
      parkingLower.includes('płatny parking')
    ) {
      console.log('Paid parking zone detected');
      return ParkingType.IDENTIFICATOR_FOR_PAID_PARKING;
    } else if (
      parkingLower.includes('w garażu') ||
      parkingLower.includes('garage')
    ) {
      console.log('Garage parking detected');
      return ParkingType.GARAGE;
    } else if (
      parkingLower.includes('parking strzeżony') ||
      parkingLower.includes('secured')
    ) {
      console.log('Secured parking detected');
      return ParkingType.SECURED;
    } else if (
      parkingLower.includes('przynależne na ulicy') ||
      parkingLower.includes('street')
    ) {
      console.log('Street parking detected');
      return ParkingType.STREET;
    } else if (
      parkingLower.includes('brak') ||
      parkingLower.includes('none') ||
      parkingLower.includes('nie')
    ) {
      console.log('No parking detected');
      return ParkingType.NONE;
    } else {
      console.log('Parking type not recognized:', parkingStr);
      return null;
    }
  }

  parseRentAdditional(rentAdditionalStr: string): number | null {
    if (!rentAdditionalStr) {
      return null;
    }
    const rentMatch = rentAdditionalStr.match(/(\d+(?:[,.]\d+)?)/);
    return rentMatch ? parseFloat(rentMatch[1].replace(',', '.')) : null;
  }

  parseOlxParameters(
    rawParameters: Record<string, string>,
  ): ParsedOfferParameters {
    const footage = this.parseFootage(rawParameters['Powierzchnia'] || '');
    const rooms = this.parseRooms(rawParameters['Liczba pokoi'] || '');
    const floor = this.parseFloor(
      rawParameters['Poziom'] || rawParameters['Piętro'] || '',
    );

    const furniture = this.parseBoolean(
      this.findParamValue(rawParameters, 'Umeblowane') ||
        this.findParamValue(rawParameters, 'umeblowane'),
      'Furniture',
    );

    const elevator = this.parseBoolean(
      this.findParamValue(rawParameters, 'Winda') ||
        this.findParamValue(rawParameters, 'winda'),
      'Elevator',
    );

    const petsParam =
      this.findParamValue(rawParameters, 'Zwierzęta') ||
      this.findParamValue(rawParameters, 'Przyjazne zwierzętom');
    const pets = this.parseBoolean(petsParam, 'Pets');

    const buildingType = rawParameters['Rodzaj zabudowy']
      ? this.parseBuildingType(rawParameters['Rodzaj zabudowy'])
      : BuildingType.APARTMENT;

    const ownerType = this.parseOwnerType(rawParameters);
    const parkingType = this.parseParkingType(rawParameters['Parking'] || '');
    const rentAdditional = this.parseRentAdditional(
      rawParameters['Czynsz (dodatkowo)'] ||
        this.findParamValue(rawParameters, 'czynsz dodatkowy') ||
        '',
    );

    return {
      footage,
      rooms,
      floor,
      furniture,
      elevator,
      pets,
      buildingType,
      ownerType,
      parkingType,
      rentAdditional,
    };
  }

  parseOtodomFootage(
    footageText: string | null,
    details: Record<string, string>,
  ): number | null {
    if (footageText) {
      return parseFloat(footageText.replace(/[^0-9,]/g, '').replace(',', '.'));
    } else {
      const footageDetail =
        details['powierzchnia użytkowa'] ||
        details['powierzchnia'] ||
        details['surface'];
      if (footageDetail) {
        return parseFloat(
          footageDetail.replace(/[^0-9,]/g, '').replace(',', '.'),
        );
      }
    }
    return null;
  }
}
