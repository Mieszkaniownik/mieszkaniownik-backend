import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { OlxScraperService } from '../services/olx-scraper.service';
import { BrowserSetupService } from '../services/browser-setup.service';

@Processor('olx-new', {
  concurrency: 3,
  lockDuration: 120000,
})
export class OlxNewProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(OlxNewProcessor.name);

  constructor(
    private readonly olxScraperService: OlxScraperService,
    private readonly browserSetup: BrowserSetupService,
  ) {
    super();
  }

  onModuleInit() {
    this.logger.log('OlxNewProcessor initialized and ready to process jobs!');
  }

  async process(job: Job<{ url: string; isNew?: boolean }>): Promise<void> {
    this.logger.log(
      `Processing NEW OLX offer: ${job.data.url} (Job ID: ${job.id})`,
    );

    try {
      await this.browserSetup.scrapeWithBrowser(
        job.data.url,
        false,
        async (page) => {
          await this.olxScraperService.processOffer(page, job.data.url, true);
        },
      );

      this.logger.log(`Successfully processed NEW OLX offer: ${job.data.url}`);
    } catch (error) {
      this.logger.error(
        `Failed to process NEW OLX offer: ${job.data.url}`,
        error,
      );
      throw error;
    }
  }
}
