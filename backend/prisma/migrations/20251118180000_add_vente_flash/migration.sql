-- Drop legacy pricing columns
ALTER TABLE "Product"
  DROP COLUMN "originalPrice",
  DROP COLUMN "salePercentage";

-- Add vente flash fields
ALTER TABLE "Product"
  ADD COLUMN "venteFlashActive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "venteFlashPercentage" INTEGER,
  ADD COLUMN "venteFlashPrice" DOUBLE PRECISION;
