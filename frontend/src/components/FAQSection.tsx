// src/components/FAQSection.tsx
// Composant réutilisable pour les sections FAQ - optimisé GEO
import { getFAQSchema } from './SEOHead';

export interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  title: string;
  faqs: FAQItem[];
  className?: string;
  /** Si true, génère le JSON-LD FAQPage (à utiliser une fois par page) */
  includeSchema?: boolean;
}

/**
 * Section FAQ réutilisable avec style accordéon
 * Optimisée pour le GEO (Generative Engine Optimization)
 * Design propre avec icône question, séparateurs et chevrons
 */
export default function FAQSection({
  title,
  faqs,
  className = '',
  includeSchema = false
}: FAQSectionProps) {
  return (
    <section className={`max-w-4xl mx-auto px-4 py-12 ${className}`}>
      {/* Header with question mark icon */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white text-lg font-bold">?</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      </div>

      {/* FAQ items with clean separators */}
      <div className="bg-white rounded-lg">
        {faqs.map((faq, index) => (
          <details
            key={index}
            className="group"
          >
            <summary className="py-5 cursor-pointer flex justify-between items-center list-none border-b border-gray-200 last:border-b-0">
              <span className="font-medium text-gray-900 pr-4">{faq.question}</span>
              <svg
                className="w-5 h-5 text-gray-400 transition-transform duration-200 group-open:rotate-180 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="pb-5 text-gray-600 leading-relaxed border-b border-gray-200">
              {faq.answer}
            </div>
          </details>
        ))}
      </div>

      {/* JSON-LD FAQPage schema */}
      {includeSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(getFAQSchema(faqs)) }}
        />
      )}
    </section>
  );
}

// ============================================================================
// FAQ Data - Contenu prédéfini en français
// ============================================================================

/** FAQ générale pour la page d'accueil */
export const homeFAQs: FAQItem[] = [
  {
    question: "Qu'est-ce que FollaCouffin ?",
    answer: "FollaCouffin est une boutique en ligne tunisienne spécialisée dans l'artisanat fait main. Nous proposons des produits de décoration, des paniers de rangement, des sacs artisanaux et des accessoires pour la maison, tous fabriqués par des artisans tunisiens."
  },
  {
    question: "Où livrez-vous en Tunisie ?",
    answer: "Nous livrons partout en Tunisie : Tunis, Ariana, Ben Arous, Nabeul, Bizerte, Sousse, Monastir, Sfax, Béja, Jendouba et toutes les autres régions. Les délais varient de 2 à 5 jours ouvrés selon votre localisation."
  },
  {
    question: "Quels modes de paiement acceptez-vous ?",
    answer: "Nous acceptons le paiement à la livraison (COD) partout en Tunisie, ainsi que le paiement par carte bancaire via notre passerelle sécurisée. Vous choisissez l'option qui vous convient au checkout."
  },
  {
    question: "Vos produits sont-ils vraiment faits main ?",
    answer: "Oui, 100% de nos produits sont fabriqués à la main par des artisans tunisiens. Chaque pièce est unique et peut présenter de légères variations de couleur ou de forme, ce qui fait son authenticité. Nous travaillons en petites séries pour garantir la qualité."
  },
  {
    question: "Puis-je retourner un produit si je ne suis pas satisfait ?",
    answer: "Oui, vous disposez de 7 jours après réception pour nous contacter si le produit ne correspond pas à vos attentes. Nous étudions chaque demande au cas par cas et proposons un échange ou un remboursement selon la situation."
  }
];

/** FAQ pour les pages catégorie Décoration */
export const decorationFAQs: FAQItem[] = [
  {
    question: "Quels types de décoration proposez-vous ?",
    answer: "Notre collection décoration comprend des paniers de rangement tressés, des objets déco en fibres naturelles, des vases artisanaux, des cache-pots et des accessoires muraux. Tous sont fabriqués à la main en Tunisie dans un style bohème chic."
  },
  {
    question: "Quels matériaux utilisez-vous pour la décoration ?",
    answer: "Nos artisans travaillent principalement avec des fibres naturelles locales : alfa, osier, palmier, jonc et raphia. Ces matériaux durables et écologiques donnent à chaque pièce un caractère authentique et respectueux de l'environnement."
  },
  {
    question: "Comment entretenir mes objets de décoration artisanaux ?",
    answer: "Dépoussiérez régulièrement avec un chiffon sec ou une brosse douce. Évitez l'exposition directe au soleil et à l'humidité prolongée. Pour les taches légères, utilisez un chiffon légèrement humide et laissez sécher à l'air libre."
  }
];

