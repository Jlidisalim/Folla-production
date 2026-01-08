import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import SEOHead from "@/components/SEOHead";
import { FaLeaf, FaHeart, FaHandsHelping, FaStar } from "react-icons/fa";

const stats = [
    { label: "Produits artisanaux", value: "500+", icon: FaLeaf },
    { label: "Artisans partenaires", value: "50+", icon: FaHandsHelping },
    { label: "Clients satisfaits", value: "10K+", icon: FaHeart },
    { label: "Années d'expérience", value: "5+", icon: FaStar },
];

const values = [
    {
        title: "Artisanat Authentique",
        description:
            "Chaque couffin est tissé à la main par des artisanes tunisiennes talentueuses, perpétuant un savoir-faire ancestral transmis de génération en génération.",
    },
    {
        title: "Qualité Premium",
        description:
            "Nous sélectionnons uniquement les meilleures matières premières naturelles : osier, palmier doum, et feuilles de palmier pour garantir durabilité et élégance.",
    },
    {
        title: "Commerce Équitable",
        description:
            "En achetant chez Folla, vous soutenez directement les communautés d'artisans et contribuez à la préservation d'un patrimoine culturel unique.",
    },
];

const Apropos = () => {
    return (
        <>
            <SEOHead
                title="À propos de FollaCouffin – Artisanat tunisien fait main"
                description="Découvrez l'histoire de FollaCouffin : boutique tunisienne d'artisanat fait main. Nos valeurs, nos artisans, notre mission pour sublimer votre intérieur."
                canonicalUrl="https://follacouffin.tn/a-propos"
            />

            <Header products={[]} />

            <div className="bg-white min-h-screen">
                <div className="max-w-7xl mx-auto px-6 py-8">
                    {/* Breadcrumb */}
                    <nav className="mb-8">
                        <ol className="flex items-center gap-2 text-sm">
                            <li>
                                <Link to="/" className="text-gray-600 hover:text-black font-medium">
                                    ACCUEIL
                                </Link>
                            </li>
                            <li className="text-gray-400">›</li>
                            <li className="text-gray-600 font-medium">À PROPOS</li>
                        </ol>
                    </nav>

                    {/* Hero Section */}
                    <div className="grid lg:grid-cols-2 gap-12 mb-16">
                        {/* Left Side - Content */}
                        <div>
                            <h1 className="text-5xl md:text-6xl font-bold text-black leading-tight mb-6">
                                L'art du<br />
                                couffin tunisien
                            </h1>

                            <p className="text-gray-600 text-lg leading-relaxed mb-8">
                                Folla Couffin est née d'une passion profonde pour l'artisanat tunisien 
                                et d'un désir de partager ces trésors avec le monde. Depuis notre création, 
                                nous travaillons main dans la main avec des artisanes locales pour vous 
                                offrir des pièces uniques, alliant tradition et modernité.
                            </p>

                            <p className="text-gray-600 text-lg leading-relaxed mb-8">
                                Chaque produit raconte une histoire, celle de mains expertes qui tissent 
                                avec amour et savoir-faire. Du couffin traditionnel aux créations 
                                contemporaines, nous célébrons la beauté de l'artisanat tunisien.
                            </p>

                            <Link to="/products">
                                <Button
                                    className="bg-black hover:bg-gray-800 text-white font-medium px-8 py-6 rounded-full text-sm tracking-wide"
                                >
                                    DÉCOUVRIR NOS PRODUITS
                                </Button>
                            </Link>
                        </div>

                        {/* Right Side - Image */}
                        <div className="relative">
                            <div className="aspect-[4/3] overflow-hidden rounded-lg">
                                <img
                                    src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                                    alt="Artisanat tunisien - couffins traditionnels"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Stats Section */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 py-12 border-t border-b border-gray-200">
                        {stats.map((stat) => (
                            <div key={stat.label} className="text-center">
                                <stat.icon className="w-8 h-8 mx-auto mb-3 text-black" />
                                <div className="text-3xl font-bold text-black mb-1">{stat.value}</div>
                                <div className="text-gray-500 text-sm">{stat.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Our Story Section */}
                    <div className="grid lg:grid-cols-2 gap-12 py-16">
                        {/* Left Side - Image */}
                        <div className="relative order-2 lg:order-1">
                            <div className="aspect-[4/3] overflow-hidden rounded-lg">
                                <img
                                    src="https://images.unsplash.com/photo-1606722590583-6951b5ea92ad?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                                    alt="Artisane tunisienne tissant un couffin"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>

                        {/* Right Side - Content */}
                        <div className="order-1 lg:order-2">
                            <h2 className="text-4xl font-bold text-black mb-6">
                                Notre Histoire
                            </h2>
                            <p className="text-gray-600 text-lg leading-relaxed mb-6">
                                Tout a commencé par un voyage dans les régions artisanales de la Tunisie. 
                                Fascinés par le talent des artisanes et la beauté de leurs créations, 
                                nous avons décidé de créer un pont entre ces trésors cachés et les 
                                amateurs d'artisanat du monde entier.
                            </p>
                            <p className="text-gray-600 text-lg leading-relaxed mb-6">
                                Aujourd'hui, Folla Couffin est devenue une référence pour l'artisanat 
                                tunisien authentique. Nous travaillons directement avec plus de 50 
                                artisanes, leur offrant une visibilité internationale tout en préservant 
                                leurs techniques traditionnelles.
                            </p>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                Notre mission ? Faire rayonner l'artisanat tunisien tout en assurant 
                                des conditions de travail justes et équitables pour toutes nos partenaires.
                            </p>
                        </div>
                    </div>

                    {/* Values Section */}
                    <div className="py-12 border-t border-gray-200">
                        <h2 className="text-4xl font-bold text-black text-center mb-12">
                            Nos Valeurs
                        </h2>
                        <div className="grid md:grid-cols-3 gap-8">
                            {values.map((value, index) => (
                                <div key={index} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                                        <span className="text-2xl font-bold text-black">{index + 1}</span>
                                    </div>
                                    <h3 className="text-xl font-semibold text-black mb-4">{value.title}</h3>
                                    <p className="text-gray-600 leading-relaxed">{value.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CTA Section */}
                    <div className="py-16">
                        <div className="bg-black rounded-2xl p-12 text-center">
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                Prêt à découvrir nos créations ?
                            </h2>
                            <p className="text-white/90 text-lg mb-8 max-w-2xl mx-auto">
                                Explorez notre collection de couffins, paniers et accessoires 
                                artisanaux, tous fabriqués avec amour en Tunisie.
                            </p>
                            <div className="flex flex-wrap justify-center gap-4">
                                <Link to="/products">
                                    <Button
                                        className="bg-white text-black hover:bg-gray-100 font-medium px-8 py-6 rounded-full text-sm tracking-wide"
                                    >
                                        VOIR LA COLLECTION
                                    </Button>
                                </Link>
                                <Link to="/contact">
                                    <Button
                                        variant="outline"
                                        className=" bg-white border-2 border-white text-black hover:bg-white/10 font-medium px-8 py-6 rounded-full text-sm tracking-wide"
                                    >
                                        NOUS CONTACTER
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Footer />
        </>
    );
};

export default Apropos;
