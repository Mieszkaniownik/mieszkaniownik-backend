import { ScrapperService } from "./scrapper.service";
import { Module } from "@nestjs/common";

@Module({
    providers: [ScrapperService], 
    exports: [ScrapperService], 

})export class ScrapperModule {}