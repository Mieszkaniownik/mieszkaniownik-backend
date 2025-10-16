import { PrismaClient } from '@prisma/client';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import type { DatabaseStatsDto } from './dto/database-stats.dto';

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async getStats(): Promise<DatabaseStatsDto> {
    const [users, offers, alerts, matches, notifications] = await Promise.all([
      this.user.count(),
      this.offer.count(),
      this.alert.count(),
      this.match.count(),
      this.notification.count(),
    ]);

    return {
      users,
      offers,
      alerts,
      matches,
      notifications,
      timestamp: new Date(),
    };
  }

  async getAllOffers() {
    return this.offer.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
  async clearAllData(): Promise<void> {
    await this.notification.deleteMany();
    await this.match.deleteMany();
    await this.alert.deleteMany();
    await this.offer.deleteMany();
    await this.user.deleteMany();
  }
}
