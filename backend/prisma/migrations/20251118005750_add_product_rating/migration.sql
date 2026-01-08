-- CreateTable
CREATE TABLE "ProductRating" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "authorName" TEXT,
    "authorEmail" TEXT,
    "clerkUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductRating_productId_idx" ON "ProductRating"("productId");

-- CreateIndex
CREATE INDEX "ProductRating_clerkUserId_idx" ON "ProductRating"("clerkUserId");

-- AddForeignKey
ALTER TABLE "ProductRating" ADD CONSTRAINT "ProductRating_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
