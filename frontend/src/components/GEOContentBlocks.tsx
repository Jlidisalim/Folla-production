// src/components/GEOContentBlocks.tsx
// Blocs de contenu optimisés pour le GEO (Generative Engine Optimization)
import { Link } from 'react-router-dom';

/**
 * Section d'introduction pour la page d'accueil
 * Répond à: "Qu'est-ce que FollaCouffin ?"
 */
export function HomeIntroSection() {
  return (
    <section className="max-w-4xl mx-auto px-4 py-12 text-center">
      <h2 className="text-2xl md:text-3xl font-bold mb-4">
        Qu'est-ce que FollaCouffin ?
      </h2>
      <p className="text-lg text-gray-700 leading-relaxed mb-6">
        <strong>FollaCouffin</strong> est une boutique en ligne spécialisée dans 
        l'<strong>artisanat tunisien fait main</strong>. Nous proposons des pièces 
        uniques – paniers de rangement, décoration bohème, sacs artisanaux et 
        accessoires de table – créées par des <strong>artisans tunisiens</strong> 
        en petites séries. Chaque produit allie savoir-faire traditionnel et 
        design contemporain pour sublimer votre intérieur.
      </p>
      <p className="text-gray-600">
        Livraison partout en Tunisie · Paiement à la livraison ou par carte · 
        Produits 100% faits main
      </p>
    </section>
  );
}

/**
 * Section "Comment ça marche" pour la page d'accueil
 * Répond à: "Comment fonctionne la livraison chez FollaCouffin ?"
 */
