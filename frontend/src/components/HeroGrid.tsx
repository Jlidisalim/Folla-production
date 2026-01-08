// ============================================================================
// PERFORMANCE: Images served from public folder, not bundled in JS
// Using lazy loading and explicit dimensions to reduce LCP and CLS
// ============================================================================

const HeroGrid = () => {
  const heroBackground = "/background.png"; // served from public/

  // Images now served from public/images/ - NOT bundled in JS
  const heroImages = [
    { id: 1, image: "/images/product-1.jpg", span: "md:col-span-1 md:row-span-2" },
    { id: 2, image: "/images/product-2.jpg", span: "md:col-span-2 md:row-span-1" },
    { id: 3, image: "/images/product-3.jpg", span: "md:col-span-1 md:row-span-1" },
    { id: 4, image: "/images/product-4.jpg", span: "md:col-span-1 md:row-span-1" },
    { id: 5, image: "/images/product-5.jpg", span: "md:col-span-1 md:row-span-1" },
    { id: 6, image: "/images/product-6.jpg", span: "md:col-span-2 md:row-span-1" },
    { id: 7, image: "/images/product-7.jpg", span: "md:col-span-1 md:row-span-1" },
    { id: 8, image: "/images/product-8.jpg", span: "md:col-span-1 md:row-span-1" },
  ];

  return (
    <section
      className="relative py-8 px-4"
      style={{
        backgroundImage: `url(${heroBackground})`,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
    >
      {/* Background opacity overlay with shadow effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "rgba(255, 255, 255, 0.15)",
          boxShadow: "inset 0 0 100px rgba(0, 0, 0, 0.1), inset 0 0 50px rgba(0, 0, 0, 0.05)",
        }}
      />

      <div className="relative max-w-7xl mx-auto">
        {/* Main grid with featured tagline */}
        <div className="relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[200px] md:auto-rows-[180px]">
            {heroImages.map((item, index) => (
              <div
                key={item.id}
                className={`relative overflow-hidden rounded-2xl group cursor-pointer ${item.span}`}
                style={{
                  boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1)",
                }}
              >
                <img
                  src={item.image}
                  alt={`Produit artisanal ${item.id}`}
                  className="w-full h-full object-cover transition-all duration-500 ease-out group-hover:scale-110 group-hover:brightness-105"
                  // PERFORMANCE: Lazy load all except first visible image
                  loading={index < 2 ? "eager" : "lazy"}
                  decoding="async"
                  // PERFORMANCE: Explicit sizing for CLS reduction
                  width={400}
                  height={index === 0 ? 360 : 180}
                />

                {/* Elegant amber ring highlight on hover */}
                <div
                  className="absolute inset-0 rounded-2xl ring-2 ring-transparent group-hover:ring-amber-400/60 transition-all duration-500 pointer-events-none"
                />

                {/* Subtle gradient overlay for added sophistication */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              </div>
            ))}
          </div>

          {/* Centered tagline overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-background/90 backdrop-blur-md px-8 py-6 rounded-lg shadow-2xl text-center max-w-md mx-4" style={{ boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 12px 24px -8px rgba(0, 0, 0, 0.25)" }}>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">
                C'est <span className="text-secondary">mieux</span>, quand c'est{" "}
                <span className="text-secondary">fait à la main</span> !
              </h1>
              <p className="text-muted-foreground text-sm">
                Découvrez notre collection d'objets artisanaux uniques
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroGrid;
