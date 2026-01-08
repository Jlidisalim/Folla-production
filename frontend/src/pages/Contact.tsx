import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import SEOHead from "@/components/SEOHead";
import { useState } from "react";
import { FaFacebook, FaInstagram, FaTelegram, FaWhatsapp } from "react-icons/fa";
import { Link } from "react-router-dom";

const Contact = () => {
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        message: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Handle form submission - could integrate with WhatsApp or email
        const whatsappMessage = `Nom: ${formData.name}%0ATéléphone: ${formData.phone}%0AMessage: ${formData.message}`;
        window.open(`https://wa.me/21697440550?text=${whatsappMessage}`, "_blank");
    };

    return (
        <>
            <SEOHead
                title="Contactez FollaCouffin – Artisanat tunisien"
                description="Contactez notre équipe : questions, commandes, SAV. WhatsApp, email ou téléphone. Réponse sous 24h. Boutique à La Marsa, Tunis."
                canonicalUrl="https://follacouffin.tn/contact"
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
                            <li className="text-gray-600 font-medium">CONTACTEZ-NOUS</li>
                        </ol>
                    </nav>

                    {/* Main Content Grid */}
                    <div className="grid lg:grid-cols-2 gap-12 mb-16">
                        {/* Left Side - Form */}
                        <div>
                            <h1 className="text-5xl md:text-6xl font-bold text-black leading-tight mb-10">
                                Restons<br />
                                connectés
                            </h1>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="border-b border-gray-300">
                                    <input
                                        type="text"
                                        name="name"
                                        placeholder="Votre Nom *"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-gray-500"
                                        required
                                    />
                                </div>
                                
                                <div className="border-b border-gray-300">
                                    <input
                                        type="tel"
                                        name="phone"
                                        placeholder="Numéro de Téléphone *"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-gray-500"
                                        required
                                    />
                                </div>
                                
                                <div className="border-b border-gray-300">
                                    <textarea
                                        name="message"
                                        placeholder="Message*"
                                        value={formData.message}
                                        onChange={handleChange}
                                        rows={3}
                                        className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-gray-500 resize-none"
                                        required
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    className="bg-black hover:bg-gray-800 text-white font-medium px-8 py-6 rounded-full text-sm tracking-wide"
                                >
                                    ENVOYER MESSAGE
                                </Button>
                            </form>
                        </div>

                        {/* Right Side - Image */}
                        <div className="relative">
                            <div className="aspect-[4/3] overflow-hidden rounded-lg">
                                <img
                                    src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                                    alt="Notre équipe"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Contact Info Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 py-12 border-t border-gray-200">
                        {/* E-mail */}
                        <div>
                            <h3 className="font-semibold text-black mb-3">E-mail</h3>
                            <p className="text-gray-500 text-sm mb-3">
                                Envoyez-nous vos questions par e-mail
                            </p>
                            <a
                                href="mailto:folla_couffin@outlook.com"
                                className="text-black text-sm underline hover:no-underline"
                            >
                                folla_couffin@outlook.com

                            </a>
                        </div>

                        {/* Téléphone */}
                        <div>
                            <h3 className="font-semibold text-black mb-3">Téléphone</h3>
                            <p className="text-gray-500 text-sm mb-3">
                                Pour toute question, contactez-nous par téléphone
                            </p>
                            <a
                                href="tel:+21696332016"
                                className="text-black text-sm underline hover:no-underline"
                            >
                                +216 97 440 550
                            </a>
                        </div>

                        {/* Réseaux sociaux */}
                        <div>
                            <h3 className="font-semibold text-black mb-3">Réseaux sociaux</h3>
                            <p className="text-gray-500 text-sm mb-3">
                                Suivez-nous sur nos réseaux sociaux
                            </p>
                            <div className="flex gap-3">
                                <a
                                    href="https://wa.me/21697440550"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 transition-colors"
                                >
                                    <FaWhatsapp className="w-5 h-5" />
                                </a>
                                <a
                                    href="https://www.facebook.com/couffintraditionneltunisie"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 transition-colors"
                                >
                                    <FaFacebook className="w-5 h-5" />
                                </a>
                                <a
                                    href="https://www.instagram.com/folla_couffin/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 transition-colors"
                                >
                                    <FaInstagram className="w-5 h-5" />
                                </a>
                            </div>
                        </div>

                        {/* Adresse */}
                        <div>
                            <h3 className="font-semibold text-black mb-3">Adresse</h3>
                            <p className="text-gray-500 text-sm mb-3">
                                Venez nous rendre visite dans notre boutique
                            </p>
                            <a
                                href="https://maps.google.com/?q=83+Avenue+14+Janvier+2011,+Sidi+Daoud,+La+Marsa,+Tunis+2011"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-black text-sm underline hover:no-underline"
                            >
                                 Manzil Hurr, Tunisia<br />
                            </a>
                        </div>
                    </div>

                    {/* Map Section */}
                    <div className="mt-8 mb-12">
                        <div className="w-full h-[400px] rounded-lg overflow-hidden shadow-lg">
                            <iframe
                                title="Folla Tunisie"
                                src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d7531.918256657251!2d10.954707239899307!3d36.72925979339067!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1302b55434f23561%3A0x2ef599bf0aef76c8!2sManzel%20horr!5e1!3m2!1sen!2sus!4v1766670623170!5m2!1sen!2sus"
                                className="w-full h-full"
                                loading="lazy"
                                style={{ border: 0 }}
                                allowFullScreen
                            />
                        </div>
                    </div>
                </div>
            </div>

            <Footer />
        </>
    );
};

export default Contact;
