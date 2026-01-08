import { Link } from "react-router-dom";
import { Facebook, Instagram, Youtube, MapPin } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

interface StoreLocation {
  id: number;
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
  sortOrder: number;
}

const Footer = () => {
  // Fetch store locations from API
  const { data: storeLocations = [] } = useQuery<StoreLocation[]>({
    queryKey: ["storeLocations"],
    queryFn: async () => {
      const res = await api.get("/api/settings/store-locations");
      return res.data;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return (
    <footer className="bg-muted py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <div className="flex flex-col items-start">
              <Link to="/">
                <img
                  src="/logo-removebg-preview.png"
                  alt="FollaCouffin - Artisanat tunisien fait main"
                  className="w-20"
                />
              </Link>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              FollaCouffin – Boutique en ligne spécialisée dans l'artisanat tunisien fait main : décoration, paniers, sacs et accessoires.
            </p>
          </div>

          {/* Boutique Links */}
          <div>
            <h3 className="font-semibold mb-4">Nos collections</h3>
            <div className="space-y-2 text-sm">
              <Link to="/category/decoration" className="block text-muted-foreground hover:text-amber-600 transition-colors">
                Décoration
              </Link>
              <Link to="/category/sacs" className="block text-muted-foreground hover:text-amber-600 transition-colors">
                Sacs & accessoires
              </Link>
              <Link to="/category/art-de-la-table" className="block text-muted-foreground hover:text-amber-600 transition-colors">
                Art de la table
              </Link>
              <Link to="/category/nouveautes" className="block text-muted-foreground hover:text-amber-600 transition-colors">
                Nouveautés
              </Link>
              <Link to="/vente-flash" className="block text-muted-foreground hover:text-amber-600 transition-colors">
                Ventes Flash
              </Link>
            </div>
          </div>

          {/* Informations Links */}
          <div>
            <h3 className="font-semibold mb-4">Informations</h3>
            <div className="space-y-2 text-sm">
              <Link to="/a-propos" className="block text-muted-foreground hover:text-amber-600 transition-colors">
                À propos de nous
              </Link>
              <Link to="/contact" className="block text-muted-foreground hover:text-amber-600 transition-colors">
                Nous contacter
              </Link>
              <Link to="/faq" className="block text-muted-foreground hover:text-amber-600 transition-colors">
                FAQ
              </Link>
            </div>
          </div>

          {/* Points de Vente Section */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-amber-600" />
              Points de Vente
            </h3>
            <div className="space-y-3 text-sm">
              {storeLocations.length > 0 ? (
                storeLocations.map((point) => (
                  <div key={point.id} className="border-l-2 border-amber-500 pl-3 py-1">
                    <p className="font-medium text-black">{point.name}</p>
                    <p className="text-muted-foreground text-xs">{point.address}</p>
                    <a
                      href={`tel:${point.phone.replace(/\s/g, '')}`}
                      className="text-xs text-muted-foreground hover:text-amber-600 transition-colors"
                    >
                      {point.phone}
                    </a>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-xs italic">
                  Aucun point de vente disponible
                </p>
              )}
            </div>
          </div>

          {/* Contact Section */}
          <div>
            <h3 className="font-semibold mb-4">Contact</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Nous sommes disponibles toute la semaine de 9h à 20h.</p>
              <p className="font-medium text-black">📍Manzil Hurr, Tunisia</p>
              <p>
                <a href="tel:+21697440550" className="hover:text-amber-600 transition-colors">
                  📞 (+216) 97 440 550
                </a>
              </p>
              <p>
                <a href="mailto:folla_couffin@outlook.com" className="hover:text-amber-600 transition-colors">
                  ✉️ folla_couffin@outlook.com
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Social Media & Copyright */}
        <div className="border-t border-border pt-8 mt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <a
                href="https://www.facebook.com/couffintraditionneltunisie"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-amber-600 transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="https://www.instagram.com/folla_couffin/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-amber-600 transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://wa.me/21697440550"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-amber-600 transition-colors"
                aria-label="WhatsApp"
              >
                <FaWhatsapp className="h-5 w-5" />
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()}, FollaCouffin – Artisanat tunisien fait main
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

