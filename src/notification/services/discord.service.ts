import { Client, EmbedBuilder, WebhookClient } from "discord.js";

import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);
  private client: Client | null = null;

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    if (
      process.env.DISCORD_BOT_TOKEN !== undefined &&
      process.env.DISCORD_BOT_TOKEN !== ""
    ) {
      this.client = new Client({
        intents: [],
      });

      this.client.once("clientReady", () => {
        this.logger.log("Discord client ready");
      });

      this.client.on("error", (error) => {
        this.logger.error("Discord client error:", error);
      });

      const loginTimeout = setTimeout(() => {
        this.logger.error(
          "Discord login timeout after 10 seconds, continuing without Discord",
        );
        if (this.client !== null) {
          void this.client.destroy();
          this.client = null;
        }
      }, 10_000);

      this.client
        .login(process.env.DISCORD_BOT_TOKEN)
        .then(() => {
          clearTimeout(loginTimeout);
          this.logger.log("Discord client logged in successfully");
        })
        .catch((error: unknown) => {
          clearTimeout(loginTimeout);
          this.logger.error("Discord login failed:", error);
          if (this.client !== null) {
            void this.client.destroy();
            this.client = null;
          }
        });
    } else {
      this.logger.warn(
        "Discord bot token not provided, Discord notifications disabled",
      );
    }
  }

  async sendWebhookMessage(
    webhookUrl: string,
    content: string,
    embeds?: {
      title: string;
      description: string;
      color?: number;
      url?: string;
      fields?: {
        name: string;
        value: string;
        inline?: boolean;
      }[];
      image?: {
        url: string;
      };
    }[],
  ): Promise<boolean> {
    try {
      this.logger.debug(`Sending Discord webhook message to: ${webhookUrl}`);
      this.logger.debug(`Content: ${content}`);
      this.logger.debug(`Number of embeds: ${String(embeds?.length ?? 0)}`);

      if (embeds !== undefined && embeds.length > 0) {
        for (const [index, embed] of embeds.entries()) {
          if (embed.image?.url !== undefined && embed.image.url !== "") {
            this.logger.debug(
              `Embed ${String(index + 1)} image: ${embed.image.url}`,
            );
          }
        }
      }

      const webhook = new WebhookClient({ url: webhookUrl });

      const discordEmbeds = embeds?.map((embed, index) => {
        const embedBuilder = new EmbedBuilder();

        this.logger.debug(
          `Processing embed ${String(index + 1)}: title="${embed.title}", hasImage=${String(Boolean(embed.image?.url))}`,
        );

        if (embed.title.trim() !== "") {
          embedBuilder.setTitle(embed.title.trim());
        }

        if (embed.description.trim() !== "") {
          embedBuilder.setDescription(embed.description.trim());
        }

        if (embed.color !== undefined && embed.color !== 0) {
          embedBuilder.setColor(embed.color);
        }

        if (embed.fields !== undefined && embed.fields.length > 0) {
          embedBuilder.addFields(embed.fields);
        }

        if (embed.url !== undefined && embed.url !== "") {
          embedBuilder.setURL(embed.url);
        }

        if (embed.image?.url !== undefined && embed.image.url !== "") {
          embedBuilder.setImage(embed.image.url);
        }

        return embedBuilder;
      });

      await webhook.send({
        content,
        embeds: discordEmbeds,
      });

      this.logger.log(
        `Discord webhook message sent successfully with ${String(discordEmbeds?.length ?? 0)} embeds in ONE message`,
      );
      return true;
    } catch (error) {
      this.logger.error("Failed to send Discord webhook message:", error);
      this.logger.error(
        "Webhook URL (masked):",
        webhookUrl.replace(/\/[^/]+\/[^/]+$/, "/****/****"),
      );
      this.logger.error("Content length:", content.length);
      this.logger.error("Embeds count:", embeds?.length ?? 0);
      return false;
    }
  }

  private formatPrice(price: number): string {
    return price.toLocaleString("pl-PL");
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString("pl-PL");
  }

  private getOwnerTypeDisplay(type: string | null): string {
    const types = {
      PRIVATE: "Prywatny",
      COMPANY: "Firma",
      ALL: "Wszyscy",
    };
    if (type === null || type === "") {
      return "Nie podano";
    }
    return type in types ? types[type as keyof typeof types] : type;
  }

  private getBuildingTypeDisplay(type: string | null): string {
    const types = {
      BLOCK_OF_FLATS: "Blok",
      TENEMENT: "Kamienica",
      DETACHED: "Dom wolnostojący",
      TERRACED: "Dom szeregowy",
      APARTMENT: "Mieszkanie",
      LOFT: "Loft",
      OTHER: "Inne",
    };
    if (type === null || type === "") {
      return "Nie podano";
    }
    return type in types ? types[type as keyof typeof types] : type;
  }

  private getParkingTypeDisplay(type: string | null): string {
    const types = {
      NONE: "Brak",
      STREET: "Na ulicy",
      SECURED: "Strzeżony",
      GARAGE: "Garaż",
      IDENTIFICATOR_FOR_PAID_PARKING: "Identyfikator do płatnego parkingu",
    };
    if (type === null || type === "") {
      return "Nie podano";
    }
    return type in types ? types[type as keyof typeof types] : type;
  }

  private getBooleanDisplay(value: boolean | null): string {
    if (value === null) {
      return "Nie podano";
    }
    return value ? "✅" : "❌";
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
    embeds: {
      title: string;
      description: string;
      color: number;
      url?: string;
      fields: {
        name: string;
        value: string;
        inline: boolean;
      }[];
      image?: {
        url: string;
      };
    }[];
  } {
    const content = `${offer.isNew ? "znalazł **NOWĄ OFERTĘ**" : "znalazł dopasowanie"} dla **${alertName}!**`;

    this.logger.debug(
      `Generating Discord embed for offer: title="${offer.title}", price=${String(offer.price)}, city="${offer.city}", images=${String(offer.images.length)}`,
    );

    if (offer.images.length > 0) {
      this.logger.debug(`First image URL: ${offer.images[0]}`);
    }

    const fields = [
      {
        name: "Cena",
        value: `${this.formatPrice(offer.price)} PLN${offer.negotiable === true ? " (do negocjacji)" : ""}`,
        inline: true,
      },
      {
        name: "Lokalizacja",
        value: `${offer.city}${offer.district !== null && offer.district !== "" ? `, ${offer.district}` : ""}`,
        inline: true,
      },
      {
        name: "Powierzchnia",
        value:
          offer.footage === null ? "Nie podano" : `${String(offer.footage)} m²`,
        inline: true,
      },
    ];

    if (
      (offer.street !== null && offer.street !== "") ||
      (offer.streetNumber !== null && offer.streetNumber !== "")
    ) {
      let addressValue = "";
      if (offer.street !== null && offer.street !== "") {
        addressValue += offer.street;
      }
      if (offer.streetNumber !== null && offer.streetNumber !== "") {
        addressValue += ` ${offer.streetNumber}`;
      }

      fields.push({
        name: "Adres",
        value: addressValue.trim(),
        inline: true,
      });
    }

    if (offer.floor !== null) {
      fields.push({
        name: "Piętro",
        value: offer.floor === 0 ? "Parter" : offer.floor.toString(),
        inline: true,
      });
    }

    if (offer.rooms !== null && offer.rooms !== 0) {
      fields.push({
        name: "Pokoje",
        value: offer.rooms.toString(),
        inline: true,
      });
    }

    fields.push(
      {
        name: "Właściciel",
        value: this.getOwnerTypeDisplay(offer.ownerType),
        inline: true,
      },
      {
        name: "Typ budynku",
        value: this.getBuildingTypeDisplay(offer.buildingType),
        inline: true,
      },
      {
        name: "Winda",
        value: this.getBooleanDisplay(offer.elevator),
        inline: true,
      },
      {
        name: "Umeblowane",
        value: this.getBooleanDisplay(offer.furniture),
        inline: true,
      },
    );

    if (offer.source !== "otodom") {
      fields.push(
        {
          name: "Parking",
          value: this.getParkingTypeDisplay(offer.parkingType),
          inline: true,
        },
        {
          name: "Zwierzęta",
          value: this.getBooleanDisplay(offer.pets),
          inline: true,
        },
      );
    }

    if (offer.rentAdditional !== null && offer.rentAdditional !== 0) {
      fields.push({
        name: "Czynsz dodatkowy",
        value: `${this.formatPrice(offer.rentAdditional)} PLN`,
        inline: true,
      });
    }

    fields.push(
      {
        name: "Źródło",
        value: offer.source === "otodom" ? "Otodom" : "OLX",
        inline: true,
      },
      {
        name: "Statystyki",
        value: `${String(offer.views)} wyświetleń\n${this.formatDate(offer.createdAt)}`,
        inline: true,
      },
    );

    if (offer.contact !== null && offer.contact !== "") {
      fields.push({
        name: "Kontakt",
        value: offer.contact,
        inline: true,
      });
    }

    const streetPart =
      offer.street !== null && offer.street !== "" ? offer.street : "";
    const streetNumberPart =
      offer.streetNumber !== null && offer.streetNumber !== ""
        ? ` ${offer.streetNumber}`
        : "";
    const cityPart = offer.city === "" ? "" : `, ${offer.city}`;
    const addressText = `${streetPart}${streetNumberPart}${cityPart}`;
    const mapsUrl = this.generateGoogleMapsUrl(
      offer.latitude,
      offer.longitude,
      addressText,
    );

    let description = "";

    if (offer.summary !== null && offer.summary !== "") {
      description += `\n\n**Opis:** ${offer.summary}`;
    }
    if (
      offer.media !== undefined &&
      offer.media !== null &&
      offer.media !== ""
    ) {
      description += `\n\n**Media:** ${offer.media}`;
    }
    if (
      offer.furnishing !== undefined &&
      offer.furnishing !== null &&
      offer.furnishing !== ""
    ) {
      description += `\n\n**Wyposażenie:** ${offer.furnishing}`;
    }
    if (
      offer.infoAdditional !== undefined &&
      offer.infoAdditional !== null &&
      offer.infoAdditional !== ""
    ) {
      description += `\n\n**Informacje dodatkowe:** ${offer.infoAdditional}`;
    }

    const embeds: {
      title: string;
      description: string;
      color: number;
      url?: string;
      fields: {
        name: string;
        value: string;
        inline: boolean;
      }[];
      image?: {
        url: string;
      };
    }[] = [];

    if (offer.images.length > 0) {
      const imagesToShow = offer.images.slice(0, 8);

      this.logger.debug(
        `Processing ${String(imagesToShow.length)} images for Discord embeds`,
      );

      embeds.push({
        title: `${offer.title.trim() === "" ? "Nowe mieszkanie" : offer.title}${offer.isNew ? "[NOWA]" : ""}`,
        description,
        color: offer.isNew ? 0xea_b3_08 : 0x3b_82_f6,
        url: offer.link,
        fields,
        image: {
          url: imagesToShow[0],
        },
      });

      for (let index = 1; index < imagesToShow.length; index++) {
        this.logger.debug(
          `Processing image ${String(index + 1)}: ${imagesToShow[index]}`,
        );

        embeds.push({
          title: "",
          description: "",
          color: offer.isNew ? 0xea_b3_08 : 0x3b_82_f6,
          url: offer.link,
          fields: [],
          image: {
            url: imagesToShow[index],
          },
        });
      }

      this.logger.debug(`Created ${String(embeds.length)} embeds total`);
    } else {
      embeds.push({
        title: `${offer.title.trim() === "" ? "Nowe mieszkanie" : offer.title}${offer.isNew ? " [NOWA]" : ""}`,
        description,
        color: offer.isNew ? 0xea_b3_08 : 0x3b_82_f6,
        url: offer.link,
        fields,
      });
    }

    let addressValue = "";
    if (offer.street !== null && offer.street !== "") {
      addressValue += offer.street;
    }
    if (offer.streetNumber !== null && offer.streetNumber !== "") {
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
        .join(", ");

      embeds.push({
        title: fullAddress || addressValue.trim(),
        description: ``,
        color: offer.isNew ? 0xea_b3_08 : 0x3b_82_f6,
        url: mapsUrl,
        fields: [],
        image: {
          url: staticMapUrl,
        },
      });
    } else if (mapsUrl) {
      this.logger.debug(
        "Static map not available, Google Maps API key missing",
      );
      embeds.push({
        title: "Lokalizacja",
        description: mapsUrl,
        color: offer.isNew ? 0xea_b3_08 : 0x3b_82_f6,
        url: mapsUrl,
        fields: [],
      });
    }

    return { content, embeds };
  }

  testConnection(): boolean {
    try {
      if (this.client === null) {
        return false;
      }

      return this.client.isReady();
    } catch (error) {
      this.logger.error("Discord connection test failed:", error);
      return false;
    }
  }

  async validateWebhook(webhookUrl: string): Promise<boolean> {
    try {
      const webhook = new WebhookClient({ url: webhookUrl });
      await webhook.fetchMessage("@original");
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
    if (
      latitude !== undefined &&
      latitude !== null &&
      latitude !== 0 &&
      longitude !== undefined &&
      longitude !== null &&
      longitude !== 0
    ) {
      return `https://www.google.com/maps/search/?api=1&query=${String(latitude)},${String(longitude)}`;
    } else if (address !== undefined && address !== "") {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    }
    return "";
  }

  private generateStaticMapUrl(
    latitude?: number | null,
    longitude?: number | null,
    address?: string,
  ): string {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (apiKey === undefined || apiKey === "") {
      this.logger.debug("Google Maps API key not set - static maps disabled.");
      return "";
    }

    const size = "600x400";
    const zoom = "14";
    const maptype = "roadmap";

    if (
      latitude !== undefined &&
      latitude !== null &&
      latitude !== 0 &&
      longitude !== undefined &&
      longitude !== null &&
      longitude !== 0
    ) {
      const marker = `markers=color:red%7Clabel:M%7C${String(latitude)},${String(longitude)}`;
      return `https://maps.googleapis.com/maps/api/staticmap?center=${String(latitude)},${String(longitude)}&zoom=${zoom}&size=${size}&maptype=${maptype}&${marker}&key=${apiKey}`;
    } else if (address !== undefined && address !== "") {
      const encodedAddress = encodeURIComponent(address);
      const marker = `markers=color:red%7Clabel:M%7C${encodedAddress}`;
      return `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=${zoom}&size=${size}&maptype=${maptype}&${marker}&key=${apiKey}`;
    }
    return "";
  }
}
