import { BuildingType, OwnerType, ParkingType } from "@prisma/client";

import { Injectable } from "@nestjs/common";

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
    return matchingKey === undefined ? undefined : parameters[matchingKey];
  }

  parseBoolean(
    value: string | undefined,
    _parameterName: string,
  ): boolean | null {
    if (value === undefined || value === "") {
      return null;
    }

    const lowerValue = value.toLowerCase().trim();
    if (lowerValue === "tak") {
      return true;
    } else if (
      lowerValue === "nie" ||
      lowerValue === "brak" ||
      lowerValue === "no"
    ) {
      return false;
    } else {
      return null;
    }
  }

  parseFootage(surfaceString: string): number | null {
    const footageMatch = /(\d+(?:[,.]\d+)?)\s*m²/.exec(surfaceString);
    return footageMatch === null
      ? null
      : Number.parseFloat(footageMatch[1].replace(",", "."));
  }

  parseRooms(roomsString: string): string | null {
    const roomsLower = roomsString.toLowerCase();

    if (roomsLower.includes("kawalerka")) {
      return "1";
    } else if (roomsLower.includes("2 pokoje")) {
      return "2";
    } else if (roomsLower.includes("3 pokoje")) {
      return "3";
    } else if (roomsLower.includes("4 i więcej")) {
      return "4";
    } else {
      const roomsMatch = /(\d+)/.exec(roomsString);
      if (roomsMatch !== null) {
        const roomCount = Number.parseInt(roomsMatch[1]);
        return roomCount >= 4 ? "4" : roomsMatch[1];
      }
    }
    return null;
  }

  parseFloor(floorString: string): string | null {
    const floorLower = floorString.toLowerCase();

    if (floorLower.includes("wszystkie")) {
      return null;
    } else if (floorLower.includes("suterena")) {
      return "-1";
    } else if (floorLower.includes("parter")) {
      return "0";
    } else if (floorLower.includes("poddasze")) {
      return "99";
    } else if (floorLower.includes("powyżej 10")) {
      return "11";
    } else {
      const floorMatch = /\d+/.exec(floorString);
      if (floorMatch !== null) {
        const floorNumber = Number.parseInt(floorMatch[0]);
        if (floorNumber >= 1 && floorNumber <= 10) {
          return floorMatch[0];
        } else if (floorNumber > 10) {
          return "11";
        }
      }
    }
    return null;
  }

  parseBuildingType(buildingTypeString: string): BuildingType {
    const buildingTypeLower = buildingTypeString.toLowerCase();

    if (
      buildingTypeLower.includes("dom wolnostojący") ||
      buildingTypeLower.includes("wolnostojący")
    ) {
      return BuildingType.DETACHED;
    } else if (
      buildingTypeLower.includes("dom szeregowy") ||
      buildingTypeLower.includes("szeregowy")
    ) {
      return BuildingType.TERRACED;
    } else if (
      buildingTypeLower.includes("kamienica") ||
      buildingTypeLower.includes("tenement")
    ) {
      return BuildingType.TENEMENT;
    } else if (
      buildingTypeLower.includes("blok") ||
      buildingTypeLower.includes("block")
    ) {
      return BuildingType.BLOCK_OF_FLATS;
    } else if (buildingTypeLower.includes("loft")) {
      return BuildingType.LOFT;
    } else if (
      buildingTypeLower.includes("mieszkanie") ||
      buildingTypeLower.includes("apartment")
    ) {
      return BuildingType.APARTMENT;
    } else {
      return BuildingType.OTHER;
    }
  }

  parseOwnerType(parameters: Record<string, string>): OwnerType | null {
    const ownerTypeString = this.findParamValue(parameters, "Prywatne") ?? "";
    const firmowString = this.findParamValue(parameters, "Firmowe") ?? "";
    const otodomOwnerTypeString =
      this.findParamValue(parameters, "typ ogłoszeniodawcy") ?? "";

    if (
      ownerTypeString.toLowerCase().includes("prywatne") ||
      ownerTypeString.toLowerCase().trim() === "tak" ||
      otodomOwnerTypeString.toLowerCase().includes("prywatny")
    ) {
      return OwnerType.PRIVATE;
    } else if (
      firmowString.toLowerCase().trim() === "tak" ||
      (this.findParamValue(parameters, "Biuro nieruchomości") !== undefined &&
        this.findParamValue(parameters, "Biuro nieruchomości") !== "") ||
      otodomOwnerTypeString.toLowerCase().includes("biuro") ||
      otodomOwnerTypeString.toLowerCase().includes("firmowy") ||
      otodomOwnerTypeString.toLowerCase().includes("deweloper") ||
      otodomOwnerTypeString.toLowerCase().includes("agencja")
    ) {
      return OwnerType.COMPANY;
    } else {
      return null;
    }
  }

  parseParkingType(parkingString: string): ParkingType | null {
    if (parkingString === "") {
      return null;
    }

    const parkingLower = parkingString.toLowerCase();

    if (
      parkingLower.includes("identyfikator do strefy płatnego parkowania") ||
      parkingLower.includes("płatny parking")
    ) {
      return ParkingType.IDENTIFICATOR_FOR_PAID_PARKING;
    } else if (
      parkingLower.includes("w garażu") ||
      parkingLower.includes("garage")
    ) {
      return ParkingType.GARAGE;
    } else if (
      parkingLower.includes("parking strzeżony") ||
      parkingLower.includes("secured")
    ) {
      return ParkingType.SECURED;
    } else if (
      parkingLower.includes("przynależne na ulicy") ||
      parkingLower.includes("street")
    ) {
      return ParkingType.STREET;
    } else if (
      parkingLower.includes("brak") ||
      parkingLower.includes("none") ||
      parkingLower.includes("nie")
    ) {
      return ParkingType.NONE;
    } else {
      return null;
    }
  }

  parseRentAdditional(rentAdditionalString: string): number | null {
    if (rentAdditionalString === "") {
      return null;
    }
    const rentMatch = /(\d+(?:[,.]\d+)?)/.exec(rentAdditionalString);
    return rentMatch === null
      ? null
      : Number.parseFloat(rentMatch[1].replace(",", "."));
  }

  parseOlxParameters(
    rawParameters: Record<string, string>,
  ): ParsedOfferParameters {
    const footage = this.parseFootage(rawParameters.Powierzchnia || "");
    const rooms = this.parseRooms(rawParameters["Liczba pokoi"] || "");
    const floor = this.parseFloor(
      rawParameters.Poziom || rawParameters["Piętro"] || "",
    );

    const furniture = this.parseBoolean(
      this.findParamValue(rawParameters, "Umeblowane") ??
        this.findParamValue(rawParameters, "umeblowane"),
      "Furniture",
    );

    const elevator = this.parseBoolean(
      this.findParamValue(rawParameters, "Winda") ??
        this.findParamValue(rawParameters, "winda"),
      "Elevator",
    );

    const petsParameter =
      this.findParamValue(rawParameters, "Zwierzęta") ??
      this.findParamValue(rawParameters, "Przyjazne zwierzętom");
    const pets = this.parseBoolean(petsParameter, "Pets");

    const buildingType = rawParameters["Rodzaj zabudowy"]
      ? this.parseBuildingType(rawParameters["Rodzaj zabudowy"])
      : BuildingType.APARTMENT;

    const ownerType = this.parseOwnerType(rawParameters);
    const parkingType = this.parseParkingType(rawParameters.Parking || "");
    const rentAdditional = this.parseRentAdditional(
      rawParameters["Czynsz (dodatkowo)"] ||
        (this.findParamValue(rawParameters, "czynsz dodatkowy") ?? ""),
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
    if (footageText !== null && footageText !== "") {
      return Number.parseFloat(
        footageText.replaceAll(/[^0-9,]/g, "").replace(",", "."),
      );
    }
    const footageDetail =
      details["powierzchnia użytkowa"] ||
      details.powierzchnia ||
      details.surface;
    if (footageDetail) {
      return Number.parseFloat(
        footageDetail.replaceAll(/[^0-9,]/g, "").replace(",", "."),
      );
    }
    return null;
  }
}
