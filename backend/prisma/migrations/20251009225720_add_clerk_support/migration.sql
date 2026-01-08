/*
  Warnings:

  - You are about to drop the column `address` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `clerkUserId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the `ClientDeal` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[clerkId]` on the table `Client` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Client` table without a default value. This is not possible if the table is not empty.
  - Made the column `purchaseUnit` on table `Client` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."ClientDeal" DROP CONSTRAINT "ClientDeal_clientId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ClientDeal" DROP CONSTRAINT "ClientDeal_productId_fkey";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "clerkId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "purchaseUnit" SET NOT NULL;

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "address",
DROP COLUMN "clerkUserId";

-- DropTable
DROP TABLE "public"."ClientDeal";

-- CreateIndex
CREATE UNIQUE INDEX "Client_clerkId_key" ON "Client"("clerkId");
