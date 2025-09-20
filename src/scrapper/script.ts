import { ScrapperService } from "./scrapper.service"
import { dto_toString } from "../offer/dto/create-offer.dto";
async function main(){
  const scrapper= new ScrapperService; 
  const response = await scrapper.searchApartments({priceTo: "10000"});
  for(let i=0; i<=5; i++){
    console.log(dto_toString(response[i]))
  }
}
main().catch();