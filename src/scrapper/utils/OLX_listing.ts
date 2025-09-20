import { Listing_type } from "@prisma/client";
import { CreateOfferDto } from "../../offer/dto/create-offer.dto";
import { BadRequestException } from "@nestjs/common";

export interface OLXListing {
  id: string;
  title: string;
  description: string;
  url: string;
  created_time: string;
  location: {
    city: { name: string };
    district?: { name: string };
    region: { name: string };
  };
  params: Array<{
    key: string;
    name: string;
    value: {
      value?: number;
      currency?: string;
      label?: string;
      arranged?: boolean;
      negotiable?: boolean;
    };
  }>;
  photos: Array<{
    link: string;
    width: number;
    height: number;
  }>;
  user: {
    name: string;
    is_online: boolean;
  };
}
export function extract_data(listings: OLXListing[]):CreateOfferDto[]{
  let result: CreateOfferDto[]= []; 
  for(const listing of listings){
      const offer = convertListingToOffer(listing)
      if(offer){
        result.push(offer); 
      }
  }
  return result; 
}
function convertListingToOffer(listing: OLXListing){
  try {
      const priceParam = listing.params.find(p => p.key === 'price');
      const price = priceParam?.value?.value;
      if (!price) throw new BadRequestException("No price for listing"); 

      const footageParam = listing.params.find(p => 
        p.key === 'footage' || p.name?.toLowerCase().includes('powierzchnia')
      );
      const footage = footageParam?.value?.value || 
                     parseInt(listing.title.match(/(\d+)\s*m[²2]/i)?.[1] || '0');
      
      const roomsParam = listing.params.find(p => p.name?.toLowerCase().includes('pokoi'));
      const rooms = roomsParam?.value?.value || 
                   parseInt(listing.title.match(/(\d+)[\s-]?pokoi?/i)?.[1] || '1');
      
      const city = listing.location.city.name;
      const address = listing.location.district?.name 
        ? `${city}, ${listing.location.district.name}` 
        : city;
      
      const negotiable = priceParam?.value?.negotiable === true ||
                        listing.title.toLowerCase().includes('nego');
      
      const text = `${listing.title} ${listing.description}`.toLowerCase();
      const furniture = text.includes('meblowane') || text.includes('umeblowane');
      const pets_allowed = text.includes('zwierzęta') || text.includes('zwierzak');
      const elevator = text.includes('winda');
      
      const floorParam = listing.params.find(p => p.name?.toLowerCase().includes('piętro'));
      const floor = floorParam?.value?.value ? Math.round(floorParam.value.value) : undefined;
      
      const offer: CreateOfferDto = {
        link: listing.url,
        price: price,
        footage: footage,
        rooms: rooms,
        added_at: new Date(listing.created_time),
        udpated_at: new Date(),
        valid_to: undefined,
        city: city,
        address: address,
        furniture: furniture,
        negotiable: negotiable,
        pets_allowed: pets_allowed,
        floor: floor,
        elevator: elevator
      };
      return offer; 

  }
  catch(error){
    console.error(error)
  }
}
