import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { BaseScraperService } from './base-scraper.service';
import { ParameterParserService } from './parameter-parser.service';
import { ScraperOfferMapperService } from './scraper-offer-mapper.service';
import { ScraperProcessor } from '../scraper.processor';

@Injectable()
export class OlxScraperService {
  private readonly logger = new Logger(OlxScraperService.name);

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
    this.logger.log(`OLX Service processing offer: ${url} (isNew: ${isNew})`);

    await this.scraperProcessor.processOlxOffer(page, url, isNew);

    this.logger.debug(`OLX Service completed processing: ${url}`);
  }
}
