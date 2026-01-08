-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "purchaseUnit" TEXT DEFAULT 'piece';

-- CreateTable
CREATE TABLE "ClientDeal" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "customPrice" DOUBLE PRECISION,
    "unit" TEXT DEFAULT 'piece',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientDeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientDeal_clientId_productId_key" ON "ClientDeal"("clientId", "productId");

-- AddForeignKey
ALTER TABLE "ClientDeal" ADD CONSTRAINT "ClientDeal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDeal" ADD CONSTRAINT "ClientDeal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
