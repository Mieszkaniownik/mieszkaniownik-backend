import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      forbidUnknownValues: true,
    }),
  );

  app.enableCors({
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Accept",
      "Accept-Encoding",
      "Accept-Language",
      "Connection",
    ],
    exposedHeaders: ["Cache-Control", "Connection", "Content-Type"],
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (origin == null) {
        callback(null, true);
        return;
      }

      const localhostPattern = /^https?:\/\/localhost:(50\d{2}|5[1-5]\d{2})$/;
      const ipPattern =
        /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:(50\d{2}|5[1-5]\d{2})$/;
      const allowedDomains = [
        "http://mieszkaniownik-dev.local",
        "http://mieszkaniownik-prod.local",
      ];

      if (
        localhostPattern.test(origin) ||
        ipPattern.test(origin) ||
        allowedDomains.includes(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"), false);
    },
    preflightContinue: false,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle("API Mieszkaniownik")
    .setDescription(
      `Mieszkaniownik is a solution designed for students looking for an apartment or room to rent. With the current turnover of rental offers on platforms like OLX, every second counts. Why spend hours refreshing the website when you can simply create an alert, specify what kind of apartment you're interested in and your budget? Then, as soon as an offer appears, you'll receive a notification via email or Discord with all the most important information.`,
    )
    .setVersion("1.0")
    .addTag("api")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      "access-token",
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  await app.listen(process.env.PORT ?? 5001);
}
void bootstrap();
