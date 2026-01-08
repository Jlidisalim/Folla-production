import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedProduct = {
  title: string;
  slug: string;
  description: string;
  pricePiece: number | null;
  priceQuantity: number | null;
  saleType: "piece" | "quantity" | "both";
  images: string[];
  category: string;
  subCategory: string;
  inStock: boolean;
  venteFlash?: {
    active: boolean;
    percentage: number;
  };
};

function resolveBasePrice(product: SeedProduct) {
  if (product.saleType === "quantity") {
    return product.priceQuantity ?? product.pricePiece ?? null;
  }
  if (product.saleType === "piece") {
    return product.pricePiece ?? product.priceQuantity ?? null;
  }
  return product.pricePiece ?? product.priceQuantity ?? null;
}

function computeFlashPrice(product: SeedProduct) {
  if (!product.venteFlash?.active) {
    return { active: false, percentage: null, price: null };
  }
  const pct = product.venteFlash.percentage;
  const base = resolveBasePrice(product);
  if (base == null || !Number.isFinite(pct)) {
    return { active: false, percentage: null, price: null };
  }
  const price = Number((base - (base * pct) / 100).toFixed(2));
  return { active: true, percentage: pct, price };
}

async function main() {
  console.log("🚿 Clearing old data...");
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.client.deleteMany();

  console.log("🧾 Seeding clients...");
  await prisma.client.createMany({
    data: [
      {
        name: "Ali Wholesale",
        email: "ali@wholesale.com",
        phone: "12345678",
        purchaseUnit: "quantity",
        clerkId: "clerk_ali_123",
      },
      {
        name: "Fatma Retail",
        email: "fatma@retail.com",
        phone: "87654321",
        purchaseUnit: "piece",
        clerkId: "clerk_fatma_456",
      },
    ],
  });

  console.log("🧾 Seeding products...");
  const baseProducts: SeedProduct[] = [
    {
      title: "Tapis berbère traditionnel",
      slug: "tapis-berbere-traditionnel",
      description:
        "Un tapis artisanal aux motifs authentiques, parfait pour le salon.",
      pricePiece: 250,
      priceQuantity: 220,
      saleType: "both",
      images: [
        "https://images.unsplash.com/photo-1582582422807-05f68c6d0f1f",
        "https://images.unsplash.com/photo-1621605815977-4fdddb8b27c0",
      ],
      category: "Decoration",
      subCategory: "Tapis",
      inStock: true,
      venteFlash: { active: true, percentage: 15 },
    },
    {
      title: "Plateau en bois sculpté",
      slug: "plateau-bois-sculpte",
      description:
        "Un plateau artisanal en bois pour décorer votre table avec élégance.",
      pricePiece: 90,
      priceQuantity: 75,
      saleType: "both",
      images: [
        "https://images.unsplash.com/photo-1600185365483-26d7f9a32a1b",
        "https://images.unsplash.com/photo-1578926287820-59f8c4e7c84a",
      ],
      category: "Decoration",
      subCategory: "Plateau",
      inStock: true,
    },
    {
      title: "Sac en osier tressé",
      slug: "sac-osier-tresse",
      description: "Un sac chic et naturel, idéal pour la plage ou les courses.",
      pricePiece: 70,
      priceQuantity: 60,
      saleType: "piece",
      images: [
        "https://images.unsplash.com/photo-1594633312681-4f67c1e5f83f",
        "https://images.unsplash.com/photo-1621605816137-879f5f4a0b74",
      ],
      category: "Sacs",
      subCategory: "Sac de plage",
      inStock: true,
      venteFlash: { active: true, percentage: 20 },
    },
    {
      title: "Corbeille artisanale colorée",
      slug: "corbeille-artisanale-coloree",
      description:
        "Une corbeille décorative parfaite pour le rangement ou la déco.",
      pricePiece: 55,
      priceQuantity: 48,
      saleType: "both",
      images: [
        "https://images.unsplash.com/photo-1582582422868-8761dfaf889b",
        "https://images.unsplash.com/photo-1621605815977-4fdddb8b27c0",
      ],
      category: "Decoration",
      subCategory: "Corbeille",
      inStock: true,
    },
    {
      title: "Chaussures en cuir homme",
      slug: "chaussures-cuir-homme",
      description: "Chaussures de ville élégantes, en cuir véritable.",
      pricePiece: 320,
      priceQuantity: 290,
      saleType: "both",
      images: [
        "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a",
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff",
      ],
      category: "Chaussures",
      subCategory: "Ville",
      inStock: true,
      venteFlash: { active: true, percentage: 10 },
    },
    {
      title: "Sandales en cuir femme",
      slug: "sandales-cuir-femme",
      description: "Des sandales confortables et chics pour l'été.",
      pricePiece: 150,
      priceQuantity: 130,
      saleType: "both",
      images: [
        "https://images.unsplash.com/photo-1595950653129-0f6c2f879ef4",
        "https://images.unsplash.com/photo-1519741497674-611481863552",
      ],
      category: "Chaussures",
      subCategory: "Sandales",
      inStock: true,
    },
    {
      title: "Miroir mural design",
      slug: "miroir-mural-design",
      description: "Un miroir décoratif au cadre doré moderne.",
      pricePiece: 180,
      priceQuantity: 160,
      saleType: "both",
      images: [
        "https://images.unsplash.com/photo-1621605816105-5b32eb4f3f87",
        "https://images.unsplash.com/photo-1567016432779-094069958e8b",
      ],
      category: "Decoration",
      subCategory: "Miroirs",
      inStock: true,
      venteFlash: { active: true, percentage: 12 },
    },
    {
      title: "Coussin artisanal brodé",
      slug: "coussin-artisanal-brode",
      description: "Un coussin confortable avec broderie traditionnelle.",
      pricePiece: 65,
      priceQuantity: 55,
      saleType: "both",
      images: [
        "https://images.unsplash.com/photo-1616628182501-4ba8c271d88e",
        "https://images.unsplash.com/photo-1616628182295-06f57c7f9b91",
      ],
      category: "Decoration",
      subCategory: "Coussins",
      inStock: true,
    },
    {
      title: "Boite de rangement artisanale",
      slug: "boite-rangement-artisanale",
      description:
        "Boîte décorative idéale pour ranger bijoux ou accessoires.",
      pricePiece: 75,
      priceQuantity: 65,
      saleType: "piece",
      images: [
        "https://images.unsplash.com/photo-1582582422807-05f68c6d0f1f",
        "https://images.unsplash.com/photo-1578926287820-59f8c4e7c84a",
      ],
      category: "Decoration",
      subCategory: "Boite rangement",
      inStock: true,
      venteFlash: { active: false, percentage: 0 },
    },
  ];

  const formattedProducts = baseProducts.map((product) => {
    const { venteFlash, ...rest } = product;
    const flash = computeFlashPrice(product);
    return {
      ...rest,
      venteFlashActive: flash.active,
      venteFlashPercentage: flash.percentage,
      venteFlashPrice: flash.price,
    };
  });

  await prisma.product.createMany({ data: formattedProducts });

  console.log("✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("⚠️ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
