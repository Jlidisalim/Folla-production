-- CreateTable
CREATE TABLE "Cart" (
    "id" SERIAL NOT NULL,
    "clerkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" SERIAL NOT NULL,
    "cartId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "combinationId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitType" TEXT NOT NULL,
    "priceAtAdd" DOUBLE PRECISION NOT NULL,
    "titleAtAdd" TEXT NOT NULL,
    "imageAtAdd" TEXT,
    "optionsAtAdd" JSONB,
    "minQty" INTEGER,
    "maxQty" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cart_clerkId_key" ON "Cart"("clerkId");

-- CreateIndex
CREATE INDEX "Cart_clerkId_idx" ON "Cart"("clerkId");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
