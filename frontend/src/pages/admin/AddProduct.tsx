/* eslint-disable prefer-const */
/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* src/pages/admin/AddProduct.tsx */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { X, Plus, Check, Image as ImageIcon } from "lucide-react";
import api, { useAuthenticatedApi } from "@/lib/api";
import { useNotifications } from "@/components/NotificationProvider";
import RichTextEditor from "@/components/admin/RichTextEditor";

interface UploadedMedia {
  file: File;
  preview: string;
}

interface Variant {
  id: string;
  type: string;
  values: string[];
}

interface CategoryItem {
  name: string;
  path?: string;
  subItems?: string[];
}

interface Combination {
  id: string;
  options: Record<string, string>;
  pricePiece: string;
  priceQuantity: string;
  stock: string;
  imageIndices: number[];
  hasCustomPrice: boolean;
}

// ===================== helpers for combinations =====================

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const getVariantKey = (v: Variant, index: number) =>
  v.id || (v.type || `variant_${index}`).trim();

function createEmptyCombination(variants: Variant[]): Combination {
  const options: Record<string, string> = {};
  variants.forEach((v, i) => {
    options[getVariantKey(v, i)] = "";
  });
  return {
    id: uid(),
    options,
    pricePiece: "",
    priceQuantity: "",
    stock: "",
    imageIndices: [],
    hasCustomPrice: true,
  };
}

function normalizeCombination(
  combo: Combination,
  variants: Variant[]
): Combination {
  const next: Record<string, string> = {};
  variants.forEach((v, i) => {
    const key = getVariantKey(v, i);
    const prevVal = combo.options?.[key] ?? "";
    next[key] = v.values.includes(prevVal) ? prevVal : "";
  });

  const hasCustom =
    combo.hasCustomPrice ||
    (combo.pricePiece ?? "").toString().length > 0 ||
    (combo.priceQuantity ?? "").toString().length > 0;

  return {
    ...combo,
    options: next,
    pricePiece: combo.pricePiece ?? "",
    priceQuantity: combo.priceQuantity ?? "",
    hasCustomPrice: !!hasCustom,
  };
}

// ===================== Image picker (from product gallery) =====================

