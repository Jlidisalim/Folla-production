// src/components/LoadingScreen.tsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const logoSrc = "/logo-removebg-preview.png";

type LoadingScreenProps = {
  /** Wait this many ms before showing to avoid flashing on quick loads */
  delay?: number;
};

export default function LoadingScreen({ delay = 400 }: LoadingScreenProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), Math.max(0, delay));
    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) return null;

  return (
    <div
      className="flex items-center justify-center h-screen bg-[#f9f6f1] relative"
      aria-busy="true"
      aria-label="Chargement"
    >
      <motion.img
        src={logoSrc}
        alt="Folla Logo"
        className="w-40 h-40"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
