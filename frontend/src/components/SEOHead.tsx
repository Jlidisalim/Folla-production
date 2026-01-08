// src/components/SEOHead.tsx
// Composant réutilisable pour les meta tags SEO et les données structurées JSON-LD
import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogImage?: string;
  type?: 'website' | 'product' | 'article';
  jsonLd?: object | object[];
  noIndex?: boolean;
}

/**
 * Composant SEO réutilisable pour toutes les pages
 * Gère: title, meta description, Open Graph, Twitter Cards, JSON-LD
 */
export default function SEOHead({
  title,
  description,
  canonicalUrl,
  ogImage = 'https://follacouffin.tn/og-default.jpg',
  type = 'website',
  jsonLd,
  noIndex = false,
}: SEOHeadProps) {
  // Ajouter le suffixe de marque si pas déjà présent
  const fullTitle = title.includes('FollaCouffin') 
    ? title 
    : `${title} | FollaCouffin`;

  // Tronquer la description à 160 caractères pour SEO
  const truncatedDesc = description.length > 160 
    ? description.substring(0, 157) + '...' 
    : description;

  return (
    <Helmet>
      {/* Balises primaires */}
      <title>{fullTitle}</title>
      <meta name="description" content={truncatedDesc} />
      
      {/* Robots */}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Canonical */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={truncatedDesc} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={ogImage} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:locale" content="fr_TN" />
      <meta property="og:site_name" content="FollaCouffin" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={truncatedDesc} />
      <meta name="twitter:image" content={ogImage} />
      
      {/* JSON-LD Structured Data */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(Array.isArray(jsonLd) ? jsonLd : [jsonLd])}
        </script>
      )}
    </Helmet>
  );
}

// ============================================================================
// Helpers pour générer les JSON-LD
// ============================================================================

/**
 * Génère le JSON-LD Organization global
 */
export function getOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "FollaCouffin",
    "url": "https://follacouffin.tn",
    "logo": "https://follacouffin.tn/logo-removebg-preview.png",
    "description": "Boutique en ligne d'artisanat tunisien fait main : décoration, paniers, sacs et accessoires.",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "83 Avenue 14 Janvier 2011, Sidi Daoud",
      "addressLocality": "La Marsa",
      "addressRegion": "Tunis",
      "postalCode": "2011",
      "addressCountry": "TN"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+216-96-33-20-16",
      "contactType": "customer service",
      "availableLanguage": ["French", "Arabic"]
    }
  };
}

/**
 * Génère le JSON-LD BreadcrumbList
 */
export function getBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  };
}

/**
 * Génère le JSON-LD Product
 */
export function getProductSchema({
  name,
  description,
  image,
  price,
  currency = "TND",
  availability = "InStock",
  category,
  url,
  ratingValue,
  reviewCount,
}: {
  name: string;
  description: string;
  image: string | string[];
  price: number;
  currency?: string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
  category?: string;
  url: string;
  ratingValue?: number;
  reviewCount?: number;
}) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": name,
    "description": description,
    "image": Array.isArray(image) ? image : [image],
    "brand": {
      "@type": "Brand",
      "name": "FollaCouffin"
    },
    "offers": {
      "@type": "Offer",
      "url": url,
      "priceCurrency": currency,
      "price": price.toFixed(2),
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "availability": `https://schema.org/${availability}`,
      "itemCondition": "https://schema.org/NewCondition",
      "seller": {
        "@type": "Organization",
        "name": "FollaCouffin"
      },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingDestination": {
          "@type": "DefinedRegion",
          "addressCountry": "TN"
        },
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": 1,
            "maxValue": 2,
            "unitCode": "DAY"
          },
          "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 2,
            "maxValue": 5,
            "unitCode": "DAY"
          }
        }
      }
    }
  };

  if (category) {
    schema["category"] = category;
  }

  if (ratingValue && reviewCount) {
    schema["aggregateRating"] = {
      "@type": "AggregateRating",
      "ratingValue": ratingValue.toFixed(1),
      "reviewCount": reviewCount
    };
  }

  return schema;
}

/**
 * Génère le JSON-LD FAQPage
 */
export function getFAQSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
}
