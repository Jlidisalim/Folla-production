// src/pages/FAQ.tsx
// Page FAQ avec design cohérent Contact/Apropos
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead, { getFAQSchema } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useState } from "react";
import { FaChevronDown, FaChevronUp, FaShippingFast, FaCreditCard, FaHandHoldingHeart, FaQuestionCircle } from "react-icons/fa";

const faqCategories = [
    {
        id: "general",
        title: "Questions générales",
        icon: FaQuestionCircle,
        faqs: [
            {
                question: "Qu'est-ce que FollaCouffin ?",
                answer: "FollaCouffin est une boutique en ligne tunisienne spécialisée dans l'artisanat traditionnel. Nous proposons des couffins, paniers, sacs et accessoires de décoration fabriqués à la main par des artisanes locales."
            },
            {
                question: "Vos produits sont-ils authentiques ?",
                answer: "Oui, tous nos produits sont 100% faits main en Tunisie par des artisanes qualifiées. Chaque pièce est unique et témoigne d'un savoir-faire ancestral transmis de génération en génération."
            },
            {
                question: "Proposez-vous des personnalisations ?",
                answer: "Oui, nous pouvons personnaliser certains produits selon vos besoins (broderie de nom, choix de couleurs). Contactez-nous via WhatsApp pour discuter de votre projet personnalisé."
            }
        ]
    },
    {
        id: "livraison",
        title: "Livraison",
        icon: FaShippingFast,
        faqs: [
            {
                question: "Quels sont les délais de livraison ?",
                answer: " Tunisie 2-3 jours ouvrés. Vous recevrez un appel du livreur avant la remise."
            },
            {
                question: "La livraison est-elle gratuite ?",
                answer: "La livraison est gratuite à partir de 200 TND d'achat. En dessous, des frais de livraison s'appliquent selon votre région."
            },
            {
                question: "Comment suivre ma commande ?",
                answer: "Une fois votre commande expédiée, vous recevrez un email avec les informations de suivi. Vous pouvez également nous contacter via WhatsApp au +216 97 440 550 pour avoir le statut de votre commande."
            },
            {
                question: "Livrez-vous en dehors de la Tunisie ?",
                answer: "Actuellement, nous livrons uniquement en Tunisie. Nous travaillons sur l'expansion de nos services de livraison internationale. Restez connectés !"
            }
        ]
    },
    {
        id: "paiement",
        title: "Paiement",
        icon: FaCreditCard,
        faqs: [
            {
                question: "Quels modes de paiement acceptez-vous ?",
                answer: "Nous acceptons le paiement à la livraison (COD) partout en Tunisie, ainsi que le paiement par carte bancaire en ligne via notre plateforme sécurisée."
            },
            {
                question: "Le paiement en ligne est-il sécurisé ?",
                answer: "Absolument ! Notre site utilise un cryptage SSL et nos paiements sont traités via des plateformes certifiées et sécurisées."
            },
            {
                question: "Puis-je payer en plusieurs fois ?",
                answer: "Pour le moment, nous n'offrons pas de paiement échelonné. Cependant, vous pouvez nous contacter pour des commandes importantes et nous étudierons votre demande."
            }
        ]
    },
    {
        id: "retours",
        title: "Retours et échanges",
        icon: FaHandHoldingHeart,
        faqs: [
            {
                question: "Quelle est votre politique de retour ?",
                answer: "Vous disposez de 7 jours après réception pour nous signaler tout problème. Le produit doit être retourné dans son état d'origine, non utilisé et avec son emballage."
            },
            {
                question: "Comment effectuer un retour ?",
                answer: "Contactez-nous via WhatsApp ou email pour initier votre demande de retour. Notre équipe vous guidera dans les étapes à suivre."
            },
            {
                question: "Sous quel délai serai-je remboursé ?",
                answer: "Une fois le produit retourné et vérifié, le remboursement est effectué sous 5-7 jours ouvrés via le même mode de paiement utilisé lors de l'achat."
            }
        ]
    }
];

const allFAQs = faqCategories.flatMap(cat => cat.faqs);

interface FAQItemProps {
    question: string;
    answer: string;
    isOpen: boolean;
    onToggle: () => void;
}

