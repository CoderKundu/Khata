-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PAID', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "EntryType" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "note" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "razorpayLinkId" TEXT,
    "razorpayLinkUrl" TEXT,
    "paymentStatus" "PaymentStatus",

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_archived_name_idx" ON "Customer"("archived", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_razorpayLinkId_key" ON "Entry"("razorpayLinkId");

-- CreateIndex
CREATE INDEX "Entry_customerId_entryDate_idx" ON "Entry"("customerId", "entryDate");

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
