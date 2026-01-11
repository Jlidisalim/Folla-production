/* eslint-disable prefer-const */
/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* src/pages/admin/EditProduct.tsx */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X, Plus, Check, Image as ImageIcon } from "lucide-react";
import api, { useAuthenticatedApi } from "@/lib/api";
import { useNotifications } from "@/components/NotificationProvider";
import RichTextEditor from "@/components/admin/RichTextEditor";

/**
 * EditProduct aligné avec AddProduct UI :
 * - Variants
 * - Combinations en cartes
 * - Prix & stock par combinaison
 * - Sélecteur d'images depuis la galerie produit
 * - Support images distantes + fichiers locaux
 * - Vente Flash identique à AddProduct
 */

interface CategoryItem {
  name: string;
  path?: string;
  subItems?: string[];
}

const fallbackCategories: CategoryItem[] = [
  { name: "Nouveautés", path: "/category/nouveautes", subItems: [] },
];

interface GalleryItem {
  id: string;
  file?: File;
  preview: string;
  remote?: boolean;
  url?: string;
}

interface Variant {
  id: string;
  type: string;
  values: string[];
}

interface Combination {
  id: string;
  options: Record<string, string>; // variantKey -> value
  pricePiece: string;
  priceQuantity: string;
  hasCustomPrice: boolean;
  stock: string;
  imageIds: string[]; // gallery item ids
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const getVariantKey = (v: Variant, index: number) =>
  (v.id || v.type || `variant_${index}`).trim();

const createEmptyCombination = (variants: Variant[]): Combination => ({
  id: uid(),
  options: Object.fromEntries(
    variants.map((v, i) => [getVariantKey(v, i), ""])
  ),
  pricePiece: "",
  priceQuantity: "",
  hasCustomPrice: true,
  stock: "",
  imageIds: [],
});

const normalizeCombination = (
  combo: Combination,
  variants: Variant[]
): Combination => {
  const next: Record<string, string> = {};
  variants.forEach((v, i) => {
    const key = getVariantKey(v, i);
    const current = combo.options?.[key] ?? "";
    next[key] = v.values.includes(current) ? current : "";
  });

  const hasCustom =
    combo.hasCustomPrice ||
    (combo.pricePiece ?? "").toString().length > 0 ||
    (combo.priceQuantity ?? "").toString().length > 0;

  return {
    ...combo,
    options: next,
    imageIds: Array.isArray(combo.imageIds) ? combo.imageIds : [],
    pricePiece: combo.pricePiece ?? "",
    priceQuantity: combo.priceQuantity ?? "",
    hasCustomPrice: !!hasCustom,
  };
};

function ImagePicker({
  combo,
  gallery,
  onChange,
  onClose,
}: {
  combo: Combination;
  gallery: GalleryItem[];
  onChange: (next: Combination) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  const toggle = (id: string) => {
    const set = new Set(combo.imageIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ ...combo, imageIds: Array.from(set) });
  };

  return (
    <div
      ref={panelRef}
      className="absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">Galerie du produit</div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
          title="Fermer"
        >
          <X size={16} />
        </button>
      </div>

      {gallery.length === 0 ? (
        <div className="text-xs text-gray-500 py-3">
          Aucune image/vidéo ajoutée.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-auto">
          {gallery.map((g) => {
            const selected = combo.imageIds.includes(g.id);
            const isVideo = g.file?.type?.startsWith("video/") ?? false;

            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggle(g.id)}
                className={`relative rounded-lg overflow-hidden border ${selected ? "border-blue-500" : "border-gray-200"
                  } hover:shadow-sm transition`}
                title={g.file?.name || g.url || "media"}
              >
                <div className="aspect-square bg-gray-50">
                  {isVideo ? (
                    <video
                      src={g.preview}
                      className="w-full h-full object-cover"
                      muted
                    />
                  ) : (
                    <img
                      src={g.preview}
                      alt="media"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                {selected && (
                  <span className="absolute top-1 right-1 bg-blue-600 text-white rounded-full p-1">
                    <Check size={12} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EditProduct() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notify } = useNotifications();
  const { authApi } = useAuthenticatedApi();

  const [form, setForm] = useState({
    title: "",
    productId: "",
    category: "",
    subCategory: "",
    status: "Active",
    description: "",
    pricePiece: "",
    priceQuantity: "",
    saleType: "piece",

    // Vente Flash
    venteFlashActive: false,
    venteFlashPercentage: "",
    flashDiscountType: "percent" as "percent" | "fixed",
    flashDiscountValue: "",
    flashApplyTarget: "product" as "product" | "combinations",
    flashApplyAllCombinations: true,
    flashCombinationIds: [] as string[],
    flashStartAt: "",
    flashEndAt: "",

    availableQuantity: "",
    minStockAlert: "",
    shippingWeight: "",
    dimensions: "",
    visible: true,
    publishAt: "",
    // Minimum order quantity fields
    minOrderQtyRetail: "1",
    minOrderQtyWholesale: "1",
    tags: [] as string[],
    variants: [] as Variant[],
    inStock: true,
    isNovelty: false,
  });

  const [valueInputs, setValueInputs] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [combinations, setCombinations] = useState<Combination[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [categories, setCategories] =
    useState<CategoryItem[]>(fallbackCategories);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [addingCategory, setAddingCategory] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newSubCategory, setNewSubCategory] = useState("");

  const [catOpen, setCatOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);

  const [openVariantIndex, setOpenVariantIndex] = useState<number | null>(null);
  const [addingVariantTypeFor, setAddingVariantTypeFor] = useState<
    number | null
  >(null);
  const [newVariantType, setNewVariantType] = useState("");
  const [variantTypeOptions, setVariantTypeOptions] = useState([
    "Color",
    "Size",
    "Other",
  ]);
  const [variantTypeSearch, setVariantTypeSearch] = useState<
    Record<number, string>
  >({});

  const [openImagePicker, setOpenImagePicker] = useState<string | null>(null);

  const catRef = useRef<HTMLDivElement | null>(null);
  const subRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const saleRef = useRef<HTMLDivElement | null>(null);
  const variantRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  function slugify(text: string) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, "-");
  }

  function getApiBase() {
    try {
      const base = (api as any).defaults?.baseURL;
      if (base) return String(base).replace(/\/$/, "");
    } catch { }
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  function normalizeImageUrl(src?: string | null) {
    if (!src) return "/placeholder.png";
    const s = String(src).trim();
    if (!s) return "/placeholder.png";
    if (/^https?:\/\//i.test(s) || /^\/\//.test(s)) return s;

    const apiBase = getApiBase();

    if (s.startsWith("/uploads/")) return `${apiBase}/products${s}`;
    if (s.startsWith("/products/uploads/")) return `${apiBase}${s}`;
    if (s.startsWith("uploads/")) return `${apiBase}/products/${s}`;
    if (s.startsWith("products/uploads/")) return `${apiBase}/${s}`;

    return `${apiBase}/products/uploads/${s.replace(/^\/+/, "")}`;
  }

  function formatDateForInput(val?: string | null) {
    if (!val) return "";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const STATUS_OPTIONS = ["Active", "Inactive"] as const;
  const SALE_OPTIONS = ["piece", "quantity", "both"] as const;

  const saleTypeLabel = (s: string) => {
    if (s === "piece") return "Par pièce";
    if (s === "quantity") return "Par quantité";
    return "Pièce + quantité";
  };

  const variantTypeLabel = (t: string) => {
    if (t === "Color") return "Couleur";
    if (t === "Size") return "Taille";
    if (t === "Other") return "Autre";
    return t;
  };

  const DropItem = ({
    children,
    onClick,
    active = false,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    active?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-sm ${active ? "bg-gray-100" : ""
        }`}
    >
      {children}
    </button>
  );

  // ---------- prix helpers ----------
  const flashBasePrice = useMemo(() => {
    const piece = Number(form.pricePiece);
    const quantity = Number(form.priceQuantity);

    const normalizedPiece = !Number.isNaN(piece) && piece > 0 ? piece : null;
    const normalizedQty =
      !Number.isNaN(quantity) && quantity > 0 ? quantity : null;

    const mode = (form.saleType || "").toLowerCase();

    if (mode === "quantity") return normalizedQty ?? normalizedPiece;
    if (mode === "piece") return normalizedPiece ?? normalizedQty;
    return normalizedPiece ?? normalizedQty;
  }, [form.pricePiece, form.priceQuantity, form.saleType]);

  const venteFlashPreview = useMemo(() => {
    if (!form.venteFlashActive) return null;
    if (flashBasePrice === null) return null;

    if (form.flashDiscountType === "fixed") {
      const fixed = Number(form.flashDiscountValue);
      if (Number.isNaN(fixed) || fixed <= 0) return null;
      const computed = flashBasePrice - fixed;
      if (!Number.isFinite(computed)) return null;
      return Number(Math.max(0, computed).toFixed(2));
    }

    const pct = Number(form.venteFlashPercentage);
    if (Number.isNaN(pct) || pct <= 0) return null;
    const computed = flashBasePrice - (flashBasePrice * pct) / 100;
    if (!Number.isFinite(computed)) return null;
    return Number(Math.max(0, computed).toFixed(2));
  }, [
    form.venteFlashActive,
    form.flashDiscountType,
    form.flashDiscountValue,
    form.venteFlashPercentage,
    flashBasePrice,
  ]);

  const pieceVal = Number(form.pricePiece);
  const qtyVal = Number(form.priceQuantity);
  const hasPiecePrice = Number.isFinite(pieceVal) && pieceVal > 0;
  const hasQtyPrice = Number.isFinite(qtyVal) && qtyVal > 0;

  const usesCombinationPricing = combinations.length > 0;
  const pricingError =
    !usesCombinationPricing && !hasPiecePrice && !hasQtyPrice;

  const disableBasePricing = usesCombinationPricing;
  const disableBaseStock = usesCombinationPricing;

  const formatCurrency = (value?: number | null) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "Non défini";
    }
    try {
      return new Intl.NumberFormat("fr-TN", {
        style: "currency",
        currency: "TND",
      }).format(value);
    } catch {
      return `${Number(value).toFixed(2)} DT`;
    }
  };

  // ---------- categories ----------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingCategories(true);
        const res = await api.get("/products");
        const raw = Array.isArray(res.data) ? res.data : [];
        const map = new Map<string, Set<string>>();

        for (const p of raw) {
          const c = String(p.category ?? "Sans catégorie").trim();
          const s = String(p.subCategory ?? "").trim();
          if (!map.has(c)) map.set(c, new Set<string>());
          if (s) map.get(c)!.add(s);
        }

        let derived = Array.from(map.entries()).map(([name, subs]) => ({
          name,
          path: `/category/${slugify(name)}`,
          subItems: Array.from(subs).filter(Boolean),
        }));

        const nouveIndex = derived.findIndex((d) => d.name === "Nouveautés");
        if (nouveIndex === -1)
          derived.unshift({
            name: "Nouveautés",
            path: "/category/nouveautes",
            subItems: [],
          });
        else if (nouveIndex > 0) {
          const [n] = derived.splice(nouveIndex, 1);
          derived.unshift(n);
        }

        if (mounted)
          setCategories(derived.length ? derived : fallbackCategories);
      } catch {
        if (mounted) setCategories(fallbackCategories);
      } finally {
        if (mounted) setLoadingCategories(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // ---------- close dropdowns on outside click ----------
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node))
        setCatOpen(false);
      if (subRef.current && !subRef.current.contains(e.target as Node))
        setSubOpen(false);
      if (statusRef.current && !statusRef.current.contains(e.target as Node))
        setStatusOpen(false);
      if (saleRef.current && !saleRef.current.contains(e.target as Node))
        setSaleOpen(false);

      variantRefs.current.forEach((el, idx) => {
        if (el && !el.contains(e.target as Node)) {
          if (openVariantIndex === idx) {
            setOpenVariantIndex(null);
            setVariantTypeSearch((prev) => ({ ...prev, [idx]: "" }));
          }
        }
      });
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openVariantIndex]);

  // ---------- sync combinations with variants ----------
  useEffect(() => {
    setCombinations((prev) =>
      prev.map((c) => normalizeCombination(c, form.variants))
    );
  }, [form.variants]);

  // ---------- cleanup blobs ----------
  useEffect(() => {
    return () => {
      gallery.forEach((g) => {
        if (g.file && g.preview.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(g.preview);
          } catch { }
        }
      });
    };
  }, [gallery]);

  // ---------- load product ----------
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const res = await api.get(`/products/${id}`);
        const p = res.data ?? {};

        const loadedVariants: Variant[] = Array.isArray(p.variants)
          ? p.variants.map((v: any) => ({
            id: v.id ?? uid(),
            type: v.type ?? "",
            values: Array.isArray(v.values) ? v.values : [],
          }))
          : [];

        const productImageUrls = Array.isArray(p.images) ? p.images : [];
        const comboImageUrls: string[] = Array.isArray(p.combinations)
          ? p.combinations
            .flatMap((c: any) => (Array.isArray(c.images) ? c.images : []))
            .filter(Boolean)
          : [];

        const allRemote = Array.from(
          new Set<string>([...productImageUrls, ...comboImageUrls])
        );

        const remoteGallery: GalleryItem[] = allRemote.map((url, i) => ({
          id: `remote-${i}-${uid()}`,
          remote: true,
          url,
          preview: normalizeImageUrl(url),
        }));

        if (!mounted) return;

        setForm({
          title: p.title ?? "",
          productId: p.productId ?? "",
          category: p.category ?? "",
          subCategory: p.subCategory ?? "",
          status: p.status ?? "Active",
          description: p.description ?? "",
          pricePiece: p.pricePiece?.toString() ?? "",
          priceQuantity: p.priceQuantity?.toString() ?? "",
          saleType: p.saleType ?? "piece",

          venteFlashActive: !!p.venteFlashActive,
          venteFlashPercentage: p.venteFlashPercentage?.toString() ?? "",
          flashDiscountType:
            (p.flashDiscountType as any) === "fixed" ? "fixed" : "percent",
          flashDiscountValue: p.flashDiscountValue?.toString() ?? "",
          flashApplyTarget:
            (p.flashApplyTarget as any) === "combinations"
              ? "combinations"
              : "product",
          flashApplyAllCombinations: p.flashApplyAllCombinations ?? true,
          flashCombinationIds: Array.isArray(p.flashCombinationIds)
            ? p.flashCombinationIds.map((x: any) => String(x))
            : [],
          flashStartAt: p.flashStartAt ? String(p.flashStartAt) : "",
          flashEndAt: p.flashEndAt ? String(p.flashEndAt) : "",

          availableQuantity: p.availableQuantity?.toString() ?? "",
          minStockAlert: p.minStockAlert?.toString() ?? "",
          shippingWeight: p.shippingWeight ?? "",
          dimensions: p.dimensions ?? "",
          visible: p.visible !== false,
          publishAt: p.publishAt ? formatDateForInput(p.publishAt) : "",
          // Load minQty fields from product
          minOrderQtyRetail: (p.minOrderQtyRetail ?? 1).toString(),
          minOrderQtyWholesale: (p.minOrderQtyWholesale ?? 1).toString(),
          tags: Array.isArray(p.tags) ? p.tags : [],
          variants: loadedVariants,
          inStock: !!p.inStock,
          isNovelty: p.category === "Nouveautés",
        });

        setValueInputs(loadedVariants.map(() => ""));
        setGallery(remoteGallery);

        // load combinations
        let loadedCombos: Combination[] = [];

        if (Array.isArray(p.combinations) && p.combinations.length) {
          loadedCombos = p.combinations.map((c: any) => {
            const options =
              c.options && typeof c.options === "object" ? c.options : {};

            const imageIds =
              Array.isArray(c.images) && c.images.length
                ? (c.images
                  .map((u: string) => {
                    const found = remoteGallery.find((g) => g.url === u);
                    return found?.id;
                  })
                  .filter(Boolean) as string[])
                : [];

            const pricePieceRaw =
              c.pricePiece !== undefined && c.pricePiece !== null
                ? c.pricePiece
                : c.price ?? null;
            const priceQuantityRaw =
              c.priceQuantity !== undefined && c.priceQuantity !== null
                ? c.priceQuantity
                : null;

            const hasCustom =
              pricePieceRaw !== null && pricePieceRaw !== undefined
                ? true
                : priceQuantityRaw !== null && priceQuantityRaw !== undefined;

            return {
              id: uid(),
              options,
              pricePiece:
                pricePieceRaw !== undefined && pricePieceRaw !== null
                  ? String(pricePieceRaw)
                  : "",
              priceQuantity:
                priceQuantityRaw !== undefined && priceQuantityRaw !== null
                  ? String(priceQuantityRaw)
                  : "",
              hasCustomPrice: !!hasCustom,
              stock:
                c.stock !== undefined && c.stock !== null
                  ? String(c.stock)
                  : "",
              imageIds,
            };
          });
        }

        loadedCombos = loadedCombos.map((c) =>
          normalizeCombination(c, loadedVariants)
        );

        setCombinations(loadedCombos);

        // ensure category exists locally
        if (p.category) {
          setCategories((prev) => {
            const exists = prev.some(
              (c) => c.name.toLowerCase() === String(p.category).toLowerCase()
            );
            if (exists) return prev;
            return [
              {
                name: p.category,
                path: `/category/${slugify(p.category)}`,
                subItems: p.subCategory ? [p.subCategory] : [],
              },
              ...prev,
            ];
          });
        }
      } catch (err) {
        notify({
          title: "Échec du chargement",
          message: "Impossible de charger les détails du produit.",
          type: "error",
          duration: 6000,
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, notify]);

  // ---------- validation ----------
  const validate = () => {
    const e: Record<string, string> = {};

    if (!form.title.trim()) e.title = "Le titre est obligatoire";
    if (!form.description.trim())
      e.description = "La description est obligatoire";
    if (!form.category.trim()) e.category = "La catégorie est obligatoire";
    if (gallery.length === 0) e.media = "Ajoutez au moins une image/vidéo";

    const piece = Number(form.pricePiece);
    const quantity = Number(form.priceQuantity);
    const hasPiece = !Number.isNaN(piece) && piece > 0;
    const hasQuantity = !Number.isNaN(quantity) && quantity > 0;

    if (!combinations.length && !hasPiece && !hasQuantity) {
      e.pricePiece = "Ajoutez au moins un prix";
    }

    if (form.venteFlashActive) {
      if (
        form.flashApplyTarget === "combinations" &&
        !form.flashApplyAllCombinations &&
        (!form.flashCombinationIds || form.flashCombinationIds.length === 0)
      ) {
        e.flashCombinationIds = "Sélectionnez au moins une combinaison";
      }

      if (form.flashDiscountType === "fixed") {
        const fixed = Number(form.flashDiscountValue);
        if (!form.flashDiscountValue.trim()) {
          e.flashDiscountValue = "Indiquez une remise fixe";
        } else if (!Number.isFinite(fixed) || fixed <= 0) {
          e.flashDiscountValue = "La remise doit être positive";
        }
      } else {
        const pct = Number(form.venteFlashPercentage);
        if (!form.venteFlashPercentage.trim()) {
          e.venteFlashPercentage = "Indiquez un pourcentage";
        } else if (Number.isNaN(pct) || pct <= 0) {
          e.venteFlashPercentage = "Le pourcentage doit être supérieur à 0";
        }
      }

      if (!combinations.length && !hasPiece && !hasQuantity) {
        e.venteFlashPercentage =
          "Ajoutez un prix de base avant d'activer la vente flash";
      }
    }

    return e;
  };

  // ---------- tags ----------
  const addTag = () => {
    const val = tagInput.trim();
    if (!val) return;
    setForm((p) => ({ ...p, tags: [...p.tags, val] }));
    setTagInput("");
  };

  const removeTag = (idx: number) =>
    setForm((p) => ({ ...p, tags: p.tags.filter((_, i) => i !== idx) }));

  // ---------- variants ----------
  const addVariant = () => {
    setForm((p) => ({
      ...p,
      variants: [...p.variants, { id: uid(), type: "", values: [] }],
    }));
    setValueInputs((v) => [...v, ""]);
    setAddingVariantTypeFor(null);
    setNewVariantType("");
  };

  const removeVariant = (idx: number) => {
    setForm((p) => ({
      ...p,
      variants: p.variants.filter((_, i) => i !== idx),
    }));
    setValueInputs((v) => v.filter((_, i) => i !== idx));

    if (addingVariantTypeFor === idx) {
      setAddingVariantTypeFor(null);
      setNewVariantType("");
    }

    setVariantTypeSearch((prev) => {
      const copy = { ...prev };
      delete copy[idx];
      return copy;
    });
  };

  const addValue = (idx: number) => {
    const val = valueInputs[idx]?.trim();
    if (!val) return;
    const copy = [...form.variants];
    copy[idx].values.push(val);
    setForm((p) => ({ ...p, variants: copy }));

    const next = [...valueInputs];
    next[idx] = "";
    setValueInputs(next);
  };

  const removeValue = (varIdx: number, valIdx: number) => {
    const copy = [...form.variants];
    copy[varIdx].values = copy[varIdx].values.filter((_, i) => i !== valIdx);
    setForm((p) => ({ ...p, variants: copy }));
  };

  const saveVariantType = (idx: number) => {
    const val = newVariantType.trim();
    if (!val) {
      setAddingVariantTypeFor(null);
      setNewVariantType("");
      return;
    }

    setVariantTypeOptions((prev) => {
      const exists = prev.some((t) => t.toLowerCase() === val.toLowerCase());
      return exists ? prev : [...prev, val];
    });

    setForm((p) => {
      const next = [...p.variants];
      if (next[idx]) next[idx].type = val;
      return { ...p, variants: next };
    });

    setAddingVariantTypeFor(null);
    setNewVariantType("");
  };

  const onVariantTypeKey = (
    e: KeyboardEvent<HTMLInputElement>,
    idx: number
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveVariantType(idx);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setAddingVariantTypeFor(null);
      setNewVariantType("");
    }
  };

  // ---------- gallery ----------
  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);

    const newItems: GalleryItem[] = selected.map((f) => ({
      id: uid(),
      file: f,
      preview: URL.createObjectURL(f),
      remote: false,
    }));

    setGallery((p) => [...p, ...newItems]);
  };

  const handleRemoveMedia = (idx: number) => {
    const item = gallery[idx];
    if (item?.file && item.preview.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(item.preview);
      } catch { }
    }
    setGallery((p) => p.filter((_, i) => i !== idx));
  };

  // keep combo images valid when gallery changes
  useEffect(() => {
    const ids = new Set(gallery.map((g) => g.id));
    setCombinations((prev) =>
      prev.map((c) => ({
        ...c,
        imageIds: c.imageIds.filter((id) => ids.has(id)),
      }))
    );
  }, [gallery]);

  // ---------- category local add ----------
  const acceptNewCategory = () => {
    const v = newCategory.trim();
    if (!v) {
      setAddingCategory(false);
      setNewCategory("");
      return;
    }

    if (!categories.some((c) => c.name.toLowerCase() === v.toLowerCase())) {
      setCategories((p) => [
        { name: v, path: `/category/${slugify(v)}`, subItems: [] },
        ...p,
      ]);
    }

    setForm((p) => ({ ...p, category: v, subCategory: "" }));
    setAddingCategory(false);
    setNewCategory("");
  };

  const acceptNewSubcategory = () => {
    const v = newSubCategory.trim();
    if (!v) {
      setAddingSub(false);
      setNewSubCategory("");
      return;
    }

    setCategories((prev) =>
      prev.map((c) =>
        c.name === form.category
          ? { ...c, subItems: Array.from(new Set([...(c.subItems || []), v])) }
          : c
      )
    );

    setForm((p) => ({ ...p, subCategory: v }));
    setAddingSub(false);
    setNewSubCategory("");
  };

  const onCategoryKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") acceptNewCategory();
    if (e.key === "Escape") {
      setAddingCategory(false);
      setNewCategory("");
    }
  };

  const onSubKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") acceptNewSubcategory();
    if (e.key === "Escape") {
      setAddingSub(false);
      setNewSubCategory("");
    }
  };

  const currentSubItems = useMemo(
    () => categories.find((c) => c.name === form.category)?.subItems ?? [],
    [categories, form.category]
  );

  // ---------- combinations ----------
  const addCombination = () =>
    setCombinations((prev) => [...prev, createEmptyCombination(form.variants)]);

  const removeCombination = (comboId: string) =>
    setCombinations((prev) => prev.filter((c) => c.id !== comboId));

  // ---------- upload ----------
  const uploadNewMedia = async (): Promise<{
    urls: string[];
    idToUrl: Map<string, string>;
  }> => {
    const locals = gallery.filter((g) => g.file) as GalleryItem[];
    if (!locals.length) return { urls: [], idToUrl: new Map() };

    const authenticatedApi = await authApi();
    if (!authenticatedApi) {
      throw new Error("Not authenticated - please sign in again");
    }

    const fd = new FormData();
    locals.forEach((g) => g.file && fd.append("files", g.file));

    const res = await authenticatedApi.post("/products/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const urls: string[] = res.data?.urls ?? [];
    const idToUrl = new Map<string, string>();
    locals.forEach((g, i) => {
      if (urls[i]) idToUrl.set(g.id, urls[i]);
    });

    return { urls, idToUrl };
  };

  // ---------- submit ----------
  const updateProduct = async (forcePublish = false) => {
    const newErr = validate();
    if (Object.keys(newErr).length) {
      setErrors(newErr);
      window.scrollTo({ top: 0, behavior: "smooth" });
      notify({
        title: "Corrigez le formulaire",
        message: "Veuillez corriger les champs en erreur.",
        type: "error",
        duration: 4000,
      });
      return;
    }

    try {
      setSubmitting(true);

      const { urls: uploadedUrls, idToUrl } = await uploadNewMedia();

      const existingRemoteUrls = gallery
        .filter((g) => g.remote && g.url)
        .map((g) => g.url as string);

      const finalImages = [...existingRemoteUrls, ...uploadedUrls];

      const combinationsPayload =
        combinations.length > 0
          ? combinations.map((c) => {
            const pp = Number(c.pricePiece);
            const pq = Number(c.priceQuantity);

            const pricePiece =
              c.pricePiece !== "" && Number.isFinite(pp)
                ? Math.max(0, pp)
                : null;
            const priceQuantity =
              c.priceQuantity !== "" && Number.isFinite(pq)
                ? Math.max(0, pq)
                : null;

            return {
              options: c.options,
              pricePiece,
              priceQuantity,
              stock: Number.isFinite(Number(c.stock))
                ? Number(c.stock)
                : null,
              images: c.imageIds
                .map((imgId) => {
                  const item = gallery.find((g) => g.id === imgId);
                  if (!item) return undefined;
                  if (item.remote && item.url) return item.url;
                  if (idToUrl.has(imgId)) return idToUrl.get(imgId);
                  return undefined;
                })
                .filter(Boolean),
            };
          })
          : [];

      // Get authenticated API for the patch call
      const authenticatedApi = await authApi();
      if (!authenticatedApi) {
        throw new Error("Not authenticated - please sign in again");
      }

      await authenticatedApi.patch(`/products/${id}`, {
        title: form.title.trim(),
        productId: form.productId.trim(),
        category: form.category.trim(),
        subCategory: form.subCategory.trim(),
        status: form.status,
        description: form.description.trim(),

        pricePiece: disableBasePricing
          ? null
          : form.pricePiece
            ? Number(form.pricePiece)
            : null,
        priceQuantity: disableBasePricing
          ? null
          : form.priceQuantity
            ? Number(form.priceQuantity)
            : null,
        saleType: form.saleType,

        // Vente Flash
        venteFlashActive: form.venteFlashActive,
        venteFlashPercentage:
          form.venteFlashActive && form.flashDiscountType === "percent"
            ? Number(form.venteFlashPercentage)
            : null,
        flashDiscountType: form.flashDiscountType,
        flashDiscountValue:
          form.venteFlashActive && form.flashDiscountType === "fixed"
            ? Number(form.flashDiscountValue)
            : null,
        flashApplyTarget: form.flashApplyTarget,
        flashApplyAllCombinations: form.flashApplyAllCombinations,
        flashCombinationIds: form.flashApplyAllCombinations
          ? []
          : form.flashCombinationIds,
        flashStartAt: form.flashStartAt || null,
        flashEndAt: form.flashEndAt || null,

        availableQuantity: disableBaseStock
          ? null
          : form.availableQuantity
            ? Number(form.availableQuantity)
            : 0,
        minStockAlert: form.minStockAlert ? Number(form.minStockAlert) : 0,

        shippingWeight: form.shippingWeight.trim(),
        dimensions: form.dimensions.trim(),

        visible: forcePublish ? true : form.visible,
        publishAt: form.publishAt || null,

        tags: form.tags,
        variants: form.variants,
        combinations: combinationsPayload,
        images: finalImages,

        // Minimum order quantities
        minOrderQtyRetail: Math.max(1, Number(form.minOrderQtyRetail) || 1),
        minOrderQtyWholesale: Math.max(1, Number(form.minOrderQtyWholesale) || 1),

        inStock: disableBaseStock ? true : Number(form.availableQuantity) > 0,
        isNovelty: form.category === "Nouveautés",
      });

      // update local categories cache
      const usedCategory = form.category.trim();
      const usedSub = form.subCategory.trim();

      if (usedCategory) {
        setCategories((prev) => {
          const idx = prev.findIndex(
            (c) => c.name.toLowerCase() === usedCategory.toLowerCase()
          );
          if (idx === -1) {
            return [
              {
                name: usedCategory,
                path: `/category/${slugify(usedCategory)}`,
                subItems: usedSub ? [usedSub] : [],
              },
              ...prev,
            ];
          }
          const copy = [...prev];
          const subs = new Set(copy[idx].subItems ?? []);
          if (usedSub) subs.add(usedSub);
          copy[idx] = { ...copy[idx], subItems: Array.from(subs) };
          return copy;
        });
      }

      notify({
        title: "Produit mis à jour",
        message: "Modifications enregistrées avec succès !",
        type: "success",
        duration: 3500,
      });

      navigate("/admin/products");
    } catch (err) {
      console.error("Failed to update product", err);
      notify({
        title: "Échec de la mise à jour",
        message: "Erreur lors de l'enregistrement. Vérifiez la console.",
        type: "error",
        duration: 6000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- render loading ----------
  if (loading) {
    return (
      <div className="p-6 text-gray-600 flex items-center gap-2">
        <span className="h-4 w-4 rounded-full border-2 border-b-transparent border-gray-900 animate-spin" />
        Chargement du produit...
      </div>
    );
  }

  // ---------- JSX ----------
  return (
    <div className="max-w-6xl mx-auto bg-white p-8 rounded-lg shadow-md my-6">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate("/admin/products")}
          className="text-gray-600 hover:text-gray-800 text-sm"
        >
          &lt; Retour à l'inventaire
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => updateProduct(true)}
            disabled={submitting}
            className="bg-blue-700 text-white px-8 py-2 rounded-md text-base disabled:opacity-50"
          >
            Publier
          </button>
        </div>
      </div>

      <h1 className="text-3xl font-bold mb-8">Modifier le produit</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* ================= LEFT COLUMN ================= */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Informations du produit
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du produit
              </label>
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title: e.target.value }))
                }
                className="border border-gray-300 p-2 w-full rounded-md"
              />
              {errors.title && (
                <p className="text-red-500 text-sm mt-1">{errors.title}</p>
              )}
            </div>

            {/* Category */}
            <div ref={catRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catégorie
              </label>

              {addingCategory ? (
                <input
                  autoFocus
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={onCategoryKey}
                  placeholder="Nouvelle catégorie (Entrée pour valider)"
                  className="w-full border border-gray-300 p-2 rounded-md"
                />
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setCatOpen((s) => !s);
                      setSubOpen(false);
                    }}
                    className="w-full text-left border border-gray-300 p-2 rounded-md flex items-center justify-between gap-3 hover:shadow-sm transition"
                  >
                    <span className="truncate">
                      {form.category ||
                        (loadingCategories
                          ? "Chargement..."
                          : "Sélectionner une catégorie")}
                    </span>
                    <span className="text-xs text-gray-500">▾</span>
                  </button>

                  <div
                    className={`absolute z-30 mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden transform origin-top transition-all ${catOpen
                      ? "opacity-100 scale-100"
                      : "opacity-0 scale-95 pointer-events-none"
                      }`}
                  >
                    <div className="p-2 max-h-64 overflow-auto">
                      <DropItem
                        onClick={() => {
                          setAddingCategory(true);
                          setCatOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Plus size={14} />
                          <span className="text-sm font-medium">
                            Ajouter une catégorie
                          </span>
                        </div>
                      </DropItem>

                      <div className="border-t my-2" />

                      {loadingCategories ? (
                        <div className="p-2 text-sm text-gray-500">
                          Chargement...
                        </div>
                      ) : categories.length === 0 ? (
                        <div className="p-2 text-sm text-gray-500">
                          Aucune catégorie
                        </div>
                      ) : (
                        categories.map((c) => (
                          <DropItem
                            key={c.name}
                            onClick={() => {
                              setForm((p) => ({
                                ...p,
                                category: c.name,
                                subCategory: "",
                              }));
                              setCatOpen(false);
                            }}
                            active={form.category === c.name}
                          >
                            <div className="font-medium text-sm">{c.name}</div>
                            {c.subItems && c.subItems.length > 0 && (
                              <div className="text-xs text-gray-500">
                                {c.subItems.slice(0, 3).join(", ")}
                                {c.subItems.length > 3 ? "…" : ""}
                              </div>
                            )}
                          </DropItem>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {errors.category && (
                <p className="text-red-500 text-sm mt-1">{errors.category}</p>
              )}
            </div>

            {/* SubCategory */}
            <div ref={subRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sous-catégorie
              </label>

              {!form.category ? (
                <div className="border border-gray-200 p-2 rounded-md text-sm text-gray-400">
                  Sélectionnez d'abord une catégorie
                </div>
              ) : addingSub ? (
                <input
                  autoFocus
                  value={newSubCategory}
                  onChange={(e) => setNewSubCategory(e.target.value)}
                  onKeyDown={onSubKey}
                  placeholder="Nouvelle sous-catégorie (Entrée pour valider)"
                  className="w-full border border-gray-300 p-2 rounded-md"
                />
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setSubOpen((s) => !s);
                      setCatOpen(false);
                    }}
                    className="w-full text-left border border-gray-300 p-2 rounded-md flex items-center justify-between gap-3 hover:shadow-sm transition"
                  >
                    <span className="truncate">
                      {form.subCategory || "Sélectionner"}
                    </span>
                    <span className="text-xs text-gray-500">▾</span>
                  </button>

                  <div
                    className={`absolute z-30 mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden transform origin-top transition-all ${subOpen
                      ? "opacity-100 scale-100"
                      : "opacity-0 scale-95 pointer-events-none"
                      }`}
                  >
                    <div className="p-2 max-h-56 overflow-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setAddingSub(true);
                          setSubOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition flex items-center gap-2 text-sm font-semibold"
                      >
                        <Plus size={14} />
                        <span>Ajouter une sous-catégorie</span>
                      </button>

                      <div className="border-t my-2" />

                      {(currentSubItems || []).length === 0 ? (
                        <div className="p-2 text-sm text-gray-500">
                          Aucune sous-catégorie
                        </div>
                      ) : (
                        currentSubItems.map((s) => (
                          <DropItem
                            key={s}
                            onClick={() => {
                              setForm((p) => ({ ...p, subCategory: s }));
                              setSubOpen(false);
                            }}
                            active={form.subCategory === s}
                          >
                            {s}
                          </DropItem>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Status */}
            <div ref={statusRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setStatusOpen((s) => !s);
                    setCatOpen(false);
                    setSubOpen(false);
                    setSaleOpen(false);
                    setOpenVariantIndex(null);
                  }}
                  className="w-full text-left border border-gray-300 p-2 rounded-md flex items-center justify-between gap-3 hover:shadow-sm transition"
                >
                  <span>{form.status}</span>
                  <span className="text-xs text-gray-500">▾</span>
                </button>

                <div
                  className={`absolute z-30 mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden transform origin-top transition-all ${statusOpen
                    ? "opacity-100 scale-100"
                    : "opacity-0 scale-95 pointer-events-none"
                    }`}
                >
                  <div className="p-2">
                    {STATUS_OPTIONS.map((s) => (
                      <DropItem
                        key={s}
                        onClick={() => {
                          setForm((p) => ({ ...p, status: s }));
                          setStatusOpen(false);
                        }}
                        active={form.status === s}
                      >
                        <div className="flex items-center justify-between">
                          <span>{s}</span>
                          {form.status === s && <Check size={14} />}
                        </div>
                      </DropItem>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <RichTextEditor
                value={form.description}
                onChange={(val) =>
                  setForm((p) => ({ ...p, description: val }))
                }
                placeholder="Entrez la description du produit..."
              />
              {errors.description && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN ================= */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Médias / Variants</h2>

          {/* Tags */}
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags
          </label>
          <div className="border border-gray-300 p-2 rounded-md flex flex-wrap gap-2 items-center mb-4">
            {form.tags.map((tag, idx) => (
              <div
                key={idx}
                className="bg-gray-100 px-2 py-1 rounded flex items-center gap-1 text-sm"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(idx)}
                  className="text-red-500"
                >
                  x
                </button>
              </div>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Ajouter un tag"
              className="flex-1 outline-none text-sm"
            />
          </div>

          {/* Gallery previews */}
          <div className="flex flex-wrap gap-4 mb-6">
            {gallery.map((item, index) => (
              <div key={item.id} className="relative w-32 h-32">
                {item.file?.type?.startsWith("video/") ? (
                  <video
                    src={item.preview}
                    controls
                    className="w-full h-full object-cover rounded-md border border-gray-300"
                  />
                ) : (
                  <img
                    src={item.preview}
                    alt={`preview-${index}`}
                    className="w-full h-full object-cover rounded-md border border-gray-300"
                  />
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveMedia(index)}
                  className="absolute -top-2 -right-2 bg-white rounded-full shadow text-red-500 text-xs w-5 h-5 flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ))}

            <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center w-full h-48 flex flex-col items-center justify-center">
              <svg
                className="mx-auto mb-2 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                width="24"
                height="24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              <p className="text-sm text-gray-600">Déposez vos médias ici</p>
              <p className="text-xs text-gray-500">ou</p>
              <label
                htmlFor="mediaUpload"
                className="text-blue-500 text-sm cursor-pointer"
              >
                Parcourir
              </label>
              <input
                id="mediaUpload"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleMediaChange}
                className="hidden"
              />
              <p className="text-xs text-gray-400 mt-2">
                .jpg, .jpeg, .png, .mp4, .mov, .avi, .webm
              </p>
            </div>
          </div>

          {errors.media && (
            <p className="text-red-500 text-sm mt-1">{errors.media}</p>
          )}

          {/* ================= VARIANTS ================= */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Variants</h2>
              <button
                type="button"
                onClick={addVariant}
                className="text-blue-500 text-sm"
              >
                + Ajouter un variant
              </button>
            </div>

            <div className="space-y-4">
              {form.variants.map((variant, idx) => (
                <div
                  key={variant.id || idx}
                  className="border border-gray-300 p-4 rounded-md relative"
                >
                  <button
                    type="button"
                    onClick={() => removeVariant(idx)}
                    className="absolute top-2 right-2 text-gray-500 text-sm"
                  >
                    <X size={20} />
                  </button>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>

                  <div
                    ref={(el) => variantRefs.current.set(idx, el)}
                    className="relative mb-4"
                  >
                    {addingVariantTypeFor === idx ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            value={newVariantType}
                            onChange={(e) => setNewVariantType(e.target.value)}
                            onKeyDown={(e) => onVariantTypeKey(e, idx)}
                            placeholder="Nouveau type..."
                            className="w-full border border-gray-300 px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                          />
                          <button
                            type="button"
                            onClick={() => saveVariantType(idx)}
                            className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm"
                          >
                            Enregistrer
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingVariantTypeFor(null);
                              setNewVariantType("");
                            }}
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenVariantIndex((cur) =>
                              cur === idx ? null : idx
                            )
                          }
                          className="w-full text-left border border-gray-300 px-3 py-2 rounded-md flex items-center justify-between gap-3 hover:shadow-sm transition text-sm"
                        >
                          <span className="truncate">
                            {variant.type
                              ? variantTypeLabel(variant.type)
                              : "Sélectionner un type"}
                          </span>
                          <span className="text-xs text-gray-500">▾</span>
                        </button>

                        <div
                          className={`absolute z-40 mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden transform origin-top transition-all ${openVariantIndex === idx
                            ? "opacity-100 scale-100"
                            : "opacity-0 scale-95 pointer-events-none"
                            }`}
                        >
                          <div className="p-2">
                            <div className="px-1 pb-2">
                              <input
                                value={variantTypeSearch[idx] ?? ""}
                                onChange={(e) =>
                                  setVariantTypeSearch((prev) => ({
                                    ...prev,
                                    [idx]: e.target.value,
                                  }))
                                }
                                placeholder="Rechercher"
                                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setAddingVariantTypeFor(idx);
                                setNewVariantType("");
                                setOpenVariantIndex(null);
                              }}
                              className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 transition flex items-center gap-2 text-sm font-medium"
                            >
                              <Plus size={14} />
                              <span>Ajouter un nouveau type</span>
                            </button>

                            <div className="border-t my-2" />

                            <div className="max-h-48 overflow-auto">
                              {variantTypeOptions
                                .filter((t) =>
                                  variantTypeSearch[idx] ?? ""
                                    ? t
                                      .toLowerCase()
                                      .includes(
                                        (
                                          variantTypeSearch[idx] ?? ""
                                        ).toLowerCase()
                                      )
                                    : true
                                )
                                .map((t) => (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => {
                                      const newVars = [...form.variants];
                                      newVars[idx].type = t;
                                      setForm((p) => ({
                                        ...p,
                                        variants: newVars,
                                      }));
                                      setOpenVariantIndex(null);
                                      setVariantTypeSearch((prev) => ({
                                        ...prev,
                                        [idx]: "",
                                      }));
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 transition text-sm flex items-center justify-between ${variant.type === t ? "bg-gray-50" : ""
                                      }`}
                                  >
                                    <span>{variantTypeLabel(t)}</span>
                                    {variant.type === t && <Check size={14} />}
                                  </button>
                                ))}

                              {variantTypeOptions.filter((t) =>
                                variantTypeSearch[idx] ?? ""
                                  ? t
                                    .toLowerCase()
                                    .includes(
                                      (
                                        variantTypeSearch[idx] ?? ""
                                      ).toLowerCase()
                                    )
                                  : true
                              ).length === 0 && (
                                  <div className="px-3 py-2 text-xs text-gray-500">
                                    Aucun type trouvé
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">
                    Valeurs
                  </label>
                  <div className="border border-gray-300 p-2 rounded-md flex flex-wrap gap-2 items-center">
                    {variant.values.map((val, vidx) => (
                      <div
                        key={vidx}
                        className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-sm"
                      >
                        {variant.type === "Color" ? (
                          <span
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: val.toLowerCase() }}
                          />
                        ) : null}
                        {val}
                        <button
                          type="button"
                          onClick={() => removeValue(idx, vidx)}
                          className="text-red-500"
                        >
                          x
                        </button>
                      </div>
                    ))}

                    <input
                      value={valueInputs[idx] || ""}
                      onChange={(e) => {
                        const vi = [...valueInputs];
                        vi[idx] = e.target.value;
                        setValueInputs(vi);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addValue(idx);
                        }
                      }}
                      placeholder="Valeur"
                      className="flex-1 outline-none text-sm min-w-[100px]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ================= COMBINATIONS (CARD STYLE) ================= */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                Combinaisons (prix / stock / images)
              </h2>
              <button
                type="button"
                onClick={addCombination}
                className="text-blue-500 text-sm"
              >
                + Ajouter une combinaison
              </button>
            </div>

            {combinations.length === 0 ? (
              <div className="border border-dashed border-gray-200 rounded-md p-4 text-sm text-gray-500">
                Aucune combinaison ajoutée.
              </div>
            ) : (
              <div className="space-y-4">
                {combinations.map((combo) => {
                  const variantFields = form.variants.map((v, i) => ({
                    key: getVariantKey(v, i),
                    label: v.type || "Variant",
                    values: v.values ?? [],
                  }));

                  return (
                    <div
                      key={combo.id}
                      className="border border-gray-300 p-4 rounded-md relative"
                    >
                      <button
                        type="button"
                        onClick={() => removeCombination(combo.id)}
                        className="absolute top-2 right-2 text-gray-500 text-sm"
                      >
                        <X size={22} />
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Dynamic variant selects */}
                        {variantFields.map((vf) => (
                          <div key={vf.key}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {variantTypeLabel(vf.label)}
                            </label>
                            <select
                              value={combo.options?.[vf.key] ?? ""}
                              onChange={(e) =>
                                setCombinations((prev) =>
                                  prev.map((c) =>
                                    c.id === combo.id
                                      ? {
                                        ...c,
                                        options: {
                                          ...c.options,
                                          [vf.key]: e.target.value,
                                        },
                                      }
                                      : c
                                  )
                                )
                              }
                              disabled={!vf.values.length}
                              className="w-full border border-gray-300 p-2 rounded-md text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400"
                            >
                              <option value="">
                                {vf.values.length
                                  ? "Sélectionner"
                                  : "Aucune valeur"}
                              </option>
                              {vf.values.map((val) => (
                                <option key={val} value={val}>
                                  {val}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}

                        {/* Prices */}
                        <div className="md:col-span-2 space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Prix par pièce (DT)
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={combo.pricePiece}
                                onChange={(e) =>
                                  setCombinations((prev) =>
                                    prev.map((c) =>
                                      c.id === combo.id
                                        ? { ...c, pricePiece: e.target.value }
                                        : c
                                    )
                                  )
                                }
                                placeholder="ex: 29.900"
                                className="w-full border border-gray-300 p-2 rounded-md text-sm"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Prix par quantité (DT)
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={combo.priceQuantity}
                                onChange={(e) =>
                                  setCombinations((prev) =>
                                    prev.map((c) =>
                                      c.id === combo.id
                                        ? {
                                          ...c,
                                          priceQuantity: e.target.value,
                                        }
                                        : c
                                    )
                                  )
                                }
                                placeholder="ex: 19.900"
                                className="w-full border border-gray-300 p-2 rounded-md text-sm"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Stock */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Stock
                          </label>
                          <input
                            type="number"
                            value={combo.stock}
                            onChange={(e) =>
                              setCombinations((prev) =>
                                prev.map((c) =>
                                  c.id === combo.id
                                    ? { ...c, stock: e.target.value }
                                    : c
                                )
                              )
                            }
                            placeholder="ex: 12"
                            className="w-full border border-gray-300 p-2 rounded-md text-sm"
                          />
                        </div>

                        {/* Images selector */}
                        <div className="md:col-span-2 relative">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Images de la combinaison
                          </label>

                          <button
                            type="button"
                            onClick={() =>
                              setOpenImagePicker(
                                openImagePicker === combo.id ? null : combo.id
                              )
                            }
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-left bg-white hover:bg-gray-50 transition flex items-center justify-between gap-3"
                          >
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 text-gray-400">
                                <ImageIcon size={16} />
                              </span>
                              <div>
                                <div className="text-sm font-medium">
                                  {combo.imageIds.length
                                    ? `${combo.imageIds.length} sélectionnée(s)`
                                    : "Sélectionner des images"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Choisir depuis la galerie du produit
                                </div>
                              </div>
                            </div>
                            <span className="text-xs text-gray-400">▾</span>
                          </button>

                          {combo.imageIds.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {combo.imageIds.slice(0, 8).map((imgId) => {
                                const item = gallery.find(
                                  (g) => g.id === imgId
                                );
                                return (
                                  <img
                                    key={imgId}
                                    src={item?.preview}
                                    alt="selected"
                                    className="w-10 h-10 rounded-md object-cover border border-gray-200"
                                  />
                                );
                              })}
                              {combo.imageIds.length > 8 && (
                                <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                                  +{combo.imageIds.length - 8}
                                </span>
                              )}
                            </div>
                          )}

                          {openImagePicker === combo.id && (
                            <ImagePicker
                              combo={combo}
                              gallery={gallery}
                              onChange={(next) =>
                                setCombinations((prev) =>
                                  prev.map((c) =>
                                    c.id === combo.id ? next : c
                                  )
                                )
                              }
                              onClose={() => setOpenImagePicker(null)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= PRICING & PUBLISH ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* LEFT: Pricing */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Prix & Inventaire</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prix par pièce
              </label>
              <input
                type="number"
                value={form.pricePiece}
                onChange={(e) =>
                  setForm((p) => ({ ...p, pricePiece: e.target.value }))
                }
                placeholder="Prix par pièce"
                disabled={disableBasePricing}
                className={`p-2 w-full rounded-md border ${pricingError ? "border-red-500 bg-red-50" : "border-gray-300"
                  } ${disableBasePricing ? "bg-gray-100 text-gray-500" : ""}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prix par quantité
              </label>
              <input
                type="number"
                value={form.priceQuantity}
                onChange={(e) =>
                  setForm((p) => ({ ...p, priceQuantity: e.target.value }))
                }
                placeholder="Prix par quantité"
                disabled={disableBasePricing}
                className={`p-2 w-full rounded-md border ${pricingError ? "border-red-500 bg-red-50" : "border-gray-300"
                  } ${disableBasePricing ? "bg-gray-100 text-gray-500" : ""}`}
              />
            </div>

            {pricingError && (
              <p className="sm:col-span-2 text-xs text-red-600">
                Ajoutez au moins un prix (pièce ou quantité).
              </p>
            )}

            {disableBasePricing && (
              <p className="sm:col-span-2 text-xs text-gray-500">
                Les prix de base sont désactivés car les combinaisons gèrent les
                prix.
              </p>
            )}

            {/* Sale Type */}
            <div ref={saleRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de vente
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setSaleOpen((s) => !s);
                    setCatOpen(false);
                    setSubOpen(false);
                    setStatusOpen(false);
                    setOpenVariantIndex(null);
                  }}
                  className="w-full text-left border border-gray-300 p-2 rounded-md flex items-center justify-between gap-3 hover:shadow-sm transition"
                >
                  <span>{saleTypeLabel(form.saleType)}</span>
                  <span className="text-xs text-gray-500">▾</span>
                </button>

                <div
                  className={`absolute z-30 mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden transform origin-top transition-all ${saleOpen
                    ? "opacity-100 scale-100"
                    : "opacity-0 scale-95 pointer-events-none"
                    }`}
                >
                  <div className="p-2">
                    {SALE_OPTIONS.map((s) => (
                      <DropItem
                        key={s}
                        onClick={() => {
                          setForm((p) => ({ ...p, saleType: s }));
                          setSaleOpen(false);
                        }}
                        active={form.saleType === s}
                      >
                        <div className="flex items-center justify-between">
                          <span>{saleTypeLabel(s)}</span>
                          {form.saleType === s && <Check size={14} />}
                        </div>
                      </DropItem>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Stock base */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantité disponible
              </label>
              <input
                type="number"
                value={form.availableQuantity}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    availableQuantity: e.target.value,
                  }))
                }
                placeholder="25"
                disabled={disableBaseStock}
                className={`border border-gray-300 p-2 w-full rounded-md ${disableBaseStock ? "bg-gray-100 text-gray-500" : ""
                  }`}
              />
              {disableBaseStock && (
                <p className="text-xs text-gray-500 mt-1">
                  Stock géré par combinaison.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alerte stock minimum
              </label>
              <input
                type="number"
                value={form.minStockAlert}
                onChange={(e) =>
                  setForm((p) => ({ ...p, minStockAlert: e.target.value }))
                }
                placeholder="5"
                className="border border-gray-300 p-2 w-full rounded-md"
              />
            </div>

            {/* Minimum Order Quantities */}
            <div className="sm:col-span-2 mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-800 mb-3">
                Quantités minimum de commande
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min. détail (pièce)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.minOrderQtyRetail}
                    onChange={(e) => setForm((p) => ({ ...p, minOrderQtyRetail: e.target.value }))}
                    placeholder="1"
                    className={`border border-gray-300 p-2 w-full rounded-md ${form.saleType === "quantity" ? "bg-gray-100 text-gray-500" : ""}`}
                    disabled={form.saleType === "quantity"}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Pour les achats au détail
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min. gros (quantité)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.minOrderQtyWholesale}
                    onChange={(e) => setForm((p) => ({ ...p, minOrderQtyWholesale: e.target.value }))}
                    placeholder="10"
                    className={`border border-gray-300 p-2 w-full rounded-md ${form.saleType === "piece" ? "bg-gray-100 text-gray-500" : ""}`}
                    disabled={form.saleType === "piece"}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Pour les achats en gros. Vendu par lots de cette quantité.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ================= Vente Flash ================= */}
          <div className="mt-6 border border-orange-200 bg-orange-50/40 rounded-lg p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-gray-900">
                  Vente Flash
                </p>
                <p className="text-sm text-gray-600">
                  Activez une réduction temporaire.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={form.venteFlashActive}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      venteFlashActive: e.target.checked,
                      venteFlashPercentage: e.target.checked
                        ? p.venteFlashPercentage
                        : "",
                      flashDiscountValue: e.target.checked
                        ? p.flashDiscountValue
                        : "",
                    }))
                  }
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-orange-200 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>

            {form.venteFlashActive && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* LEFT: config */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type de remise
                    </label>
                    <select
                      value={form.flashDiscountType}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          flashDiscountType: e.target.value as
                            | "percent"
                            | "fixed",
                        }))
                      }
                      className="border p-2 w-full rounded-md"
                    >
                      <option value="percent">% (pourcentage)</option>
                      <option value="fixed">Montant fixe</option>
                    </select>
                  </div>

                  {form.flashDiscountType === "fixed" ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Remise fixe (DT)
                      </label>
                      <input
                        type="number"
                        value={form.flashDiscountValue}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            flashDiscountValue: e.target.value,
                          }))
                        }
                        placeholder="Ex. 10"
                        className={`border p-2 w-full rounded-md ${errors.flashDiscountValue
                          ? "border-red-500"
                          : "border-gray-300"
                          }`}
                      />
                      {errors.flashDiscountValue && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.flashDiscountValue}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pourcentage de remise (%)
                      </label>
                      <input
                        type="number"
                        value={form.venteFlashPercentage}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            venteFlashPercentage: e.target.value,
                          }))
                        }
                        placeholder="Ex. 15"
                        className={`border p-2 w-full rounded-md ${errors.venteFlashPercentage
                          ? "border-red-500"
                          : "border-gray-300"
                          }`}
                      />
                      {errors.venteFlashPercentage && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.venteFlashPercentage}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cible
                      </label>
                      <select
                        value={form.flashApplyTarget}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            flashApplyTarget: e.target.value as
                              | "product"
                              | "combinations",
                          }))
                        }
                        className="border p-2 w-full rounded-md"
                      >
                        <option value="product">Produit entier</option>
                        <option value="combinations">Combinaisons</option>
                      </select>
                    </div>

                    {form.flashApplyTarget === "combinations" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Portée
                        </label>
                        <select
                          value={
                            form.flashApplyAllCombinations ? "all" : "selected"
                          }
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              flashApplyAllCombinations:
                                e.target.value === "all",
                              flashCombinationIds:
                                e.target.value === "all"
                                  ? []
                                  : p.flashCombinationIds,
                            }))
                          }
                          className="border p-2 w-full rounded-md"
                        >
                          <option value="all">Toutes les combinaisons</option>
                          <option value="selected">
                            Combinaisons sélectionnées
                          </option>
                        </select>
                      </div>
                    )}
                  </div>

                  {form.flashApplyTarget === "combinations" &&
                    !form.flashApplyAllCombinations && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-sm font-medium text-gray-700">
                            Combinaisons ciblées
                          </label>
                          {errors.flashCombinationIds && (
                            <span className="text-xs text-red-500">
                              {errors.flashCombinationIds}
                            </span>
                          )}
                        </div>

                        <div className="max-h-48 overflow-auto border rounded-md p-2 bg-white">
                          {combinations.length === 0 && (
                            <p className="text-xs text-gray-500">
                              Ajoutez d'abord des combinaisons.
                            </p>
                          )}

                          {combinations.map((combo) => {
                            const label =
                              form.variants
                                .map((v, idx) => {
                                  const key = getVariantKey(v, idx);
                                  const val = combo.options?.[key] ?? "";
                                  return val
                                    ? `${v.type || "Variant"}: ${val}`
                                    : null;
                                })
                                .filter(Boolean)
                                .join(" / ") ||
                              `Combinaison ${combo.id.slice(0, 6)}`;

                            const checked = form.flashCombinationIds.includes(
                              combo.id
                            );

                            return (
                              <label
                                key={combo.id}
                                className="flex items-center gap-2 py-1 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    setForm((p) => {
                                      const set = new Set(
                                        p.flashCombinationIds
                                      );
                                      if (e.target.checked) set.add(combo.id);
                                      else set.delete(combo.id);
                                      return {
                                        ...p,
                                        flashCombinationIds: Array.from(set),
                                      };
                                    });
                                  }}
                                />
                                <span>{label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>

                {/* RIGHT: dates + preview */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Début (optionnel)
                      </label>
                      <input
                        type="datetime-local"
                        value={form.flashStartAt}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            flashStartAt: e.target.value,
                          }))
                        }
                        className="border p-2 w-full rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fin (optionnel)
                      </label>
                      <input
                        type="datetime-local"
                        value={form.flashEndAt}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            flashEndAt: e.target.value,
                          }))
                        }
                        className="border p-2 w-full rounded-md"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-md border border-orange-100 bg-white text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Prix normal</span>
                      <span className="font-semibold">
                        {formatCurrency(flashBasePrice)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Prix flash</span>
                      <span className="font-semibold text-orange-600">
                        {venteFlashPreview !== null
                          ? formatCurrency(venteFlashPreview)
                          : "En attente"}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Calcul automatique :{" "}
                      {form.flashDiscountType === "fixed"
                        ? "base - montant fixe"
                        : "base - (base * % / 100)"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Publish settings */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Paramètres de publication
          </h2>

          {/* Status badge */}
          <div className="mb-4">
            <span className="text-sm font-medium text-gray-700 mr-2">Statut :</span>
            {(() => {
              const now = new Date();
              const publishDate = form.publishAt ? new Date(form.publishAt) : null;

              if (!form.visible) {
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Caché</span>;
              }
              if (publishDate && publishDate > now) {
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Programmé</span>;
              }
              return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Publié</span>;
            })()}
          </div>

          <div className="space-y-4">
            {/* Visible toggle */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Visible
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.visible}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        visible: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {form.visible
                  ? "Le produit peut apparaître côté client (si pas de date programmée future)"
                  : "Le produit est caché côté client (jamais visible, même par URL directe)"
                }
              </p>
            </div>

            {/* Publish Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Disponible à partir de
              </label>
              <input
                type="datetime-local"
                value={form.publishAt}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    publishAt: e.target.value,
                  }))
                }
                className="border border-gray-300 p-2 w-full rounded-md"
              />
              <p className="text-xs text-gray-500 mt-1">
                {form.publishAt
                  ? new Date(form.publishAt) > new Date()
                    ? "Le produit sera automatiquement publié à cette date (si visible=true)"
                    : "Date passée : le produit est déjà disponible"
                  : "Aucune date : le produit est immédiatement disponible (si visible=true)"
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Shipping */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Livraison & Logistique</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Poids (kg)
              </label>
              <input
                value={form.shippingWeight}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    shippingWeight: e.target.value,
                  }))
                }
                placeholder="2.1"
                className="border border-gray-300 p-2 w-full rounded-md"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dimensions
              </label>
              <input
                value={form.dimensions}
                onChange={(e) =>
                  setForm((p) => ({ ...p, dimensions: e.target.value }))
                }
                placeholder="40 x 28 x 8 cm"
                className="border border-gray-300 p-2 w-full rounded-md"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => updateProduct(false)}
          disabled={submitting}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {submitting ? "Enregistrement..." : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => navigate("/admin/products")}
          className="px-3 py-2 border rounded"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
