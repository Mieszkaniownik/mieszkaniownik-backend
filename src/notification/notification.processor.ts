import { Job, Queue } from "bullmq";

import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";

import { DatabaseService } from "../database/database.service";
import {
  DiscordJobData,
  EmailJobData,
  MatchNotificationData,
} from "./dto/job-data.dto";
import { DiscordService } from "./services/discord.service";
import { EmailService } from "./services/email.service";

@Processor("notifications")
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @InjectQueue("notifications") private readonly notificationQueue: Queue,
    private readonly emailService: EmailService,
    private readonly discordService: DiscordService,
    private readonly databaseService: DatabaseService,
  ) {
    super();
  }

  async process(
    job: Job<EmailJobData | DiscordJobData | MatchNotificationData>,
  ): Promise<unknown> {
    this.logger.debug(`Processing notification job: ${job.name}`, {
      id: job.id,
    });

    switch (job.name) {
      case "send-email": {
        return this.handleEmailJob(job as Job<EmailJobData>);
      }
      case "send-discord": {
        return this.handleDiscordJob(job as Job<DiscordJobData>);
      }
      case "match-notification": {
        return this.handleMatchNotification(job as Job<MatchNotificationData>);
      }
      default: {
        throw new Error(`Unknown job type: ${job.name}`);
      }
    }
  }

  private async handleEmailJob(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, html, notificationId } = job.data;

    try {
      const success = await this.emailService.sendEmail(to, subject, html);

      if (success) {
        await this.updateNotificationStatus(notificationId, true);
        this.logger.log(
          `Email notification sent successfully: ${String(notificationId)}`,
        );
      } else {
        await this.updateNotificationStatus(
          notificationId,
          false,
          "Failed to send email",
        );
        throw new Error("Email sending failed");
      }
    } catch (error) {
      await this.updateNotificationStatus(
        notificationId,
        false,
        error instanceof Error ? error.message : "Unknown error",
      );
      throw error;
    }
  }

  private async handleDiscordJob(job: Job<DiscordJobData>): Promise<void> {
    const { webhookUrl, content, embeds, notificationId } = job.data;

    try {
      const success = await this.discordService.sendWebhookMessage(
        webhookUrl,
        content,
        embeds,
      );

      if (success) {
        await this.updateNotificationStatus(notificationId, true);
        this.logger.log(
          `Discord notification sent successfully: ${String(notificationId)}`,
        );
      } else {
        await this.updateNotificationStatus(
          notificationId,
          false,
          "Failed to send Discord message",
        );
        throw new Error("Discord message sending failed");
      }
    } catch (error) {
      await this.updateNotificationStatus(
        notificationId,
        false,
        error instanceof Error ? error.message : "Unknown error",
      );
      throw error;
    }
  }

  private async handleMatchNotification(
    job: Job<MatchNotificationData>,
  ): Promise<void> {
    const { matchId, alertId, offerId, userId } = job.data;

    try {
      const match = await this.databaseService.match.findUnique({
        where: { id: matchId },
        include: {
          alert: {
            include: { user: true },
          },
          offer: true,
        },
      });

      if (match === null) {
        throw new Error(`Match not found: ${String(matchId)}`);
      }

      const { alert, offer } = match;
      const user = alert.user;

      const offerData = {
        link: offer.link,
        title: offer.title,
        price: Number(offer.price),
        city: offer.city,
        district: offer.district,
        footage: Number(offer.footage),
        ownerType: offer.ownerType,
        buildingType: offer.buildingType,
        parkingType: offer.parkingType,
        rooms: offer.rooms,
        floor: offer.floor,
        elevator: offer.elevator,
        furniture: offer.furniture,
        pets: offer.pets,
        rentAdditional:
          offer.rentAdditional === null ? null : Number(offer.rentAdditional),
        negotiable: offer.negotiable,
        contact: offer.contact,
        views: offer.views,
        createdAt: offer.createdAt,
        source: offer.source,
        isNew: offer.isNew,
        summary: offer.summary,
        street: offer.street,
        streetNumber: offer.streetNumber,
        latitude: offer.latitude === null ? null : Number(offer.latitude),
        longitude: offer.longitude === null ? null : Number(offer.longitude),
        images: offer.images,
        media: offer.media,
        furnishing: offer.furnishing,
        infoAdditional: offer.infoAdditional,
      };

      const emailData = this.emailService.generateMatchNotificationEmail(
        user.name ?? user.username ?? user.email,
        alert.name,
        offerData,
      );

      const discordData = this.discordService.generateMatchNotificationEmbed(
        alert.name,
        offerData,
      );

      const notification = await this.databaseService.notification.create({
        data: {
          title: emailData.subject,
          message: `Match found for alert: ${alert.name}`,
          type: "MATCH_NOTIFICATION",
          method: alert.notificationMethod,
          userId: user.id,
          alertId: alert.id,
        },
      });

      if (
        alert.notificationMethod === "EMAIL" ||
        alert.notificationMethod === "BOTH"
      ) {
        await this.notificationQueue.add("send-email", {
          to: user.email,
          subject: emailData.subject,
          html: emailData.html,
          notificationId: notification.id,
        });
      }

      if (
        (alert.notificationMethod === "DISCORD" ||
          alert.notificationMethod === "BOTH") &&
        alert.discordWebhook !== null &&
        alert.discordWebhook !== ""
      ) {
        await this.notificationQueue.add("send-discord", {
          webhookUrl: alert.discordWebhook,
          content: discordData.content,
          embeds: discordData.embeds,
          notificationId: notification.id,
        });
      }

      await this.databaseService.match.update({
        where: { id: matchId },
        data: { notificationSent: true },
      });

      this.logger.log(
        `Match notification processed successfully for user ${String(userId)}, alert ${String(alertId)}, offer ${String(offerId)}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process match notification: ${String(matchId)}`,
        error,
      );
      throw error;
    }
  }

  private async updateNotificationStatus(
    notificationId: number,
    sent: boolean,
    error?: string,
  ): Promise<void> {
    try {
      const existingNotification =
        await this.databaseService.notification.findUnique({
          where: { id: notificationId },
        });

      if (existingNotification === null) {
        this.logger.warn(
          `Notification ${String(notificationId)} not found in database. `,
        );
        return;
      }

      await this.databaseService.notification.update({
        where: { id: notificationId },
        data: {
          sent,
          sentAt: sent ? new Date() : undefined,
          error: sent ? null : error,
          updatedAt: new Date(),
        },
      });
    } catch (error_) {
      this.logger.error(
        `Failed to update notification status: ${String(notificationId)}`,
        error_,
      );
    }
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job) {
    this.logger.debug(`Job completed: ${job.name}`, { id: job.id });
  }

  @OnWorkerEvent("progress")
  onProgress(job: Job, progress: number) {
    this.logger.debug(`Job progress: ${job.name} - ${String(progress)}%`, {
      id: job.id,
    });
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job failed: ${job.name}`, {
      id: job.id,
      error: error.message,
    });
  }
}
