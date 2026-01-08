-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "size" TEXT,
ADD COLUMN     "variant" TEXT;
