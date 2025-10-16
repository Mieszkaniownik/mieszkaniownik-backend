import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { BaseScraperService } from './base-scraper.service';
import { ParameterParserService } from './parameter-parser.service';
import { ScraperOfferMapperService } from './scraper-offer-mapper.service';
import { ScraperProcessor } from '../scraper.processor';

@Injectable()
export class OtodomScraperService {
  private readonly logger = new Logger(OtodomScraperService.name);

  constructor(
    private readonly baseService: BaseScraperService,
    private readonly paramParser: ParameterParserService,
    private readonly mapperService: ScraperOfferMapperService,
    private readonly scraperProcessor: ScraperProcessor,
  ) {}

  async processOffer(
    page: puppeteer.Page,
    url: string,
    isNew: boolean,
  ): Promise<void> {
    this.logger.log(
      `Otodom Service processing offer: ${url} (isNew: ${isNew})`,
    );

    await this.scraperProcessor.processOtodomOffer(page, url, isNew);

    this.logger.debug(`Otodom Service completed processing: ${url}`);
  }
}
