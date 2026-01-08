-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "flashApplyAllCombinations" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "flashApplyTarget" TEXT NOT NULL DEFAULT 'product',
ADD COLUMN     "flashCombinationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "flashDiscountType" TEXT DEFAULT 'percent',
ADD COLUMN     "flashDiscountValue" DOUBLE PRECISION,
ADD COLUMN     "flashEndAt" TIMESTAMP(3),
ADD COLUMN     "flashStartAt" TIMESTAMP(3);
