import { BadRequestException } from "@nestjs/common";
import { CreateOfferDto } from "../../offer/dto/create-offer.dto";

// Typy dla parametrów OLX
interface PriceParam {
  __typename: "PriceParam";
  value: number;
  currency: string;
  label: string;
  negotiable: boolean;
  arranged: boolean;
  budget: boolean;
}

interface GenericParam {
  __typename: "GenericParam";
  key?: string;   
  label?: string;
}


interface CheckboxesParam {
  __typename: "CheckboxesParam";
  label: string;
  checkboxParamKey: string[];
}

interface OLXParam {
  key: string;
  name: string;
  type: string;
  value: PriceParam | GenericParam | CheckboxesParam;
}

export interface OLXListing {
  id: number;
  title: string;
  description?: string;
  url: string;
  created_time: string;
  last_refresh_time?: string;
  status: string;
  business: boolean;
  offer_type: string;
  location: {
    city: {
      id: number;
      name: string;
      normalized_name: string;
    };
    district?: {
      id: number;
      name: string;
      normalized_name: string | null;
    };
    region: {
      id: number;
      name: string;
      normalized_name: string;
    };
  };
  params: OLXParam[];
  photos: Array<{
    link: string;
    width: number;
    height: number;
    rotation: number;
  }>;
  contact: {
    chat: boolean;
    courier: boolean;
    name: string;
    negotiation: boolean;
    phone: boolean;
  };
  user: {
    id: number;
    name: string;
    is_online: boolean;
    last_seen?: string;
    created?: string;
    seller_type?: string | null;
  };
  promotion: {
    highlighted: boolean;
    top_ad: boolean;
    urgent: boolean;
    premium_ad_page: boolean;
    b2c_ad_page: boolean;
  };
  map?: {
    lat: number;
    lon: number;
    radius: number;
    show_detailed: boolean;
    zoom: number;
  };
  valid_to_time?: string;
}

export function extract_data(listings: OLXListing[]): CreateOfferDto[] {
  const result: CreateOfferDto[] = [];
  
  for (const listing of listings) {
    debug_parking(listing); 
    try {
      const offer = convertListingToOffer(listing);
      if (offer) {
        result.push(offer);
      }
    } catch (error) {
      console.error(`❌ Error converting listing ${listing.id}:`, error);
      // Kontynuuj z następnym ogłoszeniem
    }
  }
  
  return result;
}

function safeParseInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value);
  return isNaN(parsed) ? undefined : parsed;
}

function safeParseFloat(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? undefined : parsed;
}

function convertListingToOffer(listing: OLXListing): CreateOfferDto | null {
  try {
    // === CENA (wymagana) ===
    const priceParam = listing.params.find(p => p.key === "price");
    if (!priceParam || priceParam.value.__typename !== "PriceParam") {
      console.warn(`⚠️ Listing ${listing.id}: No price, skipping`);
      return null;
    }
    const { value: price, negotiable, arranged } = priceParam.value;
    const isNegotiable = negotiable || arranged;

    // === PARAMS ===
    const areaParam = listing.params.find(p => p.key === "m")?.value as GenericParam;
    const roomsParam = listing.params.find(p => p.key === "rooms")?.value as GenericParam;
    const floorParam = listing.params.find(p => p.key === "floor_select")?.value as GenericParam;
    const furnitureParam = listing.params.find(p => p.key === "furniture")?.value as GenericParam;
    const petsParam = listing.params.find(p => p.key === "pets")?.value as GenericParam;
    const elevatorParam = listing.params.find(p => p.key === "winda")?.value as GenericParam;
    const rentParam = listing.params.find(p => p.key === "rent")?.value as GenericParam;
    const buildingTypeParam = listing.params.find(p => p.key === "builttype")?.value as GenericParam;
    const parkingParam = listing.params.find(p => p.key === "parking");

    // === KONWERSJE ===
    const footage = parseNumberFromLabel(areaParam?.label);
    const rooms = parseRooms(roomsParam);
    const floor = parseFloor(floorParam);
    const furniture = parseBooleanParam(furnitureParam);
    const pets_allowed = parseBooleanParam(petsParam);
    const elevator = parseBooleanParam(elevatorParam);
    const additionalRent = parseAdditionalRent(rentParam);
    const buildingType = buildingTypeParam?.label;
    const hasParking   = parseParking(parkingParam);

    // === LOKALIZACJA ===
    const city = listing.location.city.name;
    const district = listing.location.district?.name;
    const address = district ? `${city}, ${district}` : city;

    // === DATY ===
    const added_at = new Date(listing.created_time);
    const updated_at = listing.last_refresh_time ? new Date(listing.last_refresh_time) : new Date();
    const valid_to = listing.valid_to_time ? new Date(listing.valid_to_time) : undefined;

    // === DTO ===
    const offer: CreateOfferDto = {
      link: listing.url,
      price,
      footage,
      rooms,
      added_at,
      udpated_at: updated_at,
      valid_to,
      city,
      address,
      furniture,
      negotiable: isNegotiable,
      pets_allowed,
      floor,
      elevator,
      additional_rent: additionalRent,
      building_type: buildingType,
      parking: hasParking || undefined,
    };

    return offer;
  } catch (error) {
    console.error(`❌ Error in convertListingToOffer for listing ${listing.id}:`, error);
    if (error instanceof Error) {
      console.error(`   Stack: ${error.stack}`);
    }
    return null;
  }
}


