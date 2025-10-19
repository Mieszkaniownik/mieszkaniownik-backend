import { Job } from "bullmq";

import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger, OnModuleInit } from "@nestjs/common";

import { BrowserSetupService } from "../services/browser-setup.service";
import { OlxScraperService } from "../services/olx-scraper.service";

@Processor("olx-new", {
  concurrency: 3,
  lockDuration: 120_000,
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
    this.logger.log("OlxNewProcessor initialized and ready to process jobs!");
  }

  async process(job: Job<{ url: string; isNew?: boolean }>): Promise<void> {
    this.logger.log(
      `Processing NEW OLX offer: ${job.data.url} (Job ID: ${job.id ?? "unknown"})`,
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
