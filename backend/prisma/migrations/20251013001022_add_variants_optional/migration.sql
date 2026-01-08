-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "availableFromDate" TIMESTAMP(3),
ADD COLUMN     "availableQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dimensions" TEXT,
ADD COLUMN     "minStockAlert" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "publishProduct" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shippingWeight" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Active',
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "variants" JSONB,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'Public';
