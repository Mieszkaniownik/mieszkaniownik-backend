import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.enableCors({
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cache-Control',
      'Accept',
      'Accept-Encoding',
      'Accept-Language',
      'Connection',
    ],
    exposedHeaders: ['Cache-Control', 'Connection', 'Content-Type'],
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
        'http://mieszkaniownik-dev.local',
        'http://mieszkaniownik-prod.local',
      ];

      if (
        localhostPattern.test(origin) ||
        ipPattern.test(origin) ||
        allowedDomains.includes(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'), false);
    },
    preflightContinue: false,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('API Mieszkaniownik')
    .setDescription(
      `Mieszkaniownik to rozwiązanie skierowane dla studentów poszukujących mieszkania lub pokoju na wynajem. 
      Przy obecnej rotacji ofert wynajmu np. na OLX każda sekunda jest na wagę złota. 
      Po co przepatrywać godzinami odświeżając stronę internetową jeśli możemy po prostu utworzyć alert, 
      wpisać jakie mieszkanie nas interesuje i jaki mamy budżet. 
      Następnie od razu po pokazaniu się oferty dostajesz powiadomienie na maila lub discorda ze wszystkimi najważniejszymi informacjami.`,
    )
    .setVersion('1.0')
    .addTag('api')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 5001);
}
void bootstrap();
