import {
  PrismaClient,
  Role,
  NotificationMethod,
  OwnerType,
} from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.match.deleteMany();
  await prisma.notification.deleteMany();

  const password = await hash('haslo', 10);

  const adminUser = await prisma.user.create({
    data: {
      email: 'crimsonglorye31@nivalust.com',
      username: 'admin',
      name: 'Admin',
      surname: 'User',
      password: password,
      role: Role.ADMIN,
      active: true,
      city: 'Wrocław',
    },
  });

  const regularUser1 = await prisma.user.create({
    data: {
      email: 'yosiah.amorie@dunefee.com',
      username: 'jan_kowalski',
      name: 'Jan',
      surname: 'Kowalski',
      password: password,
      role: Role.USER,
      active: true,
      city: 'Toruń',
    },
  });

  const regularUser2 = await prisma.user.create({
    data: {
      email: 'fegofe8982@inilas.com',
      username: 'anna_nowak',
      name: 'Anna',
      surname: 'Nowak',
      password: password,
      role: Role.USER,
      active: true,
      city: 'Kraków',
    },
  });

  await prisma.alert.create({
    data: {
      userId: regularUser1.id,
      name: 'Kawalerka w Toruniu',
      city: 'Toruń',
      minPrice: 1000,
      maxPrice: 5000,
      minFootage: 10,
      maxFootage: 50,
      notificationMethod: NotificationMethod.BOTH,
      matchesCount: 0,
      discordWebhook: `https://discord.com/api/webhooks/1422932529056579585/qLf_FZTtIito3YX13fc1jSuq825fBJ0GNG0luezh7H3YXZ1uJv6EmzV0LalYkq9kKriS`,
    },
  });

  await prisma.alert.create({
    data: {
      userId: regularUser2.id,
      name: 'Mieszkanie w Krakowie',
      city: 'Kraków',
      minPrice: 2000,
      maxPrice: 10000,
      minRooms: 2,
      maxRooms: 10,
      notificationMethod: NotificationMethod.BOTH,
      matchesCount: 0,
      discordWebhook:
        'https://discord.com/api/webhooks/1422933162409070706/-JYNyt71tOioHgq73Bh3ia8Fcdr5jpxfNaxYou-yQlfwUtrZf1htM6Nre9rAeBejmBDD', // Replace with real webhook
    },
  });

  await prisma.alert.create({
    data: {
      userId: adminUser.id,
      name: 'Kawalerka do 3000 zł we Wrocławiu',
      city: 'Wrocław',
      maxPrice: 3000,
      notificationMethod: NotificationMethod.BOTH,
      matchesCount: 0,
      discordWebhook: `https://discord.com/api/webhooks/1422933564223262792/MwCSLG3yj7kJqfgd1rqpUIAk5CuzmyHT6lNWIJaKKgvgMAn9csN8xfdBJlPEKJaODhbU`,
    },
  });

  await prisma.alert.create({
    data: {
      userId: regularUser1.id,
      name: 'Apartament ponad 50 m2 w Gdańsku',
      city: 'Gdańsk',
      minFootage: 50,
      elevator: true,
      notificationMethod: NotificationMethod.BOTH,
      matchesCount: 0,
      discordWebhook: `https://discord.com/api/webhooks/1422933906403102862/RQNl7H11lXpQzeAPEzVsoJ6STb2c_OxQdKlXpqgj08uWxkDNRp8MqlpM0UQFyHx6Ruku`,
    },
  });

  await prisma.alert.create({
    data: {
      userId: regularUser2.id,
      name: 'Budynek w centrum Warszawy',
      city: 'Warszawa',
      keywords: ['w centrum'],
      notificationMethod: NotificationMethod.BOTH,
      matchesCount: 0,
      discordWebhook: `https://discord.com/api/webhooks/1422934661436538984/qME5ohpKkDzvxIfBiEWx7G7Jh5CdXmzHfLUeeGl5kwVof82wKX8fhzHSmiNihPC4XJKa`,
    },
  });

  await prisma.alert.create({
    data: {
      userId: regularUser1.id,
      name: 'Mieszkanie z balkonem lub tarasem',
      city: 'Poznań',
      keywords: ['balkon', 'taras'],
      notificationMethod: NotificationMethod.BOTH,
      matchesCount: 0,
      discordWebhook: `https://discord.com/api/webhooks/1422938037284896800/LLHZ_kUP_9RaJpL37dKmUy_UtwRREnr1V1cSNju6j2hvKcdMTlVfENRo5aramCfeDjEV`,
    },
  });

  await prisma.alert.create({
    data: {
      userId: adminUser.id,
      name: 'Mieszkanie dla studenta',
      city: 'Łódź',
      keywords: ['dla studenta', 'do uczelni', 'w kampusie'],
      notificationMethod: NotificationMethod.BOTH,
      matchesCount: 0,
      discordWebhook: `https://discord.com/api/webhooks/1422938167106867322/9wnnHt7TNMx7Scvc0LBAtfuV48zuceIBKaJp68Ww9cQdvCaF75xsHJ4dwJzErsCyZKpe`, // Replace with real webhook
    },
  });

  console.log('Creating test offers...');
  const timestamp = Date.now();

  await prisma.offer.create({
    data: {
      link: `https://www.olx.pl/d/oferta/test-mieszkanie-krakow-1-${timestamp}`,
      title: 'Mieszkanie 2-pokojowe w centrum Krakowa',
      buildingType: 'APARTMENT',
      price: 2500,
      footage: 45,
      city: 'Kraków',
      district: 'Stare Miasto',
      street: 'Rynek Główny',
      streetNumber: '12',
      description: 'Mieszkanie w centrum miasta, blisko głównych atrakcji.',
      rooms: 2,
      floor: 3,
      furniture: true,
      elevator: true,
      pets: true,
      negotiable: false,
      contact: 'Jan Kowalski - 123456789',
      source: 'olx',
      createdAt: new Date(),
      views: 245,
      ownerType: OwnerType.PRIVATE,
      available: true,
      isNew: true,
      images: [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
      ],
    },
  });

  await prisma.offer.create({
    data: {
      link: `https://www.olx.pl/d/oferta/test-mieszkanie-warszawa-1-${timestamp + 1}`,
      title: 'Kawalerka na Mokotowie',
      buildingType: 'APARTMENT',
      price: 1500,
      footage: 25,
      city: 'Warszawa',
      district: 'Mokotów',
      street: 'Puławska',
      streetNumber: '45',
      description: 'Mała ale przytulna kawalerka, idealna dla studenta.',
      rooms: 1,
      floor: 2,
      furniture: false,
      elevator: false,
      pets: false,
      negotiable: true,
      contact: 'Anna Nowak - 987654321',
      source: 'olx',
      createdAt: new Date(),
      views: 89,
      ownerType: OwnerType.PRIVATE,
      available: true,
      isNew: false,
      images: ['https://example.com/image3.jpg'],
    },
  });

  await prisma.offer.create({
    data: {
      link: `https://www.olx.pl/d/oferta/test-mieszkanie-poznan-1-${timestamp + 2}`,
      title: 'Tanie mieszkanie 3-pokojowe Poznań',
      buildingType: 'APARTMENT',
      price: 2200,
      footage: 60,
      city: 'Poznań',
      district: 'Jeżyce',
      street: 'Kościuszki',
      streetNumber: '78',
      description: 'Przestronne mieszkanie w dobrej cenie, do negocjacji.',
      rooms: 3,
      floor: 1,
      furniture: false,
      elevator: false,
      pets: true,
      negotiable: true,
      contact: 'Piotr Zieliński - 555123456',
      source: 'olx',
      createdAt: new Date(),
      views: 156,
      ownerType: OwnerType.PRIVATE,
      available: true,
      isNew: true,
      images: [],
    },
  });

  await prisma.offer.create({
    data: {
      link: `https://www.olx.pl/d/oferta/test-mieszkanie-gdansk-winda-${timestamp + 3}`,
      title: 'Nowoczesne mieszkanie z windą Gdańsk',
      buildingType: 'APARTMENT',
      price: 3200,
      footage: 55,
      city: 'Gdańsk',
      district: 'Wrzeszcz',
      street: 'Grunwaldzka',
      streetNumber: '200',
      description: 'Mieszkanie w nowym budownictwie, z windą i balkonem.',
      rooms: 2,
      floor: 8,
      furniture: true,
      elevator: true,
      pets: false,
      negotiable: false,
      contact: 'Magdalena Kowal - 777888999',
      source: 'olx',
      createdAt: new Date(),
      views: 312,
      ownerType: OwnerType.PRIVATE,
      available: true,
      isNew: true,
      images: [
        'https://example.com/image4.jpg',
        'https://example.com/image5.jpg',
        'https://example.com/image6.jpg',
      ],
    },
  });

  await prisma.offer.create({
    data: {
      link: `https://www.olx.pl/d/oferta/test-mieszkanie-tychy-umeblowane-${timestamp + 4}`,
      title: 'Umeblowane mieszkanie Tychy',
      buildingType: 'APARTMENT',
      price: 1800,
      footage: 40,
      city: 'Tychy',
      district: 'Centrum',
      street: 'Niepodległości',
      streetNumber: '25',
      description: 'W pełni wyposażone mieszkanie, gotowe do zamieszkania.',
      rooms: 2,
      floor: 4,
      furniture: true,
      elevator: true,
      pets: true,
      negotiable: false,
      contact: 'Tomasz Wiśniewski - 444555666',
      source: 'olx',
      createdAt: new Date(),
      views: 78,
      ownerType: OwnerType.PRIVATE,
      available: true,
      isNew: false,
      images: ['https://example.com/image7.jpg'],
    },
  });

  await prisma.offer.create({
    data: {
      link: `https://www.olx.pl/d/oferta/test-luksusowe-mieszkanie-krakow-${timestamp + 5}`,
      title: 'Luksusowe mieszkanie centrum Kraków',
      buildingType: 'APARTMENT',
      price: 5500,
      footage: 85,
      city: 'Kraków',
      district: 'Kazimierz',
      street: 'Dajwór',
      streetNumber: '15',
      description: 'Ekskluzywne mieszkanie z widokiem na Wisłę.',
      rooms: 3,
      floor: 6,
      furniture: true,
      elevator: true,
      pets: false,
      negotiable: true,
      contact: 'Luksus Nieruchomości - 111222333',
      source: 'olx',
      createdAt: new Date(),
      views: 456,
      ownerType: OwnerType.COMPANY,
      available: true,
      isNew: true,
      images: [
        'https://example.com/image8.jpg',
        'https://example.com/image9.jpg',
        'https://example.com/image10.jpg',
        'https://example.com/image11.jpg',
      ],
    },
  });

  await prisma.offer.create({
    data: {
      link: `https://www.olx.pl/d/oferta/test-tanie-mieszkanie-lodz-${timestamp + 6}`,
      title: 'Bardzo tanie mieszkanie Łódź',
      buildingType: 'APARTMENT',
      price: 900,
      footage: 30,
      city: 'Łódź',
      district: 'Bałuty',
      street: 'Wojska Polskiego',
      streetNumber: '89',
      description: 'Mieszkanie w dobrej cenie, wymaga remontu.',
      rooms: 1,
      floor: 0,
      furniture: false,
      elevator: false,
      pets: true,
      negotiable: true,
      contact: 'Okazja Mieszkania - 999888777',
      source: 'olx',
      createdAt: new Date(),
      views: 234,
      ownerType: OwnerType.COMPANY,
      available: true,
      isNew: false,
      images: [],
    },
  });

  await prisma.offer.create({
    data: {
      link: `https://www.olx.pl/d/oferta/test-mieszkanie-balkon-warszawa-${timestamp + 7}`,
      title: 'Przestronne mieszkanie z balkonem',
      buildingType: 'APARTMENT',
      price: 2800,
      footage: 55,
      city: 'Warszawa',
      district: 'Śródmieście',
      street: 'Marszałkowska',
      streetNumber: '115',
      description:
        'Piękne mieszkanie z dużym balkonem z widokiem na park. Idealne dla pary.',
      rooms: 2,
      floor: 4,
      furniture: false,
      elevator: true,
      pets: false,
      negotiable: false,
      contact: 'Agencja Premium - 555444333',
      source: 'olx',
      createdAt: new Date(),
      views: 178,
      ownerType: OwnerType.COMPANY,
      available: true,
      isNew: true,
      images: [
        'https://example.com/image12.jpg',
        'https://example.com/image13.jpg',
      ],
    },
  });

  await prisma.offer.create({
    data: {
      link: `https://www.olx.pl/d/oferta/test-mieszkanie-student-krakow-${timestamp + 8}`,
      title: 'Kawalerka blisko uniwersytetu',
      buildingType: 'APARTMENT',
      price: 1600,
      footage: 28,
      city: 'Kraków',
      district: 'Krowodrza',
      street: 'Mickiewicza',
      streetNumber: '30',
      description: 'Małe mieszkanie dla studenta, 10 minut piechotą do AGH.',
      rooms: 1,
      floor: 2,
      furniture: true,
      elevator: false,
      pets: true,
      negotiable: true,
      contact: 'Właściciel prywatny - 666777888',
      source: 'olx',
      createdAt: new Date(),
      views: 145,
      ownerType: OwnerType.PRIVATE,
      available: true,
      isNew: false,
      images: ['https://example.com/image14.jpg'],
    },
  });

  console.log('Test offers created successfully!');
}

main()
  .catch((error: unknown) => {
    console.error('Error seeding database:', error);
    throw error;
  })
  .finally(() => {
    prisma.$disconnect();
  });
