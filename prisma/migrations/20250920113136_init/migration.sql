-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "public"."Listing_type" AS ENUM ('APARTMENT', 'ROOM', 'HOUSE');

-- CreateTable
CREATE TABLE "public"."user" (
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'USER',
    "name" TEXT,
    "surname" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "public"."offer" (
    "id" INTEGER NOT NULL,
    "link" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "footage" INTEGER,
    "rooms" INTEGER,
    "added_at" TIMESTAMP(3) NOT NULL,
    "udpated_at" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3),
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "type" "public"."Listing_type",
    "furniture" BOOLEAN,
    "negotiable" BOOLEAN,
    "pets_allowed" BOOLEAN,
    "floor" INTEGER,
    "elevator" BOOLEAN,

    CONSTRAINT "offer_pkey" PRIMARY KEY ("id")
);