function parseNumberFromLabel(label?: string): number | undefined {
  if (!label) return undefined;
  const match = label.match(/(\d+(?:[.,]\d+)?)/);
  return match ? safeParseFloat(match[1].replace(",", ".")) : undefined;
}

function parseBooleanParam(param?: GenericParam): boolean | undefined {
  if (!param) return undefined;

  const key = param.key?.toLowerCase();
  if (key === "yes" || key === "tak") return true;
  if (key === "no" || key === "nie") return false;

  const label = param.label?.toLowerCase();
  if (label === "yes" || label === "tak") return true;
  if (label === "no" || label === "nie") return false;

  return undefined;
}

function parseRooms(param?: GenericParam): number | undefined {
  if (!param) return undefined;

  const key = param.key?.toLowerCase();
  const roomMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
  };

  if (key && key in roomMap) {
    return roomMap[key];
  }

  const label = param.label?.toLowerCase();
  if (!label) return undefined;

  if (label.includes("kawalerka")) return 1;

  const match = label.match(/(\d+)/);
  return match ? parseInt(match[1]) : undefined;
}

function parseFloor(param?: GenericParam): number | undefined {
  if (!param) return undefined;

  const key = param.key?.toLowerCase();
  if (key === "parter" || key === "floor_0") return 0;

  const matchKey = key?.match(/floor_(\d+)/);
  if (matchKey) return safeParseInt(matchKey[1]);

  const label = param.label?.toLowerCase();
  if (!label) return undefined;

  if (label.includes("parter")) return 0;
  if (label.includes("suterena")) return -1;

  const matchLabel = label.match(/(\d+)/);
  return matchLabel ? parseInt(matchLabel[1]) : undefined;
}

function parseAdditionalRent(param?: GenericParam): number | undefined {
  if (!param?.label) return undefined;
  const match = param.label.match(/(\d+)/);
  return match ? parseInt(match[1]) : undefined;
}

function parseParking(param?: OLXParam): string | undefined {
  if (!param) return undefined;

  if (param.value.__typename === "CheckboxesParam") {
    return param.value.label?.trim();
  }

  if (param.value.__typename === "GenericParam") {
    return param.value.label ?? param.value.key;
  }

  return undefined;
}


function debug_parking(listing: OLXListing): void { 
  console.log(`\n=== PARKING DEBUG dla ${listing.id} ===`);
  const parkingParam = listing.params.find(p => p.key === "parking");
  console.log('parkingParam:', JSON.stringify(parkingParam, null, 2));
  console.log('Result:', parseParking(parkingParam));
}