export function HomeHowItWorksSection() {
  const steps = [
    {
      icon: "📦",
      title: "Livraison nationale",
      description: "Nous livrons partout en Tunisie : Tunis, Ariana, Sousse, Sfax, Nabeul, Bizerte, Béja et toutes les régions."
    },
    {
      icon: "💳",
      title: "Paiement flexible",
      description: "Payez à la livraison (COD) ou par carte bancaire via notre passerelle sécurisée. Pas de mauvaises surprises."
    },
    {
      icon: "🎁",
      title: "Pièces uniques",
      description: "Chaque produit est fabriqué à la main en quantité limitée. Vous recevez une pièce authentique et artisanale."
    }
  ];

  return (
    <section className="bg-amber-50/50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-center mb-8">
          Comment fonctionne la livraison chez FollaCouffin ?
        </h2>
        <div className="grid md:grid-cols-3 gap-6 text-center">
          {steps.map((step, index) => (
            <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-amber-100">
              <div className="text-3xl mb-3">{step.icon}</div>
              <h3 className="font-semibold mb-2">{step.title}</h3>
              <p className="text-gray-600 text-sm">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Header enrichi pour les pages catégorie
 * Répond à: "Où trouver {categoryName} artisanaux en Tunisie ?"
 */
interface CategoryHeaderProps {
  categoryName: string;
  categorySlug: string;
  description: string;
}

export function CategoryHeader({ categoryName, categorySlug, description }: CategoryHeaderProps) {
  return (
    <section className="bg-gradient-to-b from-amber-50 to-white py-10">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <nav className="text-sm text-gray-500 mb-4" aria-label="Fil d'Ariane">
          <Link to="/" className="hover:text-amber-600">Accueil</Link>
          <span className="mx-2">/</span>
          <span className="text-amber-700">{categoryName}</span>
        </nav>
        
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          {categoryName} – Artisanat tunisien fait main
        </h1>
        
        <p className="text-lg text-gray-700 leading-relaxed max-w-3xl mx-auto">
          {description}
        </p>
      </div>
    </section>
  );
}

/** Descriptions par catégorie */
export const categoryDescriptions: Record<string, string> = {
  'decoration': "Découvrez notre collection de décoration artisanale tunisienne : paniers de rangement en fibres naturelles, objets déco bohème, vases et accessoires pour la maison. Chaque pièce est faite à la main par des artisans locaux et disponible en quantité limitée. Livraison partout en Tunisie.",
  'sacs': "Explorez notre sélection de sacs & accessoires artisanaux tunisiens : sacs cabas, paniers de plage, pochettes et sacs à main en fibres naturelles. Créations uniques faites main, parfaites pour un style bohème chic. Livraison dans toute la Tunisie.",
  'art-de-la-table': "Sublimez vos repas avec notre collection art de la table artisanale : sets de table, corbeilles à pain, dessous de plat tressés à la main en Tunisie. Des pièces authentiques pour une table élégante et naturelle.",
  'nouveautes': "Découvrez nos dernières créations artisanales : nouveaux paniers, déco et accessoires fraîchement arrivés. Pièces uniques en quantité limitée, faites main par nos artisans tunisiens.",
  'cuisine': "Équipez votre cuisine avec nos accessoires artisanaux tunisiens : paniers de rangement, corbeilles à fruits, porte-ustensiles et plus. Fonctionnels et esthétiques, fabriqués à la main."
};

/**
 * Bloc infos livraison pour les pages produit
 */
export function ProductShippingInfo() {
  return (
    <div className="bg-gray-50 rounded-xl p-4 mt-6 border border-gray-100">
      <h3 className="font-semibold mb-2 flex items-center gap-2">
        🚚 Livraison en Tunisie
      </h3>
      <ul className="text-sm text-gray-600 space-y-1">
        <li>• Délai : 2-5 jours ouvrés selon votre région</li>
        <li>• Zones couvertes : Tunis, Sousse, Sfax, Nabeul, Bizerte, Béja et plus</li>
        <li>• Paiement à la livraison (COD) disponible</li>
        <li>• Livraison gratuite dès 200 TND d'achat</li>
      </ul>
      <Link 
        to="/livraison" 
        className="text-amber-600 hover:underline text-sm mt-2 inline-block"
      >
        En savoir plus sur la livraison →
      </Link>
    </div>
  );
}

/**
 * Section description enrichie pour les pages produit
 */
interface ProductDescriptionProps {
  title: string;
  description: string;
  materials?: string;
  dimensions?: string;
  usage?: string;
  care?: string;
}

export function ProductDescriptionGEO({ 
  title, 
  description, 
  materials,
  dimensions,
  usage,
  care 
}: ProductDescriptionProps) {
  return (
    <section className="py-8 border-t">
      <h2 className="text-xl font-bold mb-4">
        À propos de ce produit artisanal
      </h2>
      
      <div className="prose prose-gray max-w-none">
        <p className="text-gray-700 leading-relaxed">{description}</p>
        
        {(materials || dimensions || usage) && (
          <>
            <h3 className="text-lg font-semibold mt-6 mb-2">Caractéristiques</h3>
            <ul className="text-gray-700 space-y-1">
              {materials && <li><strong>Matériaux</strong> : {materials}</li>}
              {dimensions && <li><strong>Dimensions</strong> : {dimensions}</li>}
              <li><strong>Fabrication</strong> : 100% fait main en Tunisie</li>
              {usage && <li><strong>Usage</strong> : {usage}</li>}
            </ul>
          </>
        )}
        
        {care && (
          <>
            <h3 className="text-lg font-semibold mt-6 mb-2">Entretien</h3>
            <p className="text-gray-700">{care}</p>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * Encadré "En bref" pour la page À propos
 */
export function AboutQuickFacts() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
      <h2 className="text-xl font-bold mb-4">FollaCouffin en bref</h2>
      <ul className="space-y-2 text-gray-700">
        <li>
          <strong>Spécialité</strong> : Artisanat tunisien fait main 
          (décoration, paniers, sacs, art de la table)
        </li>
        <li>
          <strong>Origine</strong> : Tous nos produits sont fabriqués 
          par des artisans en Tunisie
        </li>
        <li>
          <strong>Livraison</strong> : Partout en Tunisie 
          (Tunis, Sousse, Sfax, Nabeul, Bizerte, Béja...)
        </li>
        <li>
          <strong>Paiement</strong> : À la livraison (COD) ou carte bancaire
        </li>
        <li>
          <strong>Particularité</strong> : Pièces uniques en petites séries, 
          quantité limitée
        </li>
      </ul>
    </div>
  );
}

/**
 * Section "Vous aimerez aussi" pour les pages produit
 */
interface RelatedProductsProps {
  children: React.ReactNode;
}

export function RelatedProductsSection({ children }: RelatedProductsProps) {
  return (
    <section className="py-12 border-t">
      <h2 className="text-xl font-bold mb-6">Vous aimerez aussi</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {children}
      </div>
    </section>
  );
}

/**
 * Lien retour vers la catégorie parente
 */
interface BackToCategoryProps {
  categorySlug: string;
  categoryName: string;
}

export function BackToCategoryLink({ categorySlug, categoryName }: BackToCategoryProps) {
  return (
    <Link 
      to={`/category/${categorySlug}`} 
      className="text-sm text-gray-500 hover:text-amber-600 inline-flex items-center gap-1 mb-4"
    >
      ← Retour à {categoryName}
    </Link>
  );
}
