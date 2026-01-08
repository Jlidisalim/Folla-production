/**
 * SEO Component using react-helmet-async
 * 
 * Provides comprehensive SEO meta tags for all pages including:
 * - Title and description
 * - Canonical URL
 * - OpenGraph tags
 * - Twitter Card tags
 * - Language/locale
 */

import { Helmet } from "react-helmet-async";

export interface SeoProps {
    title: string;
    description: string;
    canonicalUrl?: string;
    image?: string;
    type?: "website" | "article" | "product";
    noIndex?: boolean;
    keywords?: string[];
    // Product-specific
    product?: {
        price: number;
        currency?: string;
        availability?: "in stock" | "out of stock" | "preorder";
        sku?: string;
    };
}

const SITE_NAME = "FOLLA";
const DEFAULT_IMAGE = "https://follacouffin.tn/og-image.jpg"; // Update with your OG image
const SITE_URL = "https://follacouffin.tn";
const LOCALE = "fr_TN";

export default function Seo({
    title,
    description,
    canonicalUrl,
    image = DEFAULT_IMAGE,
    type = "website",
    noIndex = false,
    keywords = [],
    product,
}: SeoProps) {
    const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
    const fullUrl = canonicalUrl ? `${SITE_URL}${canonicalUrl}` : SITE_URL;

    return (
        <Helmet>
            {/* Primary Meta Tags */}
            <title>{fullTitle}</title>
            <meta name="title" content={fullTitle} />
            <meta name="description" content={description} />
            {keywords.length > 0 && <meta name="keywords" content={keywords.join(", ")} />}

            {/* Canonical URL */}
            <link rel="canonical" href={fullUrl} />

            {/* Language */}
            <html lang="fr" />
            <meta property="og:locale" content={LOCALE} />
            <meta property="og:locale:alternate" content="ar_TN" />

            {/* Robots */}
            {noIndex && <meta name="robots" content="noindex, nofollow" />}

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={fullUrl} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:site_name" content={SITE_NAME} />

            {/* Twitter */}
            <meta property="twitter:card" content="summary_large_image" />
            <meta property="twitter:url" content={fullUrl} />
            <meta property="twitter:title" content={fullTitle} />
            <meta property="twitter:description" content={description} />
            <meta property="twitter:image" content={image} />

            {/* GEO Tags for Tunisia */}
            <meta name="geo.region" content="TN" />
            <meta name="geo.placename" content="Tunisia" />

            {/* Product-specific meta (for e-commerce) */}
            {product && (
                <>
                    <meta property="product:price:amount" content={String(product.price)} />
                    <meta property="product:price:currency" content={product.currency || "TND"} />
                    <meta property="product:availability" content={product.availability || "in stock"} />
                    {product.sku && <meta property="product:retailer_item_id" content={product.sku} />}
                </>
            )}
        </Helmet>
    );
}
