import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import {
  EmailJobData,
  DiscordJobData,
  MatchNotificationData,
} from './dto/job-data.dto';
import { NotificationMethod } from '@prisma/client';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectQueue('notifications') private notificationQueue: Queue,
    private readonly databaseService: DatabaseService,
  ) {}

  async create(createNotificationDto: CreateNotificationDto) {
    const notification = await this.databaseService.notification.create({
      data: createNotificationDto,
    });

    this.logger.log(`Notification created: ${notification.id}`);
    return notification;
  }

  async findTestUser(): Promise<number> {
    const testUser = await this.databaseService.user.findFirst({
      select: { id: true },
    });

    if (!testUser) {
      throw new Error(
        'No users found in database. Please create a user first.',
      );
    }

    return testUser.id;
  }

  async findAll() {
    return this.databaseService.notification.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
          },
        },
        alert: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    return this.databaseService.notification.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
          },
        },
        alert: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findByUser(userId: number) {
    return this.databaseService.notification.findMany({
      where: { userId },
      include: {
        alert: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async remove(id: number) {
    return this.databaseService.notification.delete({
      where: { id },
    });
  }

  async notifyMatch(matchId: number): Promise<void> {
    try {
      const job = await this.notificationQueue.add(
        'match-notification',
        {
          matchId,
          alertId: 0,
          offerId: 0,
          userId: 0,
        } as MatchNotificationData,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      this.logger.log(
        `Match notification job queued: ${job.id} for match ${matchId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue match notification for match ${matchId}:`,
        error,
      );
      throw error;
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    userId: number,
    alertId: number,
  ): Promise<void> {
    try {
      const notification = await this.create({
        title: subject,
        message: 'Email notification',
        type: 'EMAIL',
        method: NotificationMethod.EMAIL,
        userId,
        alertId,
      });

      const job = await this.notificationQueue.add(
        'send-email',
        {
          to,
          subject,
          html,
          notificationId: notification.id,
        } as EmailJobData,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );

      this.logger.log(
        `Email job queued: ${job.id} for notification ${notification.id}`,
      );
    } catch (error) {
      this.logger.error(`Failed to queue email notification:`, error);
      throw error;
    }
  }

  async sendDiscord(
    webhookUrl: string,
    content: string,
    embeds: Array<{
      title: string;
      description: string;
      color?: number;
      fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
      }>;
    }>,
    userId: number,
    alertId: number,
  ): Promise<void> {
    try {
      const notification = await this.create({
        title: 'Discord Notification',
        message: content,
        type: 'DISCORD',
        method: NotificationMethod.DISCORD,
        userId,
        alertId,
      });

      const job = await this.notificationQueue.add(
        'send-discord',
        {
          webhookUrl,
          content,
          embeds,
          notificationId: notification.id,
        } as DiscordJobData,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );

      this.logger.log(
        `Discord job queued: ${job.id} for notification ${notification.id}`,
      );
    } catch (error) {
      this.logger.error(`Failed to queue Discord notification:`, error);
      throw error;
    }
  }

  async getStats() {
    const [total, sent, pending, failed] = await Promise.all([
      this.databaseService.notification.count(),
      this.databaseService.notification.count({ where: { sent: true } }),
      this.databaseService.notification.count({
        where: { sent: false, error: null },
      }),
      this.databaseService.notification.count({
        where: { sent: false, error: { not: null } },
      }),
    ]);

    return {
      total,
      sent,
      pending,
      failed,
    };
  }

  async retryFailed(notificationId: number): Promise<void> {
    const notification = await this.databaseService.notification.findUnique({
      where: { id: notificationId },
      include: { user: true, alert: true },
    });

    if (!notification || notification.sent) {
      throw new Error('Notification not found or already sent');
    }

    await this.databaseService.notification.update({
      where: { id: notificationId },
      data: {
        error: null,
        updatedAt: new Date(),
      },
    });

    if (notification.method === NotificationMethod.EMAIL) {
      this.logger.warn(
        'Email retry not fully implemented - need to store original email data',
      );
    } else if (notification.method === NotificationMethod.DISCORD) {
      this.logger.warn(
        'Discord retry not fully implemented - need to store original Discord data',
      );
    }

    this.logger.log(`Notification retry initiated: ${notificationId}`);
  }

  async cleanup(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.databaseService.notification.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        sent: true,
      },
    });

    this.logger.log(`Cleaned up ${result.count} old notifications`);
    return result.count;
  }
}
