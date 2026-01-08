// components/FilterSidebar.tsx
import { useState } from "react";
import { X, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type Panel = "main" | "prix" | "disponibilite" | "promotion";

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  minPrice: number;
}

const FilterSidebar = ({ isOpen, onClose, minPrice }: FilterSidebarProps) => {
  const [activePanel, setActivePanel] = useState<Panel>("main");
  const [minVal, setMinVal] = useState("");
  const [maxVal, setMaxVal] = useState("");

  const goBack = () => setActivePanel("main");

  return (
    <div
      className={`fixed top-0 right-0 h-full w-96 bg-white shadow-lg z-50 transform transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        {activePanel !== "main" ? (
          <button onClick={goBack} className="flex items-center space-x-2">
            <ArrowLeft className="w-5 h-5" />
            <span>Retour</span>
          </button>
        ) : (
          <h2 className="text-lg font-semibold">Filtres</h2>
        )}

        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Panels */}
      <div className="relative h-full overflow-hidden">
        {/* Main Panel */}
        <div
          className={`absolute top-0 left-0 w-full h-full p-4 transition-transform duration-300 ${
            activePanel === "main" ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <button
            onClick={() => setActivePanel("promotion")}
            className="flex justify-between items-center w-full text-left font-medium py-2"
          >
            En promotion <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActivePanel("prix")}
            className="flex justify-between items-center w-full text-left font-medium py-2"
          >
            Prix <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActivePanel("disponibilite")}
            className="flex justify-between items-center w-full text-left font-medium py-2"
          >
            Disponibilité <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Promotion Panel */}
        <div
          className={`absolute top-0 left-0 w-full h-full p-4 transition-transform duration-300 ${
            activePanel === "promotion" ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <label className="flex items-center space-x-2 py-2">
            <input type="checkbox" /> <span>Produits en promotion</span>
          </label>
        </div>

        {/* Prix Panel */}
        <div
          className={`absolute top-0 left-0 w-full h-full p-4 transition-transform duration-300 ${
            activePanel === "prix" ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <p className="text-sm text-gray-600 mb-4">
            Prix minimum dans cette catégorie: <b>{minPrice} DT</b>
          </p>
          <div className="flex items-center gap-2 mb-4">
            <input
              type="number"
              placeholder="Prix min"
              value={minVal}
              onChange={(e) => setMinVal(e.target.value)}
              className="border rounded p-2 w-1/2"
            />
            <input
              type="number"
              placeholder="Prix max"
              value={maxVal}
              onChange={(e) => setMaxVal(e.target.value)}
              className="border rounded p-2 w-1/2"
            />
          </div>
          <Button variant="default" className="w-full">
            Appliquer
          </Button>
        </div>

        {/* Disponibilité Panel */}
        <div
          className={`absolute top-0 left-0 w-full h-full p-4 transition-transform duration-300 ${
            activePanel === "disponibilite"
              ? "translate-x-0"
              : "translate-x-full"
          }`}
        >
          <label className="flex items-center space-x-2 py-2">
            <input type="checkbox" /> <span>En stock</span>
          </label>
          <label className="flex items-center space-x-2 py-2">
            <input type="checkbox" /> <span>Rupture de stock</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default FilterSidebar;
