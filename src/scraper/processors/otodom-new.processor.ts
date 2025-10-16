import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { OtodomScraperService } from '../services/otodom-scraper.service';
import { BrowserSetupService } from '../services/browser-setup.service';

@Processor('otodom-new', {
  concurrency: 3,
  lockDuration: 120000,
})
export class OtodomNewProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(OtodomNewProcessor.name);

  constructor(
    private readonly otodomScraperService: OtodomScraperService,
    private readonly browserSetup: BrowserSetupService,
  ) {
    super();
  }

  onModuleInit() {
    this.logger.log(
      'OtodomNewProcessor initialized and ready to process jobs!',
    );
  }

  async process(job: Job<{ url: string; isNew?: boolean }>): Promise<void> {
    this.logger.log(
      `Processing NEW Otodom offer: ${job.data.url} (Job ID: ${job.id})`,
    );

    try {
      await this.browserSetup.scrapeWithBrowser(
        job.data.url,
        true,
        async (page) => {
          await this.otodomScraperService.processOffer(
            page,
            job.data.url,
            true,
          );
        },
      );

      this.logger.log(
        `Successfully processed NEW Otodom offer: ${job.data.url}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process NEW Otodom offer: ${job.data.url}`,
        error,
      );
      throw error;
    }
  }
}
