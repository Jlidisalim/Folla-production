/**
 * JSON-LD Structured Data Components
 * 
 * Provides SEO-optimized structured data for search engines.
 * Implements Schema.org vocabulary for e-commerce.
 * 
 * Usage:
 *   <JsonLdOrganization />           - On all pages (in App or layout)
 *   <JsonLdWebsite />                - On homepage
 *   <JsonLdProduct product={...} />  - On product detail pages
 *   <JsonLdLocalBusiness />          - Optional, for local SEO in Tunisia
 */

import { Helmet } from "react-helmet-async";

// ============================================================
// Types
// ============================================================

interface Product {
    id: number;
    title: string;
    description: string;
    slug: string;
    images: string[];
    pricePiece?: number;
    priceQuantity?: number;
    category: string;
    inStock?: boolean;
    availableQuantity?: number;
    venteFlashActive?: boolean;
    venteFlashPrice?: number;
}

// ============================================================
// Organization Schema
// ============================================================

export function JsonLdOrganization() {
    const data = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "FollaCouffin",
        alternateName: "FOLLA",
        url: "https://follacouffin.tn",
        logo: "https://follacouffin.tn/logo.png",
        description: "Boutique en ligne d'artisanat tunisien fait main : décoration, paniers, sacs.",
        sameAs: [
            "https://www.facebook.com/follacouffin",
            "https://www.instagram.com/follacouffin",
        ],
        contactPoint: {
            "@type": "ContactPoint",
            telephone: "+216-XX-XXX-XXX",
            contactType: "customer service",
            availableLanguage: ["French", "Arabic"],
            areaServed: "TN",
        },
    };

    return (
        <Helmet>
            <script type="application/ld+json">
                {JSON.stringify(data)}
            </script>
        </Helmet>
    );
}

// ============================================================
// WebSite Schema (for homepage)
// ============================================================

export function JsonLdWebsite() {
    const data = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "FollaCouffin",
        alternateName: "FOLLA - Artisanat Tunisien",
        url: "https://follacouffin.tn",
        description: "Boutique en ligne d'artisanat tunisien fait main",
        inLanguage: "fr-TN",
        potentialAction: {
            "@type": "SearchAction",
            target: {
                "@type": "EntryPoint",
                urlTemplate: "https://follacouffin.tn/search?q={search_term_string}",
            },
            "query-input": "required name=search_term_string",
        },
    };

    return (
        <Helmet>
            <script type="application/ld+json">
                {JSON.stringify(data)}
            </script>
        </Helmet>
    );
}

// ============================================================
// Product Schema
// ============================================================

interface JsonLdProductProps {
    product: Product;
}

export function JsonLdProduct({ product }: JsonLdProductProps) {
    const baseUrl = "https://follacouffin.tn";

    // Determine price (flash sale or regular)
    const price = product.venteFlashActive && product.venteFlashPrice
        ? product.venteFlashPrice
        : product.pricePiece || product.priceQuantity || 0;

    // Determine availability
    const availability = product.inStock && (product.availableQuantity ?? 0) > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock";

    const data = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.title,
        description: product.description.substring(0, 500), // Max 500 chars
        image: product.images.map(img =>
            img.startsWith("http") ? img : `${baseUrl}${img}`
        ),
        url: `${baseUrl}/product/${product.slug}`,
        sku: `FOLLA-${product.id}`,
        brand: {
            "@type": "Brand",
            name: "FollaCouffin",
        },
        category: product.category,
        offers: {
            "@type": "Offer",
            price: price.toFixed(2),
            priceCurrency: "TND",
            availability,
            url: `${baseUrl}/product/${product.slug}`,
            seller: {
                "@type": "Organization",
                name: "FollaCouffin",
            },
            shippingDetails: {
                "@type": "OfferShippingDetails",
                shippingDestination: {
                    "@type": "DefinedRegion",
                    addressCountry: "TN",
                },
                deliveryTime: {
                    "@type": "ShippingDeliveryTime",
                    handlingTime: {
                        "@type": "QuantitativeValue",
                        minValue: 1,
                        maxValue: 3,
                        unitCode: "DAY",
                    },
                    transitTime: {
                        "@type": "QuantitativeValue",
                        minValue: 2,
                        maxValue: 5,
                        unitCode: "DAY",
                    },
                },
            },
            hasMerchantReturnPolicy: {
                "@type": "MerchantReturnPolicy",
                applicableCountry: "TN",
                returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
                merchantReturnDays: 14,
                returnMethod: "https://schema.org/ReturnByMail",
            },
        },
    };

    return (
        <Helmet>
            <script type="application/ld+json">
                {JSON.stringify(data)}
            </script>
        </Helmet>
    );
}

// ============================================================
// LocalBusiness Schema (for Tunisia-specific SEO)
// ============================================================

export function JsonLdLocalBusiness() {
    const data = {
        "@context": "https://schema.org",
        "@type": "Store",
        name: "FollaCouffin",
        description: "Boutique d'artisanat tunisien fait main",
        url: "https://follacouffin.tn",
        logo: "https://follacouffin.tn/logo.png",
        image: "https://follacouffin.tn/images/store-front.jpg",
        telephone: "+216-XX-XXX-XXX",
        email: "contact@follacouffin.tn",
        address: {
            "@type": "PostalAddress",
            streetAddress: "Rue Example 123",
            addressLocality: "Tunis",
            addressRegion: "Tunis",
            postalCode: "1000",
            addressCountry: "TN",
        },
        geo: {
            "@type": "GeoCoordinates",
            latitude: 36.8065,
            longitude: 10.1815,
        },
        priceRange: "$$",
        currenciesAccepted: "TND",
        paymentAccepted: "Cash, Credit Card",
        areaServed: {
            "@type": "Country",
            name: "Tunisia",
        },
        openingHoursSpecification: [
            {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                opens: "09:00",
                closes: "18:00",
            },
            {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: ["Saturday"],
                opens: "09:00",
                closes: "14:00",
            },
        ],
        hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Artisanat Tunisien",
            itemListElement: [
                { "@type": "OfferCatalog", name: "Décoration" },
                { "@type": "OfferCatalog", name: "Paniers" },
                { "@type": "OfferCatalog", name: "Sacs" },
                { "@type": "OfferCatalog", name: "Art de la Table" },
            ],
        },
    };

    return (
        <Helmet>
            <script type="application/ld+json">
                {JSON.stringify(data)}
            </script>
        </Helmet>
    );
}

// ============================================================
// BreadcrumbList Schema
// ============================================================

interface BreadcrumbItem {
    name: string;
    url: string;
}

interface JsonLdBreadcrumbProps {
    items: BreadcrumbItem[];
}

export function JsonLdBreadcrumb({ items }: JsonLdBreadcrumbProps) {
    const data = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: item.url,
        })),
    };

    return (
        <Helmet>
            <script type="application/ld+json">
                {JSON.stringify(data)}
            </script>
        </Helmet>
    );
}

export default {
    JsonLdOrganization,
    JsonLdWebsite,
    JsonLdProduct,
    JsonLdLocalBusiness,
    JsonLdBreadcrumb,
};
