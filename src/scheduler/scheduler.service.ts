import { Injectable } from "@nestjs/common";
import { ScrapperService } from "src/scrapper/scrapper.service";
import { Cron, CronExpression} from "@nestjs/schedule" 
import { CreateOfferDto } from "src/offer/dto/create-offer.dto";
@Injectable()
export class SchedulerService {
    constructor(
        private scrapper: ScrapperService,
    ) {}
    
    @Cron(CronExpression.EVERY_10_SECONDS)
    async fetch_new_data(): Promise<CreateOfferDto[]> {
        const newOffers: CreateOfferDto[]=[];
        let offset=0; 
        const limit= 40;
        const priceTo= "15000";  
        const listings= await this.scrapper.searchApartments({offset, limit, priceTo})
        console.log(listings); 
        return listings;
    }

}