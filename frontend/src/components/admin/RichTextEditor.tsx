// components/admin/RichTextEditor.tsx
import React, { useRef, useCallback, useEffect, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  List,
  ChevronDown,
} from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const TEXT_SIZES = [
  { label: "Texte normal", value: "p" },
  { label: "Titre 1", value: "h1" },
  { label: "Titre 2", value: "h2" },
  { label: "Titre 3", value: "h3" },
  { label: "Petit", value: "small" },
];

const COLORS = [
  { label: "Noir", value: "#000000" },
  { label: "Gris", value: "#6b7280" },
  { label: "Rouge", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Jaune", value: "#eab308" },
  { label: "Vert", value: "#22c55e" },
  { label: "Bleu", value: "#3b82f6" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Rose", value: "#ec4899" },
];

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "Entrez votre description...",
  className = "",
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [currentSize, setCurrentSize] = useState("p");
  const [currentColor, setCurrentColor] = useState("#000000");

  // Sync external value changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const handleBold = () => execCommand("bold");
  const handleItalic = () => execCommand("italic");
  const handleUnderline = () => execCommand("underline");
  const handleList = () => execCommand("insertUnorderedList");

  const handleSizeChange = (tag: string) => {
    setCurrentSize(tag);
    setShowSizeDropdown(false);
    
    if (tag === "p") {
      execCommand("formatBlock", "p");
    } else if (tag === "small") {
      execCommand("fontSize", "2");
    } else {
      execCommand("formatBlock", tag);
    }
  };

  const handleColorChange = (color: string) => {
    setCurrentColor(color);
    setShowColorDropdown(false);
    execCommand("foreColor", color);
  };

  const getSizeLabel = () => {
    return TEXT_SIZES.find((s) => s.value === currentSize)?.label || "Texte normal";
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".size-dropdown") && !target.closest(".color-dropdown")) {
        setShowSizeDropdown(false);
        setShowColorDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`border border-gray-300 rounded-md overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-300 bg-gray-50">
        {/* Text Size Dropdown */}
        <div className="relative size-dropdown">
          <button
            type="button"
            onClick={() => {
              setShowSizeDropdown(!showSizeDropdown);
              setShowColorDropdown(false);
            }}
            className="flex items-center gap-1 px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 transition min-w-[120px] justify-between"
          >
            <span>{getSizeLabel()}</span>
            <ChevronDown size={14} />
          </button>
          
          {showSizeDropdown && (
            <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200">
              {TEXT_SIZES.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  onClick={() => handleSizeChange(size.value)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition ${
                    currentSize === size.value ? "bg-gray-100 font-medium" : ""
                  }`}
                >
                  {size.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Bold */}
        <button
          type="button"
          onClick={handleBold}
          className="p-1.5 rounded hover:bg-gray-200 transition"
          title="Gras (Ctrl+B)"
        >
          <Bold size={16} />
        </button>

        {/* Italic */}
        <button
          type="button"
          onClick={handleItalic}
          className="p-1.5 rounded hover:bg-gray-200 transition"
          title="Italique (Ctrl+I)"
        >
          <Italic size={16} />
        </button>

        {/* Underline */}
        <button
          type="button"
          onClick={handleUnderline}
          className="p-1.5 rounded hover:bg-gray-200 transition"
          title="Souligné (Ctrl+U)"
        >
          <Underline size={16} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Color Picker */}
        <div className="relative color-dropdown">
          <button
            type="button"
            onClick={() => {
              setShowColorDropdown(!showColorDropdown);
              setShowSizeDropdown(false);
            }}
            className="flex items-center gap-1 p-1.5 rounded hover:bg-gray-200 transition"
            title="Couleur du texte"
          >
            <span className="text-sm font-bold" style={{ color: currentColor }}>A</span>
            <div
              className="w-4 h-1 rounded"
              style={{ backgroundColor: currentColor }}
            />
            <ChevronDown size={12} />
          </button>

          {showColorDropdown && (
            <div className="absolute z-50 mt-1 p-2 bg-white rounded-md shadow-lg border border-gray-200 w-32">
              <div className="grid grid-cols-3 gap-1">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => handleColorChange(color.value)}
                    className={`w-8 h-8 rounded border-2 transition hover:scale-110 ${
                      currentColor === color.value
                        ? "border-blue-500"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* List */}
        <button
          type="button"
          onClick={handleList}
          className="p-1.5 rounded hover:bg-gray-200 transition"
          title="Liste à puces"
        >
          <List size={16} />
        </button>

        {/* Align */}
        <button
          type="button"
          onClick={() => execCommand("justifyLeft")}
          className="p-1.5 rounded hover:bg-gray-200 transition"
          title="Aligner à gauche"
        >
          <AlignLeft size={16} />
        </button>
      </div>

      {/* Editor Content */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="p-3 min-h-[120px] outline-none prose prose-sm max-w-none"
        style={{ minHeight: "120px" }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        [contenteditable] h1 { font-size: 1.5rem; font-weight: bold; margin: 0.5rem 0; }
        [contenteditable] h2 { font-size: 1.25rem; font-weight: bold; margin: 0.5rem 0; }
        [contenteditable] h3 { font-size: 1.1rem; font-weight: bold; margin: 0.5rem 0; }
        [contenteditable] p { margin: 0.25rem 0; }
        [contenteditable] ul { list-style-type: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
        [contenteditable] li { margin: 0.25rem 0; }
      `}</style>
    </div>
  );
};

export default RichTextEditor;
