/*
  Warnings:

  - You are about to drop the column `price` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "price",
ADD COLUMN     "pricePiece" DOUBLE PRECISION,
ADD COLUMN     "priceQuantity" DOUBLE PRECISION,
ADD COLUMN     "saleType" TEXT NOT NULL DEFAULT 'piece';
