/**
 * Sitemap Endpoint
 * 
 * Generates dynamic XML sitemap for SEO.
 * Includes: homepage, categories, and all published products.
 */

import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

const SITE_URL = process.env.FRONTEND_URL || "https://follacouffin.tn";

// Categories to include in sitemap
const STATIC_PAGES = [
    { loc: "/", priority: "1.0", changefreq: "daily" },
    { loc: "/a-propos", priority: "0.5", changefreq: "monthly" },
    { loc: "/contact", priority: "0.5", changefreq: "monthly" },
    { loc: "/faq", priority: "0.5", changefreq: "monthly" },
    { loc: "/livraison", priority: "0.5", changefreq: "monthly" },
    { loc: "/vente-flash", priority: "0.8", changefreq: "daily" },
];

const CATEGORIES = [
    "cuisine",
    "menage",
    "rangement",
    "decoration",
    "textile",
    "jardin",
    "electromenager",
];

/**
 * GET /sitemap.xml
 * Returns dynamic XML sitemap
 */
router.get("/", async (_req, res: Response) => {
    try {
        // Fetch all visible products
        const products = await prisma.product.findMany({
            where: {
                visible: true,
                status: "Active",
            },
            select: {
                slug: true,
                updatedAt: true,
                category: true,
            },
            orderBy: { updatedAt: "desc" },
        });

        // Generate XML
        const xml = generateSitemapXml(products);

        res.header("Content-Type", "application/xml");
        res.header("Cache-Control", "public, max-age=3600"); // Cache 1 hour
        res.send(xml);
    } catch (err) {
        console.error("Sitemap generation error:", err);
        res.status(500).send("Error generating sitemap");
    }
});

function generateSitemapXml(products: Array<{ slug: string; updatedAt: Date; category: string }>) {
    const today = new Date().toISOString().split("T")[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    // Static pages
    for (const page of STATIC_PAGES) {
        xml += `  <url>
    <loc>${SITE_URL}${page.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
    }

    // Category pages
    for (const category of CATEGORIES) {
        xml += `  <url>
    <loc>${SITE_URL}/category/${category}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`;
    }

    // Product pages
    for (const product of products) {
        const lastmod = product.updatedAt.toISOString().split("T")[0];
        xml += `  <url>
    <loc>${SITE_URL}/product/${product.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    }

    xml += `</urlset>`;

    return xml;
}

export default router;