/** FAQ pour les pages catégorie Sacs */
export const sacsFAQs: FAQItem[] = [
  {
    question: "Quels types de sacs artisanaux proposez-vous ?",
    answer: "Nous proposons des sacs cabas, des paniers de plage, des sacs à main et des pochettes, tous fabriqués à la main en Tunisie avec des matériaux naturels comme l'osier, le raphia et le palmier."
  },
  {
    question: "Les sacs sont-ils résistants pour un usage quotidien ?",
    answer: "Oui, nos sacs artisanaux sont conçus pour être durables. Les fibres naturelles tressées sont solides et les finitions soignées. Avec un entretien approprié, votre sac vous accompagnera pendant des années."
  },
  {
    question: "Comment nettoyer mon sac en fibres naturelles ?",
    answer: "Passez régulièrement un chiffon sec pour enlever la poussière. En cas de tache, utilisez un chiffon légèrement humide avec du savon doux, puis laissez sécher à l'air libre loin des sources de chaleur directe."
  }
];

/** FAQ générique pour les pages produit */
export const productFAQs: FAQItem[] = [
  {
    question: "Ce produit est-il adapté à un usage extérieur ?",
    answer: "Ce produit est conçu principalement pour un usage intérieur. Vous pouvez l'utiliser occasionnellement en extérieur couvert, mais évitez l'exposition prolongée à la pluie ou au soleil direct qui pourraient altérer les fibres naturelles."
  },
  {
    question: "Les dimensions sont-elles exactes ?",
    answer: "Chaque produit étant fabriqué à la main, de légères variations de 1-2 cm sont possibles. Les dimensions indiquées sont approximatives et représentent la moyenne de la série."
  },
  {
    question: "Quel est le délai de livraison pour ce produit ?",
    answer: "La livraison prend généralement 2-3 jours ouvrés selon votre région. Vous recevrez un appel du livreur avant la remise."
  }
];

/** Mapping des FAQ par catégorie */
export const categoryFAQsMap: Record<string, FAQItem[]> = {
  'decoration': decorationFAQs,
  'sacs': sacsFAQs,
  'art-de-la-table': [
    {
      question: "Quels produits proposez-vous pour l'art de la table ?",
      answer: "Notre collection art de la table comprend des sets de table, des corbeilles à pain, des dessous de plat et des accessoires de service, tous tressés à la main par des artisans tunisiens."
    },
    {
      question: "Ces produits sont-ils adaptés au contact alimentaire ?",
      answer: "Oui, nos produits pour la table sont fabriqués avec des matériaux naturels non traités, adaptés au contact alimentaire indirect (pour servir du pain, des fruits, etc.). Évitez le contact direct avec des aliments humides."
    },
    {
      question: "Comment nettoyer mes accessoires de table artisanaux ?",
      answer: "Secouez pour enlever les miettes, puis passez un chiffon sec. En cas de besoin, utilisez une brosse douce légèrement humide et laissez sécher complètement avant de ranger."
    }
  ],
  'nouveautes': [
    {
      question: "À quelle fréquence ajoutez-vous de nouveaux produits ?",
      answer: "Nous ajoutons régulièrement de nouvelles créations, généralement chaque semaine. Suivez-nous sur les réseaux sociaux ou inscrivez-vous à notre newsletter pour être informé des nouveautés."
    },
    {
      question: "Les nouveautés sont-elles en quantité limitée ?",
      answer: "Oui, la plupart de nos nouveautés sont produites en petites séries par nos artisans. Une fois épuisées, certaines pièces peuvent ne pas être reproduites. N'hésitez pas à commander rapidement si un produit vous plaît."
    }
  ]
};

/**
 * Retourne les FAQ appropriées pour une catégorie donnée
 */
export function getFAQsForCategory(categorySlug: string): FAQItem[] {
  return categoryFAQsMap[categorySlug.toLowerCase()] || decorationFAQs;
}
