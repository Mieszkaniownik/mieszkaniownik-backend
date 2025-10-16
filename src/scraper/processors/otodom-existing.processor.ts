import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OtodomScraperService } from '../services/otodom-scraper.service';
import { BrowserSetupService } from '../services/browser-setup.service';

@Processor('otodom-existing', {
  concurrency: 2,
  lockDuration: 120000,
})
export class OtodomExistingProcessor extends WorkerHost {
  private readonly logger = new Logger(OtodomExistingProcessor.name);

  constructor(
    private readonly otodomScraperService: OtodomScraperService,
    private readonly browserSetup: BrowserSetupService,
  ) {
    super();
  }

  async process(job: Job<{ url: string; isNew?: boolean }>): Promise<void> {
    this.logger.log(`Processing Otodom existing offer: ${job.data.url}`);

    try {
      await this.browserSetup.scrapeWithBrowser(
        job.data.url,
        true,
        async (page) => {
          await this.otodomScraperService.processOffer(
            page,
            job.data.url,
            false,
          );
        },
      );

      this.logger.log(
        `Successfully processed Otodom existing offer: ${job.data.url}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process Otodom existing offer: ${job.data.url}`,
        error,
      );
      throw error;
    }
  }
}