const FAQItem = ({ question, answer, isOpen, onToggle }: FAQItemProps) => (
    <div className="border-b border-gray-200 last:border-b-0">
        <button
            onClick={onToggle}
            className="w-full py-5 flex items-center justify-between text-left hover:text-gray-600 transition-colors"
        >
            <span className="font-medium text-gray-900 pr-4">{question}</span>
            {isOpen ? (
                <FaChevronUp className="w-4 h-4 text-black flex-shrink-0" />
            ) : (
                <FaChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
        </button>
        {isOpen && (
            <div className="pb-5 text-gray-600 leading-relaxed">
                {answer}
            </div>
        )}
    </div>
);

export default function FAQ() {
    const [openItems, setOpenItems] = useState<{ [key: string]: boolean }>({});
    const [activeCategory, setActiveCategory] = useState("general");

    const toggleItem = (key: string) => {
        setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const currentCategory = faqCategories.find(cat => cat.id === activeCategory) || faqCategories[0];

    return (
        <>
            <SEOHead
                title="FAQ – Questions fréquentes | FollaCouffin"
                description="Retrouvez les réponses à toutes vos questions sur FollaCouffin : livraison en Tunisie, paiement, retours, entretien des produits artisanaux."
                canonicalUrl="https://follacouffin.tn/faq"
                jsonLd={getFAQSchema(allFAQs)}
            />

            <Header products={[]} />

            <div className="bg-white min-h-screen">
                <div className="max-w-4xl mx-auto px-6 py-8">
                    {/* Breadcrumb */}
                    <nav className="mb-8">
                        <ol className="flex items-center gap-2 text-sm">
                            <li>
                                <Link to="/" className="text-gray-600 hover:text-black font-medium">
                                    ACCUEIL
                                </Link>
                            </li>
                            <li className="text-gray-400">›</li>
                            <li className="text-gray-600 font-medium">FAQ</li>
                        </ol>
                    </nav>

                    {/* Hero Section - Centered */}
                    <div className="text-center py-8 mb-10">
                        <h1 className="text-5xl md:text-6xl font-bold text-black leading-tight mb-6">
                            Questions fréquentes
                        </h1>

                        <p className="text-gray-600 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
                            Retrouvez ici les réponses à toutes vos questions sur nos produits, 
                            la livraison, le paiement et les retours.
                        </p>

                        {/* Category Tabs - Centered */}
                        <div className="flex flex-wrap justify-center gap-3">
                            {faqCategories.map((category) => (
                                <button
                                    key={category.id}
                                    onClick={() => setActiveCategory(category.id)}
                                    className={`flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium transition-all ${
                                        activeCategory === category.id
                                            ? "bg-black text-white"
                                            : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200"
                                    }`}
                                >
                                    <category.icon className="w-4 h-4" />
                                    {category.title}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* FAQ List */}
                    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 mb-12">
                        <div className="flex items-center gap-3 mb-6">
                            <currentCategory.icon className="w-6 h-6 text-black" />
                            <h2 className="text-2xl font-bold text-black">{currentCategory.title}</h2>
                        </div>
                        
                        <div>
                            {currentCategory.faqs.map((faq, index) => (
                                <FAQItem
                                    key={`${currentCategory.id}-${index}`}
                                    question={faq.question}
                                    answer={faq.answer}
                                    isOpen={openItems[`${currentCategory.id}-${index}`] || false}
                                    onToggle={() => toggleItem(`${currentCategory.id}-${index}`)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* CTA Section */}
                    <div className="bg-black rounded-2xl p-10 text-center mb-12">
                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                            Vous n'avez pas trouvé votre réponse ?
                        </h2>
                        <p className="text-white/90 text-lg mb-8 max-w-xl mx-auto">
                            Notre équipe est disponible pour répondre à toutes vos questions.
                        </p>
                        <div className="flex flex-wrap justify-center gap-4">
                            <a href="https://wa.me/21697440550" target="_blank" rel="noopener noreferrer">
                                <Button
                                    className="bg-white text-black hover:bg-gray-100 font-medium px-8 py-6 rounded-full text-sm tracking-wide"
                                >
                                    WHATSAPP
                                </Button>
                            </a>
                            <Link to="/contact">
                                <Button
                                    variant="outline"
                                    className=" bg-black border-2 border-white text-white hover:bg-white/10 font-medium px-8 py-6 rounded-full text-sm tracking-wide"
                                >
                                    NOUS CONTACTER
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <Footer />
        </>
    );
}
