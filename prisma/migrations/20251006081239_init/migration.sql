-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'USER', 'GUEST');

-- CreateEnum
CREATE TYPE "public"."AlertStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."NotificationMethod" AS ENUM ('EMAIL', 'DISCORD', 'BOTH');

-- CreateEnum
CREATE TYPE "public"."OwnerType" AS ENUM ('PRIVATE', 'COMPANY', 'ALL');

-- CreateEnum
CREATE TYPE "public"."BuildingType" AS ENUM ('BLOCK_OF_FLATS', 'TENEMENT', 'DETACHED', 'TERRACED', 'APARTMENT', 'LOFT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."Floors" AS ENUM ('BASEMENT', 'GROUND', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'TEN_AND_MORE', 'LOFT');

-- CreateEnum
CREATE TYPE "public"."Rooms" AS ENUM ('STUDIO', 'ONE_ROOM', 'TWO_ROOMS', 'THREE_ROOMS', 'FOUR_AND_MORE');

-- CreateEnum
CREATE TYPE "public"."ParkingType" AS ENUM ('NONE', 'STREET', 'SECURED', 'GARAGE', 'IDENTIFICATOR_FOR_PAID_PARKING');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255),
    "role" "public"."Role" NOT NULL DEFAULT 'USER',
    "username" VARCHAR(255),
    "name" VARCHAR(100),
    "surname" VARCHAR(100),
    "phone" VARCHAR(25),
    "city" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lastLogin" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "googleId" VARCHAR(255),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."offers" (
    "id" SERIAL NOT NULL,
    "link" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "district" VARCHAR(100),
    "footage" DECIMAL(10,2),
    "description" TEXT,
    "ownerType" "public"."OwnerType",
    "buildingType" "public"."BuildingType",
    "parkingType" "public"."ParkingType",
    "rooms" INTEGER,
    "floor" INTEGER,
    "elevator" BOOLEAN,
    "furniture" BOOLEAN,
    "pets" BOOLEAN,
    "rentAdditional" DECIMAL(10,2),
    "negotiable" BOOLEAN,
    "contact" VARCHAR(300),
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "source" VARCHAR(100) NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "summary" VARCHAR(500),
    "street" VARCHAR(200),
    "streetNumber" VARCHAR(20),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(11,7),
    "infoAdditional" TEXT,
    "media" TEXT,
    "furnishing" TEXT,
    "images" TEXT[],

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."alerts" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "district" VARCHAR(100),
    "maxPrice" DECIMAL(10,2),
    "minPrice" DECIMAL(10,2),
    "maxFootage" DECIMAL(10,2),
    "minFootage" DECIMAL(10,2),
    "maxRooms" INTEGER,
    "minRooms" INTEGER,
    "maxFloor" INTEGER,
    "minFloor" INTEGER,
    "ownerType" "public"."OwnerType",
    "buildingType" "public"."BuildingType",
    "parkingType" "public"."ParkingType",
    "elevator" BOOLEAN,
    "furniture" BOOLEAN,
    "pets" BOOLEAN,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "discordWebhook" TEXT,
    "notificationMethod" "public"."NotificationMethod" NOT NULL DEFAULT 'EMAIL',
    "status" "public"."AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "matchesCount" INTEGER NOT NULL DEFAULT 0,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."matches" (
    "id" SERIAL NOT NULL,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alertId" INTEGER NOT NULL,
    "offerId" INTEGER NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "method" "public"."NotificationMethod" NOT NULL DEFAULT 'EMAIL',
    "message" TEXT NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "error" TEXT,
    "userId" INTEGER NOT NULL,
    "alertId" INTEGER,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "public"."users"("googleId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_active_role_idx" ON "public"."users"("active", "role");

-- CreateIndex
CREATE UNIQUE INDEX "offers_link_key" ON "public"."offers"("link");

-- CreateIndex
CREATE INDEX "offers_city_district_idx" ON "public"."offers"("city", "district");

-- CreateIndex
CREATE INDEX "offers_price_footage_idx" ON "public"."offers"("price", "footage");

-- CreateIndex
CREATE INDEX "offers_buildingType_city_idx" ON "public"."offers"("buildingType", "city");

-- CreateIndex
CREATE INDEX "offers_available_isNew_idx" ON "public"."offers"("available", "isNew");

-- CreateIndex
CREATE INDEX "offers_source_createdAt_idx" ON "public"."offers"("source", "createdAt");

-- CreateIndex
CREATE INDEX "offers_latitude_longitude_idx" ON "public"."offers"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "offers_rooms_floor_idx" ON "public"."offers"("rooms", "floor");

-- CreateIndex
CREATE INDEX "alerts_userId_status_idx" ON "public"."alerts"("userId", "status");

-- CreateIndex
CREATE INDEX "alerts_status_createdAt_idx" ON "public"."alerts"("status", "createdAt");

-- CreateIndex
CREATE INDEX "alerts_city_district_idx" ON "public"."alerts"("city", "district");

-- CreateIndex
CREATE INDEX "matches_alertId_matchedAt_idx" ON "public"."matches"("alertId", "matchedAt");

-- CreateIndex
CREATE INDEX "matches_notificationSent_idx" ON "public"."matches"("notificationSent");

-- CreateIndex
CREATE INDEX "matches_offerId_idx" ON "public"."matches"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "matches_alertId_offerId_key" ON "public"."matches"("alertId", "offerId");

-- CreateIndex
CREATE INDEX "notifications_userId_sent_idx" ON "public"."notifications"("userId", "sent");

-- CreateIndex
CREATE INDEX "notifications_sent_createdAt_idx" ON "public"."notifications"("sent", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_alertId_idx" ON "public"."notifications"("alertId");

-- AddForeignKey
ALTER TABLE "public"."alerts" ADD CONSTRAINT "alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."matches" ADD CONSTRAINT "matches_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "public"."alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."matches" ADD CONSTRAINT "matches_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "public"."offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "public"."alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
