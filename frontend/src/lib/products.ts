// ============================================================================
// PERFORMANCE: Images now referenced via public paths, not bundled in JS
// This removes ~10MB from the JavaScript bundle
// ============================================================================

// Image paths served from public/images/
const product1 = "/images/product-1.jpg";
const product2 = "/images/product-2.jpg";
const product3 = "/images/product-3.jpg";
const product4 = "/images/product-4.jpg";
const product5 = "/images/product-5.jpg";
const product6 = "/images/product-6.jpg";
const product7 = "/images/product-7.jpg";
const product8 = "/images/product-8.jpg";

export interface Product {
  id: string;
  title: string;
  images?: string[];
  image: string;
  currentPrice: string;
  venteFlashActive?: boolean;
  venteFlashPercentage?: string;
  venteFlashPrice?: string;
  category: string;
  subcategory?: string;
  description?: Record<string, string>;
  inStock?: boolean;
}

export const products: Product[] = [
  // Art de la table
  {
    id: "1",
    title: "Présentoir Elva en Bois d'Olivier",
    image: product1,
    images: [product1, product2],
    currentPrice: "119.000 DT",
    venteFlashActive: true,
    venteFlashPercentage: "15",
    venteFlashPrice: "101.150 DT",
    category: "art-de-la-table",
    inStock: true,
  },
  {
    id: "2",
    title: "Set de Table Smar",
    image: product2,
    images: [product2, product3],
    currentPrice: "129.000 DT",
    category: "art-de-la-table",
    inStock: true,
  },
  {
    id: "3",
    title: "Nappe de table ARA",
    image: product3,
    images: [product3, product4],
    currentPrice: "160.000 DT",
    category: "art-de-la-table",
    inStock: true,
  },
  {
    id: "4",
    title: "Pack Lammet Al Aid/لعيد",
    image: product4,
    images: [product4, product1],
    currentPrice: "199.000 DT",
    category: "art-de-la-table",
    inStock: true,
  },

  // Nouveautés
  {
    id: "5",
    title: "Pack Mobilier en Bois Rouge",
    image: product5,
    images: [product5, product6],
    currentPrice: "390.000 DT",
    venteFlashActive: true,
    venteFlashPercentage: "20",
    venteFlashPrice: "312.000 DT",
    category: "nouveautes",
    inStock: true,
  },
  {
    id: "6",
    title: "Présentoir bois d'Olivier OUMA",
    image: product6,
    images: [product6, product7],
    currentPrice: "119.000 DT",
    category: "nouveautes",
    inStock: true,
  },
  {
    id: "7",
    title: "Support Téléphone Bois Écostand",
    image: product7,
    images: [product7, product8],
    currentPrice: "19.900 DT",
    category: "nouveautes",
    inStock: true,
  },
  {
    id: "8",
    title: "Service Café Cuivre Martelé",
    image: product8,
    images: [product8, product1],
    currentPrice: "129.000 DT",
    category: "nouveautes",
    inStock: true,
  },

  // Décoration
  {
    id: "9",
    title: "Vase en Céramique Bleu",
    image: product1,
    images: [product1, product2],
    currentPrice: "59.000 DT",
    category: "decoration",
    inStock: true,
  },
  {
    id: "10",
    title: "Tableau Abstrait Modern",
    image: product2,
    images: [product2, product3],
    currentPrice: "199.000 DT",
    category: "decoration",
    inStock: true,
  },
  {
    id: "11",
    title: "Bougie Parfumée LUX",
    image: product3,
    images: [product3, product4],
    currentPrice: "35.000 DT",
    venteFlashActive: true,
    venteFlashPercentage: "10",
    venteFlashPrice: "31.500 DT",
    category: "decoration",
    inStock: true,
  },
  {
    id: "12",
    title: "Tapis Tissé Main",
    image: product4,
    images: [product4, product5],
    currentPrice: "249.000 DT",
    category: "decoration",
    inStock: true,
  },

  // Cuisine
  {
    id: "13",
    title: "Set Couteaux Chef Pro",
    image: product5,
    images: [product5, product6],
    currentPrice: "189.000 DT",
    category: "cuisine",
    inStock: true,
  },
  {
    id: "14",
    title: "Planche à Découper Bois",
    image: product6,
    images: [product6, product7],
    currentPrice: "49.000 DT",
    category: "cuisine",
    inStock: true,
  },
  {
    id: "15",
    title: "Casserole Antiadhésive",
    image: product7,
    images: [product7, product8],
    currentPrice: "129.000 DT",
    category: "cuisine",
    inStock: true,
  },
  {
    id: "16",
    title: "Moule Silicone Pâtisserie",
    image: product8,
    images: [product8, product1],
    currentPrice: "39.000 DT",
    category: "cuisine",
    inStock: true,
  },

  // Sacs et accessoires
  {
    id: "17",
    title: "Sac à Main Cuir Marron",
    image: product1,
    images: [product1, product2],
    currentPrice: "159.000 DT",
    category: "sacs",
    inStock: true,
  },
  {
    id: "18",
    title: "Sac à Dos Voyage",
    image: product2,
    images: [product2, product3],
    currentPrice: "199.000 DT",
    category: "sacs",
    inStock: true,
  },
  {
    id: "19",
    title: "Pochette Élégante Noire",
    image: product3,
    images: [product3, product4],
    currentPrice: "89.000 DT",
    category: "sacs",
    inStock: true,
  },
  {
    id: "20",
    title: "Ceinture Cuir Premium",
    image: product4,
    images: [product4, product5],
    currentPrice: "49.000 DT",
    category: "sacs",
    inStock: true,
  },
];

export const productsById = Object.fromEntries(products.map((p) => [p.id, p]));

