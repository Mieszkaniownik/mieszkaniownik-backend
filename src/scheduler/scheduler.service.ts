import { Injectable } from "@nestjs/common";
import { ScrapperService } from "src/scrapper/scrapper.service";
import { OfferService } from "src/offer/offer.service";
import { Cron, CronExpression} from "@nestjs/schedule" 
import { CreateOfferDto } from "src/offer/dto/create-offer.dto";
@Injectable()
export class SchedulerService {
    constructor(
        private scrapper: ScrapperService,
        private offer_service: OfferService, 
    ) {}
    
    @Cron(CronExpression.EVERY_10_SECONDS)
    async fetch_new_data(): Promise<CreateOfferDto[]> {
        const newOffers: CreateOfferDto[]=[];
        let offset=0; 
        const limit= 50;
        const listings= await this.scrapper.searchApartments({offset, limit})
        for(const listing of listings){
            await this.offer_service.findOneOrCreate(listing);
        }
        console.log(listings);
        return listings;
    }

}