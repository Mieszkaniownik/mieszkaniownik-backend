import { Injectable, Logger } from '@nestjs/common';
import { Client, EmbedBuilder, WebhookClient } from 'discord.js';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);
  private client: Client | null = null;

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    if (process.env.DISCORD_BOT_TOKEN) {
      this.client = new Client({
        intents: [],
      });

      this.client.once('ready', () => {
        this.logger.log('Discord client ready');
      });

      this.client.on('error', (error) => {
        this.logger.error('Discord client error:', error);
      });

      const loginTimeout = setTimeout(() => {
        this.logger.error(
          'Discord login timeout after 10 seconds, continuing without Discord',
        );
        if (this.client) {
          void this.client.destroy();
          this.client = null;
        }
      }, 10000);

      this.client
        .login(process.env.DISCORD_BOT_TOKEN)
        .then(() => {
          clearTimeout(loginTimeout);
          this.logger.log('Discord client logged in successfully');
        })
        .catch((error) => {
          clearTimeout(loginTimeout);
          this.logger.error('Discord login failed:', error);
          if (this.client) {
            void this.client.destroy();
            this.client = null;
          }
        });
    } else {
      this.logger.warn(
        'Discord bot token not provided, Discord notifications disabled',
      );
    }
  }

  async sendWebhookMessage(
    webhookUrl: string,
    content: string,
    embeds?: Array<{
      title: string;
      description: string;
      color?: number;
      url?: string;
      fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
      }>;
      image?: {
        url: string;
      };
    }>,
  ): Promise<boolean> {
    try {
      this.logger.debug(`Sending Discord webhook message to: ${webhookUrl}`);
      this.logger.debug(`Content: ${content}`);
      this.logger.debug(`Number of embeds: ${embeds?.length || 0}`);

      if (embeds && embeds.length > 0) {
        embeds.forEach((embed, index) => {
          if (embed.image?.url) {
            this.logger.debug(`Embed ${index + 1} image: ${embed.image.url}`);
          }
        });
      }

      const webhook = new WebhookClient({ url: webhookUrl });

      const discordEmbeds = embeds?.map((embed, index) => {
        const embedBuilder = new EmbedBuilder();

        this.logger.debug(
          `Processing embed ${index + 1}: title="${embed.title}", hasImage=${!!embed.image?.url}`,
        );

        if (embed.title && embed.title.trim()) {
          embedBuilder.setTitle(embed.title.trim());
        }

        if (embed.description && embed.description.trim()) {
          embedBuilder.setDescription(embed.description.trim());
        }

        if (embed.color) {
          embedBuilder.setColor(embed.color);
        }

        if (embed.fields && embed.fields.length > 0) {
          embedBuilder.addFields(embed.fields);
        }

        if (embed.url) {
          embedBuilder.setURL(embed.url);
        }

        if (embed.image && embed.image.url) {
          embedBuilder.setImage(embed.image.url);
        }

        return embedBuilder;
      });

      await webhook.send({
        content,
        embeds: discordEmbeds,
      });

      this.logger.log(
        `Discord webhook message sent successfully with ${discordEmbeds?.length || 0} embeds in ONE message`,
      );
      return true;
    } catch (error) {
      this.logger.error('Failed to send Discord webhook message:', error);
      this.logger.error(
        'Webhook URL (masked):',
        webhookUrl.replace(/\/[^/]+\/[^/]+$/, '/****/****'),
      );
      this.logger.error('Content length:', content?.length || 0);
      this.logger.error('Embeds count:', embeds?.length || 0);
      return false;
    }
  }

  generateMatchNotificationEmbed(
    alertName: string,
    offer: {
      link: string;
      title: string;
      price: number;
      city: string;
      district: string | null;
      footage: number | null;
      street: string | null;
      streetNumber: string | null;
      ownerType: string | null;
      buildingType: string | null;
      parkingType: string | null;
      rooms: number | null;
      floor: number | null;
      elevator: boolean | null;
      furniture: boolean | null;
      pets: boolean | null;
      rentAdditional: number | null;
      negotiable: boolean | null;
      contact: string | null;
      views: number;
      createdAt: Date;
      images: string[];
      source: string;
      isNew: boolean;
      summary: string | null;
      latitude?: number | null;
      longitude?: number | null;
      media?: string | null;
      furnishing?: string | null;
      infoAdditional?: string | null;
    },
  ): {
    content: string;
    embeds: Array<{
      title: string;
      description: string;
      color: number;
      url?: string;
      fields: Array<{
        name: string;
        value: string;
        inline: boolean;
      }>;
      image?: {
        url: string;
      };
    }>;
  } {
    const content = `${offer.isNew ? 'znalazł **NOWĄ OFERTĘ**' : 'znalazł dopasowanie'} dla **${alertName}!**`;

    this.logger.debug(
      `Generating Discord embed for offer: title="${offer.title}", price=${offer.price}, city="${offer.city}", images=${offer.images?.length || 0}`,
    );

    if (offer.images && offer.images.length > 0) {
      this.logger.debug(`First image URL: ${offer.images[0]}`);
    }

    const formatPrice = (price: number) => price.toLocaleString('pl-PL');
    const formatDate = (date: Date) => date.toLocaleDateString('pl-PL');

    const getOwnerTypeDisplay = (type: string | null) => {
      const types = {
        PRIVATE: 'Prywatny',
        COMPANY: 'Firma',
        ALL: 'Wszyscy',
      };
      return type ? types[type as keyof typeof types] || type : 'Nie podano';
    };

    const getBuildingTypeDisplay = (type: string | null) => {
      const types = {
        BLOCK_OF_FLATS: 'Blok',
        TENEMENT: 'Kamienica',
        DETACHED: 'Dom wolnostojący',
        TERRACED: 'Dom szeregowy',
        APARTMENT: 'Mieszkanie',
        LOFT: 'Loft',
        OTHER: 'Inne',
      };
      return type ? types[type as keyof typeof types] || type : 'Nie podano';
    };

    const getParkingTypeDisplay = (type: string | null) => {
      const types = {
        NONE: 'Brak',
        STREET: 'Na ulicy',
        SECURED: 'Strzeżony',
        GARAGE: 'Garaż',
        IDENTIFICATOR_FOR_PAID_PARKING: 'Identyfikator do płatnego parkingu',
      };
      return type ? types[type as keyof typeof types] || type : 'Nie podano';
    };

    const getBooleanDisplay = (value: boolean | null) => {
      if (value === null) return 'Nie podano';
      return value ? '✅' : '❌';
    };

    const fields = [
      {
        name: 'Cena',
        value: `${formatPrice(offer.price)} PLN${offer.negotiable ? ' (do negocjacji)' : ''}`,
        inline: true,
      },
      {
        name: 'Lokalizacja',
        value: `${offer.city}${offer.district ? `, ${offer.district}` : ''}`,
        inline: true,
      },
      {
        name: 'Powierzchnia',
        value: `${offer.footage} m²`,
        inline: true,
      },
    ];

    if (offer.street || offer.streetNumber) {
      let addressValue = '';
      if (offer.street) {
        addressValue += offer.street;
      }
      if (offer.streetNumber) {
        addressValue += ` ${offer.streetNumber}`;
      }

      fields.push({
        name: 'Adres',
        value: addressValue.trim(),
        inline: true,
      });
    }

    if (offer.floor !== null) {
      fields.push({
        name: 'Piętro',
        value: offer.floor === 0 ? 'Parter' : offer.floor.toString(),
        inline: true,
      });
    }

    if (offer.rooms) {
      fields.push({
        name: 'Pokoje',
        value: offer.rooms.toString(),
        inline: true,
      });
    }

    fields.push(
      {
        name: 'Właściciel',
        value: getOwnerTypeDisplay(offer.ownerType),
        inline: true,
      },
      {
        name: 'Typ budynku',
        value: getBuildingTypeDisplay(offer.buildingType),
        inline: true,
      },
      {
        name: 'Winda',
        value: getBooleanDisplay(offer.elevator),
        inline: true,
      },
      {
        name: 'Umeblowane',
        value: getBooleanDisplay(offer.furniture),
        inline: true,
      },
    );

    if (offer.source !== 'otodom') {
      fields.push(
        {
          name: 'Parking',
          value: getParkingTypeDisplay(offer.parkingType),
          inline: true,
        },
        {
          name: 'Zwierzęta',
          value: getBooleanDisplay(offer.pets),
          inline: true,
        },
      );
    }

    if (offer.rentAdditional) {
      fields.push({
        name: 'Czynsz dodatkowy',
        value: `${formatPrice(offer.rentAdditional)} PLN`,
        inline: true,
      });
    }

    fields.push(
      {
        name: 'Źródło',
        value: offer.source === 'otodom' ? 'Otodom' : 'OLX',
        inline: true,
      },
      {
        name: 'Statystyki',
        value: `${offer.views} wyświetleń\n${formatDate(offer.createdAt)}`,
        inline: true,
      },
    );

    if (offer.contact) {
      fields.push({
        name: 'Kontakt',
        value: offer.contact,
        inline: true,
      });
    }

    const addressText = `${offer.street ? offer.street : ''}${offer.streetNumber ? ` ${offer.streetNumber}` : ''}${offer.city ? `, ${offer.city}` : ''}`;
    const mapsUrl = this.generateGoogleMapsUrl(
      offer.latitude,
      offer.longitude,
      addressText,
    );

    let description = '';

    if (offer.summary) {
      description += `\n\n**Opis:** ${offer.summary}`;
    }
    if (offer.media) {
      description += `\n\n**Media:** ${offer.media}`;
    }
    if (offer.furnishing) {
      description += `\n\n**Wyposażenie:** ${offer.furnishing}`;
    }
    if (offer.infoAdditional) {
      description += `\n\n**Informacje dodatkowe:** ${offer.infoAdditional}`;
    }

    const embeds: Array<{
      title: string;
      description: string;
      color: number;
      url?: string;
      fields: Array<{
        name: string;
        value: string;
        inline: boolean;
      }>;
      image?: {
        url: string;
      };
    }> = [];

    if (offer.images && offer.images.length > 0) {
      const imagesToShow = offer.images.slice(0, 8);

      this.logger.debug(
        `Processing ${imagesToShow.length} images for Discord embeds`,
      );

      embeds.push({
        title: `${offer.title && offer.title.trim() ? offer.title : 'Nowe mieszkanie'}${offer.isNew ? '[NOWA]' : ''}`,
        description,
        color: offer.isNew ? 0xeab308 : 0x3b82f6,
        url: offer.link,
        fields,
        image: {
          url: imagesToShow[0],
        },
      });

      for (let i = 1; i < imagesToShow.length; i++) {
        this.logger.debug(`Processing image ${i + 1}: ${imagesToShow[i]}`);

        embeds.push({
          title: '',
          description: '',
          color: offer.isNew ? 0xeab308 : 0x3b82f6,
          url: offer.link,
          fields: [],
          image: {
            url: imagesToShow[i],
          },
        });
      }

      this.logger.debug(`Created ${embeds.length} embeds total`);
    } else {
      embeds.push({
        title: `${offer.title && offer.title.trim() ? offer.title : 'Nowe mieszkanie'}${offer.isNew ? ' [NOWA]' : ''}`,
        description,
        color: offer.isNew ? 0xeab308 : 0x3b82f6,
        url: offer.link,
        fields,
      });
    }

    let addressValue = '';
    if (offer.street) {
      addressValue += offer.street;
    }
    if (offer.streetNumber) {
      addressValue += ` ${offer.streetNumber}`;
    }

    const staticMapUrl = this.generateStaticMapUrl(
      offer.latitude,
      offer.longitude,
      addressText,
    );

    if (staticMapUrl) {
      this.logger.debug(`Adding static map embed: ${staticMapUrl}`);
      const fullAddress = [
        offer.city,
        offer.district,
        offer.street,
        offer.streetNumber,
      ]
        .filter(Boolean)
        .join(', ');

      embeds.push({
        title: fullAddress || addressValue.trim(),
        description: ``,
        color: offer.isNew ? 0xeab308 : 0x3b82f6,
        url: mapsUrl,
        fields: [],
        image: {
          url: staticMapUrl,
        },
      });
    } else if (mapsUrl) {
      this.logger.debug(
        'Static map not available, Google Maps API key missing',
      );
      embeds.push({
        title: 'Lokalizacja',
        description: `${mapsUrl}`,
        color: offer.isNew ? 0xeab308 : 0x3b82f6,
        url: mapsUrl,
        fields: [],
      });
    }

    return { content, embeds };
  }

  testConnection(): boolean {
    try {
      if (!this.client) {
        return false;
      }

      return this.client.isReady();
    } catch (error) {
      this.logger.error('Discord connection test failed:', error);
      return false;
    }
  }

  async validateWebhook(webhookUrl: string): Promise<boolean> {
    try {
      const webhook = new WebhookClient({ url: webhookUrl });
      await webhook.fetchMessage('@original');
      return true;
    } catch (error) {
      this.logger.warn(`Invalid Discord webhook URL: ${webhookUrl}`, error);
      return false;
    }
  }

  private generateGoogleMapsUrl(
    latitude?: number | null,
    longitude?: number | null,
    address?: string,
  ): string {
    if (latitude && longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    } else if (address) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    }
    return '';
  }

  private generateStaticMapUrl(
    latitude?: number | null,
    longitude?: number | null,
    address?: string,
  ): string {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      this.logger.debug('Google Maps API key not set - static maps disabled.');
      return '';
    }

    const size = '600x400';
    const zoom = '14';
    const maptype = 'roadmap';

    if (latitude && longitude) {
      const marker = `markers=color:red%7Clabel:M%7C${latitude},${longitude}`;
      return `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=${zoom}&size=${size}&maptype=${maptype}&${marker}&key=${apiKey}`;
    } else if (address) {
      const encodedAddress = encodeURIComponent(address);
      const marker = `markers=color:red%7Clabel:M%7C${encodedAddress}`;
      return `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=${zoom}&size=${size}&maptype=${maptype}&${marker}&key=${apiKey}`;
    }
    return '';
  }
}
