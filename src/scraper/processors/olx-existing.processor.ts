import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OlxScraperService } from '../services/olx-scraper.service';
import { BrowserSetupService } from '../services/browser-setup.service';

@Processor('olx-existing', {
  concurrency: 2,
  lockDuration: 120000,
})
export class OlxExistingProcessor extends WorkerHost {
  private readonly logger = new Logger(OlxExistingProcessor.name);

  constructor(
    private readonly olxScraperService: OlxScraperService,
    private readonly browserSetup: BrowserSetupService,
  ) {
    super();
  }

  async process(job: Job<{ url: string; isNew?: boolean }>): Promise<void> {
    this.logger.log(`Processing OLX existing offer: ${job.data.url}`);

    try {
      await this.browserSetup.scrapeWithBrowser(
        job.data.url,
        false,
        async (page) => {
          await this.olxScraperService.processOffer(page, job.data.url, false);
        },
      );

      this.logger.log(
        `Successfully processed OLX existing offer: ${job.data.url}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process OLX existing offer: ${job.data.url}`,
        error,
      );
      throw error;
    }
  }
}
