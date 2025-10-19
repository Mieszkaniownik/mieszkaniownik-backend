import * as nodemailer from "nodemailer";
import type { SentMessageInfo } from "nodemailer";

import { Injectable, Logger } from "@nestjs/common";

import { generateMatchNotificationTemplate } from "../dto/match-notification.template";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    void this.initializeTransporter();
  }

  private async initializeTransporter(): Promise<void> {
    try {
      let emailConfig: Record<string, unknown>;

      if (
        process.env.EMAIL_OAUTH_CLIENT_ID !== undefined &&
        process.env.EMAIL_OAUTH_CLIENT_ID !== "" &&
        process.env.EMAIL_OAUTH_CLIENT_SECRET !== undefined &&
        process.env.EMAIL_OAUTH_CLIENT_SECRET !== "" &&
        process.env.EMAIL_OAUTH_REFRESH_TOKEN !== undefined &&
        process.env.EMAIL_OAUTH_REFRESH_TOKEN !== "" &&
        process.env.EMAIL_OAUTH_USER !== undefined &&
        process.env.EMAIL_OAUTH_USER !== ""
      ) {
        emailConfig = {
          service: "gmail",
          auth: {
            type: "OAuth2",
            user: process.env.EMAIL_OAUTH_USER,
            clientId: process.env.EMAIL_OAUTH_CLIENT_ID,
            clientSecret: process.env.EMAIL_OAUTH_CLIENT_SECRET,
            refreshToken: process.env.EMAIL_OAUTH_REFRESH_TOKEN,
            accessToken: process.env.EMAIL_OAUTH_ACCESS_TOKEN,
          },
        };
        this.logger.log(
          `Using Gmail OAuth2 authentication for ${process.env.EMAIL_OAUTH_USER}`,
        );
      } else if (
        process.env.OUTLOOK_CLIENT_ID !== undefined &&
        process.env.OUTLOOK_CLIENT_ID !== "" &&
        process.env.OUTLOOK_CLIENT_SECRET !== undefined &&
        process.env.OUTLOOK_CLIENT_SECRET !== "" &&
        process.env.OUTLOOK_REFRESH_TOKEN !== undefined &&
        process.env.OUTLOOK_REFRESH_TOKEN !== "" &&
        process.env.OUTLOOK_USER !== undefined &&
        process.env.OUTLOOK_USER !== ""
      ) {
        const outlookHost =
          process.env.OUTLOOK_USER.includes("@outlook.com") ||
          process.env.OUTLOOK_USER.includes("@hotmail.com")
            ? "smtp-mail.outlook.com"
            : "smtp.office365.com";

        emailConfig = {
          host: outlookHost,
          port: 587,
          secure: false,
          auth: {
            type: "OAuth2",
            user: process.env.OUTLOOK_USER,
            clientId: process.env.OUTLOOK_CLIENT_ID,
            clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
            refreshToken: process.env.OUTLOOK_REFRESH_TOKEN,
            accessToken: process.env.OUTLOOK_ACCESS_TOKEN,
          },
        };
        this.logger.log(
          `Using Outlook OAuth2 authentication for ${process.env.OUTLOOK_USER}`,
        );
      } else if (
        (process.env.EMAIL_HOST !== undefined &&
          process.env.EMAIL_HOST !== "") ||
        (process.env.SMTP_HOST !== undefined && process.env.SMTP_HOST !== "")
      ) {
        const host = process.env.EMAIL_HOST ?? process.env.SMTP_HOST;
        const port = Number.parseInt(
          process.env.EMAIL_PORT ?? process.env.SMTP_PORT ?? "587",
          10,
        );
        const user = process.env.EMAIL_USER ?? process.env.SMTP_USER;
        const pass = process.env.EMAIL_PASS ?? process.env.SMTP_PASS;

        emailConfig = {
          host,
          port,
          secure:
            port === 465 ||
            process.env.EMAIL_SECURE === "true" ||
            process.env.SMTP_SECURE === "true",
          auth: {
            user,
            pass,
          },
        };
        this.logger.log(
          `Using SMTP authentication with ${host ?? "unknown"}:${String(port)}`,
        );
      } else {
        this.logger.warn("Using Ethereal Email for development");
        const testAccount = await nodemailer.createTestAccount();
        emailConfig = {
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        };
      }

      this.transporter = nodemailer.createTransport(emailConfig);

      await this.transporter.verify();
      this.logger.log(
        "Email transporter initialized and verified successfully",
      );
    } catch (error) {
      this.logger.error("Failed to initialize email transporter:", error);

      if (
        process.env.EMAIL_OAUTH_CLIENT_ID !== undefined &&
        process.env.EMAIL_OAUTH_CLIENT_ID !== ""
      ) {
        this.logger.error("OAuth2 Configuration Debug:", {
          hasClientId: Boolean(process.env.EMAIL_OAUTH_CLIENT_ID),
          hasClientSecret: Boolean(process.env.EMAIL_OAUTH_CLIENT_SECRET),
          hasRefreshToken: Boolean(process.env.EMAIL_OAUTH_REFRESH_TOKEN),
          hasUser: Boolean(process.env.EMAIL_OAUTH_USER),
          user: process.env.EMAIL_OAUTH_USER ?? "NOT_SET",
          clientIdLength: process.env.EMAIL_OAUTH_CLIENT_ID.length,
          refreshTokenLength:
            process.env.EMAIL_OAUTH_REFRESH_TOKEN?.length ?? 0,
        });
      }

      this.logger.warn(
        "Email service failed to initialize. Application will continue without email functionality.",
      );
      this.transporter = null;
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    retries = 3,
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (this.transporter === null) {
          this.logger.error("Email transporter not initialized.");
          return false;
        }

        const from =
          process.env.EMAIL_FROM ??
          process.env.SMTP_FROM ??
          process.env.EMAIL_OAUTH_USER ??
          process.env.OUTLOOK_USER ??
          '"Mieszkaniownik Property Alerts" <noreply@mieszkaniownik.pl>';

        const mailOptions = {
          from,
          to,
          subject,
          html,
          headers: {
            "X-Mailer": "Mieszkaniownik Property Alert System",
            "X-Priority": "3",
          },
        };

        this.logger.debug(
          `Attempting to send email to ${to} (attempt ${String(attempt)}/${String(retries)})`,
        );

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const info: SentMessageInfo =
          await this.transporter.sendMail(mailOptions);

        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          const previewUrl = nodemailer.getTestMessageUrl(info);
          if (previewUrl !== false) {
            this.logger.log(`Preview URL: ${previewUrl}`);
          }
        }

        this.logger.log(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Email sent successfully to ${to}: ${String(info.messageId)}`,
        );
        return true;
      } catch (error) {
        const isLastAttempt = attempt === retries;
        this.logger.error(
          `Failed to send email to ${to} (attempt ${String(attempt)}/${String(retries)}):`,
          error,
        );

        if (isLastAttempt) {
          this.logger.error("Email sending failed after all retries", {
            to,
            subject,
            attempt,
            error: error instanceof Error ? error.message : String(error),
          });
          return false;
        }

        const delay = 2 ** (attempt - 1) * 1000;
        this.logger.warn(`Retrying email send in ${String(delay)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return false;
  }

  async isTransporterReady(): Promise<boolean> {
    try {
      if (this.transporter === null) {
        return false;
      }
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.error("Transporter verification failed:", error);
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
      this.logger.warn(
        "Google Maps API key not provided, static maps disabled",
      );
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

  generateMatchNotificationEmail(
    userName: string,
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
  ): { subject: string; html: string } {
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
    const staticMapUrl = this.generateStaticMapUrl(
      offer.latitude,
      offer.longitude,
      addressText,
    );

    return generateMatchNotificationTemplate({
      userName,
      alertName,
      offer,
      mapsUrl,
      staticMapUrl,
    });
  }
}