function ImagePicker({
  combo,
  media,
  onChange,
  onClose,
}: {
  combo: Combination;
  media: UploadedMedia[];
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

  const toggleIndex = (idx: number) => {
    const set = new Set(combo.imageIndices);
    if (set.has(idx)) set.delete(idx);
    else set.add(idx);
    onChange({ ...combo, imageIndices: Array.from(set) });
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

      {media.length === 0 ? (
        <div className="text-xs text-gray-500 py-3">
          Aucune image du produit pour le moment. Ajoutez des images dans
          &quot;Images du produit&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-auto">
          {media.map((m, idx) => {
            const selected = combo.imageIndices.includes(idx);
            const isVideo = m.file.type.startsWith("video/");
            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleIndex(idx)}
                className={`relative rounded-lg overflow-hidden border ${selected ? "border-blue-500" : "border-gray-200"
                  } hover:shadow-sm transition`}
                title={m.file.name}
              >
                <div className="aspect-square bg-gray-50">
                  {isVideo ? (
                    <video
                      src={m.preview}
                      className="w-full h-full object-cover"
                      muted
                    />
                  ) : (
                    <img
                      src={m.preview}
                      alt={`media-${idx}`}
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

// ===================== MAIN COMPONENT =====================

const defaultCategories: CategoryItem[] = [
  { name: "Nouveautés", path: "/category/nouveautes", subItems: [] },
];

const INITIAL_FORM = {
  title: "",
  productId: "",
  category: "",
  subCategory: "",
  status: "Active",
  description: "",
  pricePiece: "",
  priceQuantity: "",
  saleType: "piece",
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
};

export default function AddProduct() {
  const { notify } = useNotifications();
  const { authApi } = useAuthenticatedApi();

  // form state
  const [form, setForm] = useState(INITIAL_FORM);

  // combinations (card style)
  const [combinations, setCombinations] = useState<Combination[]>([]);

  // UI state
  const [tagInput, setTagInput] = useState("");
  const [valueInputs, setValueInputs] = useState<string[]>([]);
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [errors, setErrors] = useState<{ [k: string]: string }>({});
  const [submitting, setSubmitting] = useState(false);

  // categories
  const [categories, setCategories] =
    useState<CategoryItem[]>(defaultCategories);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // dropdown state
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

  // search inside variant type dropdowns
  const [variantTypeSearch, setVariantTypeSearch] = useState<
    Record<number, string>
  >({});

  // add-category inputs
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newSubCategory, setNewSubCategory] = useState("");

  // combo image picker open id
  const [openImagePicker, setOpenImagePicker] = useState<string | null>(null);

  // refs
  const catRef = useRef<HTMLDivElement | null>(null);
  const subRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const saleRef = useRef<HTMLDivElement | null>(null);
  const variantRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

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

  function slugify(text: string) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, "-");
  }

  const flashBasePrice = useMemo(() => {
    const piece = Number(form.pricePiece);
    const quantity = Number(form.priceQuantity);
    const normalizedPiece = !Number.isNaN(piece) && piece > 0 ? piece : null;
    const normalizedQty =
      !Number.isNaN(quantity) && quantity > 0 ? quantity : null;

    const mode = form.saleType.toLowerCase();
    if (mode === "quantity") {
      return normalizedQty ?? normalizedPiece;
    }
    if (mode === "piece") {
      return normalizedPiece ?? normalizedQty;
    }
    return normalizedPiece ?? normalizedQty;
  }, [form.pricePiece, form.priceQuantity, form.saleType]);

  const venteFlashPreview = useMemo(() => {
    if (!form.venteFlashActive) return null;
    const base = flashBasePrice;
    if (base === null) return null;

    if (form.flashDiscountType === "fixed") {
      const fixed = Number(form.flashDiscountValue);
      if (!Number.isFinite(fixed) || fixed <= 0) return null;
      return Math.max(0, Number((base - fixed).toFixed(2)));
    }

    const pct = Number(form.venteFlashPercentage);
    if (Number.isNaN(pct) || pct <= 0) return null;
    const computed = base - (base * pct) / 100;
    if (!Number.isFinite(computed)) return null;
    return Number(computed.toFixed(2));
  }, [
    form.venteFlashActive,
    form.venteFlashPercentage,
    form.flashDiscountType,
    form.flashDiscountValue,
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

  const validate = () => {
    const newErrors: { [k: string]: string } = {};

    if (!form.title.trim())
      newErrors.title = "Le nom du produit est obligatoire";
    if (!form.description.trim())
      newErrors.description = "La description est obligatoire";
    if (!form.category.trim())
      newErrors.category = "La catégorie est obligatoire";
    if (media.length === 0)
      newErrors.media = "Au moins une image ou une vidéo est requise";

    if (!combinations.length && !hasPiecePrice && !hasQtyPrice) {
      newErrors.pricePiece = "Au moins un prix est requis";
    }

    if (form.venteFlashActive) {
      if (flashBasePrice === null && !combinations.length) {
        newErrors.venteFlashPercentage =
          "Ajoutez un prix de base avant d'activer la vente flash";
      }

      if (form.flashDiscountType === "fixed") {
        const fixed = Number(form.flashDiscountValue);
        if (!form.flashDiscountValue.trim()) {
          newErrors.flashDiscountValue = "Indiquez un montant";
        } else if (!Number.isFinite(fixed) || fixed <= 0) {
          newErrors.flashDiscountValue = "Le montant doit être supérieur à 0";
        }
      } else {
        const pct = Number(form.venteFlashPercentage);
        if (!form.venteFlashPercentage.trim()) {
          newErrors.venteFlashPercentage = "Indiquez un pourcentage";
        } else if (Number.isNaN(pct) || pct <= 0) {
          newErrors.venteFlashPercentage =
            "Le pourcentage doit être supérieur à 0";
        }
      }

      if (
        form.flashApplyTarget === "combinations" &&
        !form.flashApplyAllCombinations &&
        form.flashCombinationIds.length === 0
      ) {
        newErrors.flashCombinationIds = "Sélectionnez au moins une combinaison";
      }
    }

    return newErrors;
  };

  // derive categories from /products
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingCategories(true);
        const res = await api.get("/products");
        const raw = Array.isArray(res.data) ? res.data : [];
        const map = new Map<string, Set<string>>();

        for (const p of raw) {
          const c = (p.category ?? "Sans catégorie").trim();
          const s = (p.subCategory ?? "").trim();
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
          setCategories(derived.length ? derived : defaultCategories);
      } catch (err) {
        console.warn("Fallback categories", err);
        if (mounted) setCategories(defaultCategories);
      } finally {
        if (mounted) setLoadingCategories(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // click outside
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

  // keep combinations synced with variants
  useEffect(() => {
    setCombinations((prev) =>
      prev.map((c) => normalizeCombination(c, form.variants))
    );
  }, [form.variants]);

  // media
  const handleMediaChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    const newMedia = selected.map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
    }));
    setMedia((p) => [...p, ...newMedia]);
  };

  const handleRemoveMedia = (i: number) => {
    const img = media[i];
    if (img.preview.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(img.preview);
      } catch { }
    }
    setMedia((p) => p.filter((_, idx) => idx !== i));
  };

  // tags
  const addTag = () => {
    const val = tagInput.trim();
    if (!val) return;
    setForm((p) => ({ ...p, tags: [...p.tags, val] }));
    setTagInput("");
  };

  const removeTag = (idx: number) =>
    setForm((p) => ({ ...p, tags: p.tags.filter((_, i) => i !== idx) }));

  // variants
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
    const vi = [...valueInputs];
    vi[idx] = "";
    setValueInputs(vi);
  };

  const removeValue = (varIdx: number, valIdx: number) => {
    const copy = [...form.variants];
    copy[varIdx].values = copy[varIdx].values.filter((_, i) => i !== valIdx);
    setForm((p) => ({ ...p, variants: copy }));
  };

  // ensure every variant has a stable id (needed for combinations/options mapping)
  useEffect(() => {
    setForm((prev) => {
      const changed = prev.variants.some((v) => !v.id);
      if (!changed) return prev;
      return {
        ...prev,
        variants: prev.variants.map((v, idx) => ({
          ...v,
          id: v.id || uid() || `variant_${idx}`,
        })),
      };
    });
  }, [form.variants]);

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

  // upload
  const uploadImages = async (): Promise<string[]> => {
    if (!media.length) return [];

    const authenticatedApi = await authApi();
    if (!authenticatedApi) {
      throw new Error("Not authenticated - please sign in again");
    }

    const fd = new FormData();
    media.forEach((m) => fd.append("files", m.file));
    const res = await authenticatedApi.post("/products/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data?.urls ?? [];
  };

  // create product
  const createProduct = async (isPublish: boolean) => {
    const newErr = validate();
    if (Object.keys(newErr).length) {
      setErrors(newErr);
      notify({
        title: "Corrigez les erreurs",
        message: "Veuillez corriger les champs en surbrillance.",
        type: "error",
        duration: 4000,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    try {
      setSubmitting(true);
      const uploaded = await uploadImages();

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
              images: c.imageIndices
                .map((i) => uploaded[i])
                .filter((u: string | undefined) => Boolean(u)),
            };
          })
          : [];

      const payload: any = {
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

        visible: isPublish ? true : form.visible,
        publishAt: form.publishAt || null,

        tags: form.tags,
        variants: form.variants,
        images: uploaded,
        combinations: combinationsPayload,

        // Minimum order quantities
        minOrderQtyRetail: Math.max(1, Number(form.minOrderQtyRetail) || 1),
        minOrderQtyWholesale: Math.max(1, Number(form.minOrderQtyWholesale) || 1),

        inStock: disableBaseStock ? true : Number(form.availableQuantity) > 0,
        isNovelty: form.category === "Nouveautés",
      };

      // Get authenticated API for the create call
      const authenticatedApi = await authApi();
      if (!authenticatedApi) {
        throw new Error("Not authenticated - please sign in again");
      }

      await authenticatedApi.post("/products", payload);

      notify({
        title: "Produit créé",
        message: "✅ Produit créé avec succès !",
        type: "success",
        duration: 3500,
      });

      // reset
      setForm(INITIAL_FORM);

      media.forEach((m) => {
        if (m.preview.startsWith("blob:"))
          try {
            URL.revokeObjectURL(m.preview);
          } catch { }
      });

      setMedia([]);
      setErrors({});
      setValueInputs([]);
      setTagInput("");
      setVariantTypeSearch({});
      setCombinations([]);
      setOpenImagePicker(null);

      if (form.category && !categories.some((c) => c.name === form.category)) {
        setCategories((prev) => [
          {
            name: form.category,
            path: `/category/${slugify(form.category)}`,
            subItems: form.subCategory ? [form.subCategory] : [],
          },
          ...prev,
        ]);
      }
    } catch (err) {
      console.error("Échec de la création du produit", err);
      notify({
        title: "Échec de la création",
        message:
          "La création du produit a échoué. Vérifiez la console pour plus de détails.",
        type: "error",
        duration: 6000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // category add-inline
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
    notify({
      title: "Catégorie ajoutée",
      message: `${v} ajoutée localement`,
      type: "success",
    });
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
    notify({
      title: "Sous-catégorie ajoutée",
      message: `${v} ajoutée localement`,
      type: "success",
    });
  };

  const onCategoryKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") acceptNewCategory();
    if (e.key === "Escape") {
      setAddingCategory(false);
      setNewCategory("");
    }
  };

  const onSubKey = (e: KeyboardEvent<HTMLInputElement>) => {
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

  const STATUS_OPTIONS = ["Active", "Inactive"] as const;
  const SALE_OPTIONS = ["piece", "quantity", "both"] as const;

  const statusLabel = (s: string) => {
    if (s === "Active") return "Actif";
    if (s === "Inactive") return "Inactif";
    return s;
  };

  const saleTypeLabel = (s: string) => {
    if (s === "piece") return "Vente à l'unité";
    if (s === "quantity") return "Vente en gros";
    return "Les deux";
  };

  const variantTypeLabel = (t: string) => {
    if (t === "Color") return "Couleur";
    if (t === "Size") return "Taille";
    if (t === "Other") return "Autre";
    return t;
  };

  // ===================== JSX =====================

  return (
    <div className="max-w-6xl mx-auto bg-white p-8 rounded-lg shadow-md my-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <a href="#" className="text-gray-600 hover:text-gray-800 text-sm">
          &lt; Retour à l&apos;inventaire
        </a>
        <div className="flex gap-3">
          <button
            onClick={() => createProduct(true)}
            disabled={submitting}
            className="bg-blue-700 text-white px-8 py-2 rounded-md text-base disabled:opacity-50"
          >
            Publier
          </button>
        </div>
      </div>

      <h1 className="text-3xl font-bold mb-8">Ajouter un nouveau produit</h1>

      {/* ================= MAIN 2 COLUMNS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* ================= LEFT COLUMN ================= */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Informations sur le produit
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
                          ? "Chargement des catégories..."
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
                            Ajouter une nouvelle catégorie
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
                  Sélectionnez d&apos;abord une catégorie
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
                      {form.subCategory || "Sélectionner une sous-catégorie"}
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
                        <span>Ajouter une nouvelle sous-catégorie</span>
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
                  <span>{statusLabel(form.status)}</span>
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
                          <span>{statusLabel(s)}</span>
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
          <h2 className="text-xl font-semibold mb-4">Images du produit</h2>

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

          {/* Media previews */}
          <div className="flex flex-wrap gap-4 mb-8">
            {media.map((item, index) => (
              <div key={index} className="relative w-32 h-32">
                {item.file.type.startsWith("video/") ? (
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
              <p className="text-sm text-gray-600">
                Déposez votre image ou vidéo ici
              </p>
              <p className="text-xs text-gray-500">ou</p>
              <label
                htmlFor="imageUpload"
                className="text-blue-500 text-sm cursor-pointer"
              >
                Cliquez pour parcourir vos fichiers
              </label>
              <input
                id="imageUpload"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleMediaChange}
                className="hidden"
              />
              <p className="text-xs text-gray-400 mt-2">
                Formats acceptés : .jpg, .jpeg, .png, .mp4, .mov, .avi, .webm.
                Minimum 500 x 500 px recommandé.
              </p>
            </div>
          </div>

          {errors.media && (
            <p className="text-red-500 text-sm mt-1">{errors.media}</p>
          )}

          {/* ================= VARIANTS ================= */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Variantes</h2>
              <button
                type="button"
                onClick={addVariant}
                className="text-blue-500 text-sm"
              >
                + Ajouter une variante
              </button>
            </div>

            <div className="space-y-4">
              {form.variants.map((variant, idx) => (
                <div
                  key={idx}
                  className="border border-gray-300 p-4 rounded-md relative"
                >
                  <button
                    type="button"
                    onClick={() => removeVariant(idx)}
                    className="absolute top-2 right-2 text-gray-500 text-sm"
                    title="Supprimer la variante"
                  >
                    <X size={24} />
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
                            placeholder="Type de variante..."
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
                                placeholder="Rechercher ou sélectionner..."
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
                            className="w-4 h-4 rounded-full border border-gray-200"
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
                      placeholder="Ajouter une valeur"
                      className="flex-1 outline-none text-sm min-w-[120px]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ================= COMBINAISONS ================= */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                Combinaisons (prix / stock / images)
              </h2>
              <button
                type="button"
                onClick={() =>
                  setCombinations((prev) => [
                    ...prev,
                    createEmptyCombination(form.variants),
                  ])
                }
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
                    label: v.type ? variantTypeLabel(v.type) : "Variante",
                    values: v.values ?? [],
                  }));

                  return (
                    <div
                      key={combo.id}
                      className="border border-gray-300 p-4 rounded-md relative"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setCombinations((prev) =>
                            prev.filter((c) => c.id !== combo.id)
                          )
                        }
                        className="absolute top-2 right-2 text-gray-500 text-sm"
                        title="Supprimer la combinaison"
                      >
                        <X size={24} />
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Dynamic variant fields */}
                        {variantFields.map((vf) => (
                          <div key={vf.key}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {vf.label}
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
                                  ? "Choisir…"
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

                        {/* Price controls */}
                        <div className="md:col-span-2 space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Prix par pièce (DT)
                              </label>
                              <input
                                type="number"
                                value={combo.pricePiece}
                                min={0}
                                onChange={(e) =>
                                  setCombinations((prev) =>
                                    prev.map((c) =>
                                      c.id === combo.id
                                        ? { ...c, pricePiece: e.target.value }
                                        : c
                                    )
                                  )
                                }
                                placeholder="Ex. 29.900"
                                className="w-full border border-gray-300 p-2 rounded-md text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Prix par quantité (DT)
                              </label>
                              <input
                                type="number"
                                value={combo.priceQuantity}
                                min={0}
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
                                placeholder="Ex. 19.900"
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
                            placeholder="Ex. 12"
                            className="w-full border border-gray-300 p-2 rounded-md text-sm"
                          />
                        </div>

                        {/* Images */}
                        <div className="md:col-span-2 relative">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Images
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
                                  {combo.imageIndices.length
                                    ? `${combo.imageIndices.length} image(s) sélectionnée(s)`
                                    : "Sélectionner des images"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Choisir depuis la galerie du produit
                                </div>
                              </div>
                            </div>
                            <span className="text-xs text-gray-400">▾</span>
                          </button>

                          {combo.imageIndices.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {combo.imageIndices.slice(0, 8).map((i) => (
                                <img
                                  key={i}
                                  src={media[i]?.preview}
                                  alt="selected"
                                  className="w-10 h-10 rounded-md object-cover border border-gray-200"
                                />
                              ))}
                              {combo.imageIndices.length > 8 && (
                                <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                                  +{combo.imageIndices.length - 8}
                                </span>
                              )}
                            </div>
                          )}

                          {openImagePicker === combo.id && (
                            <ImagePicker
                              combo={combo}
                              media={media}
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

      {/* ================= VENTE FLASH ================= */}
      <div className="mt-6 border border-orange-200 bg-orange-50/40 rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-gray-900">Vente flash</p>
            <p className="text-sm text-gray-600">
              Activez une remise pour afficher un prix promotionnel public.
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
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer peer-focus:ring-orange-200 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
          </label>
        </div>

        {form.venteFlashActive && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left block */}
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
                      flashDiscountType: e.target.value as "percent" | "fixed",
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
                          flashApplyAllCombinations: e.target.value === "all",
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
                          Ajoutez d&apos;abord des combinaisons.
                        </p>
                      )}

                      {combinations.map((combo) => {
                        const label =
                          form.variants
                            .map((v, idx) => {
                              const key = getVariantKey(v, idx);
                              const val = combo.options?.[key] ?? "";
                              return val
                                ? `${variantTypeLabel(
                                  v.type || "Variante"
                                )}: ${val}`
                                : null;
                            })
                            .filter(Boolean)
                            .join(" / ") || combo.id;

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
                                  const set = new Set(p.flashCombinationIds);
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

            {/* Right block */}
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
                      setForm((p) => ({ ...p, flashStartAt: e.target.value }))
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
                      setForm((p) => ({ ...p, flashEndAt: e.target.value }))
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
                  <span className="text-gray-500">Prix vente flash</span>
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

      {/* ================= PRICING & PUBLISH ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 mt-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Tarification & Stock</h2>
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
                Ajoutez au moins un prix (pièce ou quantité) avant
                d&apos;enregistrer.
              </p>
            )}
            {disableBasePricing && (
              <p className="sm:col-span-2 text-xs text-gray-500">
                Les prix principaux sont désactivés car les combinaisons
                définissent les prix.
              </p>
            )}

            {/* Sale Type dropdown */}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantité disponible
              </label>
              <input
                type="number"
                value={form.availableQuantity}
                onChange={(e) =>
                  setForm((p) => ({ ...p, availableQuantity: e.target.value }))
                }
                placeholder="25"
                disabled={disableBaseStock}
                className={`border border-gray-300 p-2 w-full rounded-md ${disableBaseStock ? "bg-gray-100 text-gray-500" : ""
                  }`}
              />
              {disableBaseStock && (
                <p className="text-xs text-gray-500 mt-1">
                  Stock géré par les combinaisons.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seuil d&apos;alerte stock
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
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.minOrderQtyRetail}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setForm((p) => ({ ...p, minOrderQtyRetail: val }));
                    }}
                    onBlur={(e) => {
                      const num = parseInt(e.target.value, 10);
                      if (!num || num < 1) {
                        setForm((p) => ({ ...p, minOrderQtyRetail: "1" }));
                      }
                    }}
                    placeholder="1"
                    className={`border border-gray-300 p-2 w-full rounded-md ${form.saleType === "quantity" ? "bg-gray-100 text-gray-500" : ""
                      }`}
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
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.minOrderQtyWholesale}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setForm((p) => ({ ...p, minOrderQtyWholesale: val }));
                    }}
                    onBlur={(e) => {
                      const num = parseInt(e.target.value, 10);
                      if (!num || num < 1) {
                        setForm((p) => ({ ...p, minOrderQtyWholesale: "1" }));
                      }
                    }}
                    placeholder="10"
                    className={`border border-gray-300 p-2 w-full rounded-md ${form.saleType === "piece" ? "bg-gray-100 text-gray-500" : ""
                      }`}
                    disabled={form.saleType === "piece"}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Pour les achats en gros. Vendu par lots de cette quantité.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Publish settings */}
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
                      setForm((p) => ({ ...p, visible: e.target.checked }))
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
                  setForm((p) => ({ ...p, publishAt: e.target.value }))
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
          <h2 className="text-xl font-semibold mb-4">
            Expédition &amp; Logistique
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Poids du colis (kg)
              </label>
              <input
                value={form.shippingWeight}
                onChange={(e) =>
                  setForm((p) => ({ ...p, shippingWeight: e.target.value }))
                }
                placeholder="Ex. 2.1"
                className="border border-gray-300 p-2 w-full rounded-md"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dimensions du produit
              </label>
              <input
                value={form.dimensions}
                onChange={(e) =>
                  setForm((p) => ({ ...p, dimensions: e.target.value }))
                }
                placeholder="Ex. 40 x 28 x 8 cm"
                className="border border-gray-300 p-2 w-full rounded-md"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
