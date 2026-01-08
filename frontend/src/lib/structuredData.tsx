/**
 * Structured Data (JSON-LD) Helpers for SEO
 * 
 * Generates Schema.org structured data for:
 * - Organization
 * - Website  
 * - LocalBusiness (Tunisia GEO)
 * - Product
 * - BreadcrumbList
 */

// ============================================================
// TYPES
// ============================================================

export interface ProductSchemaData {
    name: string;
    description: string;
    image: string | string[];
    sku?: string;
    price: number;
    currency?: string;
    availability?: "InStock" | "OutOfStock" | "PreOrder";
    category?: string;
    brand?: string;
    url: string;
}

export interface BreadcrumbItem {
    name: string;
    url: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const SITE_NAME = "FOLLA";
const SITE_URL = "https://follacouffin.tn";
const LOGO_URL = "https://follacouffin.tn/logo.png"; // Update with your logo

// Business info for LocalBusiness schema
const BUSINESS_INFO = {
    name: "FOLLA",
    description: "Boutique en ligne de produits ménagers et accessoires en Tunisie",
    telephone: "+216 XX XXX XXX", // Update with real phone
    email: "contact@follacouffin.tn",
    address: {
        streetAddress: "", // Update if you have physical address
        addressLocality: "Tunis",
        addressRegion: "Tunis",
        postalCode: "",
        addressCountry: "TN",
    },
    priceRange: "$$",
    currenciesAccepted: "TND",
    paymentAccepted: ["Cash", "Credit Card", "Paymee"],
    openingHours: "Mo-Sa 09:00-18:00",
};

// ============================================================
// SCHEMA GENERATORS
// ============================================================

/**
 * Organization schema - for site-wide identity
 */
export function getOrganizationSchema() {
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
        logo: LOGO_URL,
        sameAs: [
            // Add your social media URLs
            // "https://www.facebook.com/folla.tn",
            // "https://www.instagram.com/folla.tn",
        ],
        contactPoint: {
            "@type": "ContactPoint",
            telephone: BUSINESS_INFO.telephone,
            contactType: "customer service",
            availableLanguage: ["French", "Arabic"],
            areaServed: "TN",
        },
    };
}

/**
 * Website schema with search action
 */
export function getWebsiteSchema() {
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
        inLanguage: ["fr-TN", "ar-TN"],
        potentialAction: {
            "@type": "SearchAction",
            target: {
                "@type": "EntryPoint",
                urlTemplate: `${SITE_URL}/category/all?search={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
        },
    };
}

/**
 * LocalBusiness schema - for Tunisia GEO targeting
 */
export function getLocalBusinessSchema() {
    return {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "@id": `${SITE_URL}/#localbusiness`,
        name: BUSINESS_INFO.name,
        description: BUSINESS_INFO.description,
        url: SITE_URL,
        logo: LOGO_URL,
        image: LOGO_URL,
        telephone: BUSINESS_INFO.telephone,
        email: BUSINESS_INFO.email,
        address: {
            "@type": "PostalAddress",
            ...BUSINESS_INFO.address,
        },
        geo: {
            "@type": "GeoCoordinates",
            latitude: 36.8065, // Tunis coordinates
            longitude: 10.1815,
        },
        priceRange: BUSINESS_INFO.priceRange,
        currenciesAccepted: BUSINESS_INFO.currenciesAccepted,
        paymentAccepted: BUSINESS_INFO.paymentAccepted.join(", "),
        openingHoursSpecification: {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            opens: "09:00",
            closes: "18:00",
        },
        areaServed: {
            "@type": "Country",
            name: "Tunisia",
        },
    };
}

/**
 * Product schema for product pages
 */
export function getProductSchema(product: ProductSchemaData) {
    const images = Array.isArray(product.image) ? product.image : [product.image];

    return {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description,
        image: images,
        sku: product.sku,
        url: product.url,
        brand: product.brand ? {
            "@type": "Brand",
            name: product.brand,
        } : undefined,
        category: product.category,
        offers: {
            "@type": "Offer",
            url: product.url,
            priceCurrency: product.currency || "TND",
            price: product.price,
            availability: `https://schema.org/${product.availability || "InStock"}`,
            seller: {
                "@type": "Organization",
                name: SITE_NAME,
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
                        unitCode: "d",
                    },
                    transitTime: {
                        "@type": "QuantitativeValue",
                        minValue: 1,
                        maxValue: 5,
                        unitCode: "d",
                    },
                },
            },
        },
    };
}

/**
 * Breadcrumb schema for navigation
 */
export function getBreadcrumbSchema(items: BreadcrumbItem[]) {
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: `${SITE_URL}${item.url}`,
        })),
    };
}

// ============================================================
// REACT COMPONENT HELPER
// ============================================================

/**
 * Renders JSON-LD script tag for structured data
 */
export function StructuredData({ data }: { data: object | object[] }) {
    const schemas = Array.isArray(data) ? data : [data];

    return (
        <>
            {schemas.map((schema, index) => (
                <script
                    key={index}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
                />
            ))}
        </>
    );
}

/**
 * Get all global schemas (for homepage/layout)
 */
export function getGlobalSchemas() {
    return [
        getOrganizationSchema(),
        getWebsiteSchema(),
        getLocalBusinessSchema(),
    ];
}
