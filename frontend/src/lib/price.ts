export type PurchaseUnit = "piece" | "quantity";

export interface PriceResolutionResult {
  price: number | null;
  fromCombination: boolean;
  hasRange: boolean;
}

export type FlashConfig = {
  active: boolean;
  target: "product" | "combinations";
  applyAllCombinations: boolean;
  combinationIds: string[];
  discountType: "percent" | "fixed";
  discountValue: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

export interface DisplayPriceResult {
  price: number | null;
  basePrice: number | null;
  flashApplied: boolean;
  fromCombination: boolean;
}

export interface ListingPriceResult extends DisplayPriceResult {
  hasRange: boolean;
  combinationId?: string | null;
}

const numOrNull = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const firstNonNull = (...values: Array<number | null>) => {
  for (const v of values) {
    if (v !== null && v !== undefined) return v;
  }
  return null;
};

const coerceDate = (value: any): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizeFlash = (product: any): FlashConfig => {
  const target =
    product?.flashApplyTarget === "combinations" ? "combinations" : "product";
  const applyAllCombinations =
    product?.flashApplyAllCombinations === false ? false : true;
  const combinationIds = Array.isArray(product?.flashCombinationIds)
    ? product.flashCombinationIds.map((c: any) => String(c))
    : [];
  const discountType =
    product?.flashDiscountType === "fixed" ? "fixed" : "percent";
  const pctCandidate = numOrNull(
    product?.venteFlashPercentage ?? product?.flashDiscountValue
  );
  const fixedCandidate = numOrNull(product?.flashDiscountValue);
  const discountValue =
    discountType === "fixed" ? fixedCandidate : pctCandidate;
  const startsAt =
    coerceDate(product?.flashStartAt) ?? coerceDate(product?.flashStartDate);
  const endsAt =
    coerceDate(product?.flashEndAt) ?? coerceDate(product?.flashEndDate);

  return {
    active: product?.venteFlashActive === true,
    target,
    applyAllCombinations,
    combinationIds,
    discountType,
    discountValue: discountValue !== null && discountValue > 0 ? discountValue : null,
    startsAt,
    endsAt,
  };
};

export function isFlashActive(
  cfg: FlashConfig,
  now: number | Date = Date.now()
): boolean {
  if (!cfg.active) return false;
  if (cfg.discountValue === null || cfg.discountValue <= 0) return false;
  const nowTs = now instanceof Date ? now.getTime() : now;
  if (cfg.startsAt && cfg.startsAt.getTime() > nowTs) return false;
  if (cfg.endsAt && cfg.endsAt.getTime() < nowTs) return false;
  return true;
}

const getComboId = (combination: any): string | null => {
  if (!combination) return null;
  return (
    combination.id ??
    combination.combinationId ??
    combination.combination_id ??
    null
  );
};

export function resolveBasePrice(
  product: any,
  combination: any | null,
  unit: PurchaseUnit
): number | null {
  if (unit === "piece") {
    return firstNonNull(
      numOrNull(combination?.pricePiece),
      numOrNull(product?.pricePiece),
      numOrNull(combination?.priceQuantity),
      numOrNull(product?.priceQuantity)
    );
  }

  return firstNonNull(
    numOrNull(combination?.priceQuantity),
    numOrNull(product?.priceQuantity),
    numOrNull(combination?.pricePiece),
    numOrNull(product?.pricePiece)
  );
}

export function isComboFlashEligible(
  cfg: FlashConfig,
  comboId?: string | null
): boolean {
  if (cfg.target !== "combinations") return false;
  if (cfg.applyAllCombinations) return true;
  if (!comboId) return false;
  return cfg.combinationIds.includes(String(comboId));
}

export function applyFlashDiscount(
  basePrice: number | null,
  cfg: FlashConfig,
  now?: number | Date
): number | null {
  if (basePrice === null) return null;
  if (!isFlashActive(cfg, now)) return basePrice;
  if (cfg.discountType === "fixed") {
    return Math.max(0, Number((basePrice - (cfg.discountValue ?? 0)).toFixed(3)));
  }
  const pct = cfg.discountValue ?? 0;
  return Number((basePrice - (basePrice * pct) / 100).toFixed(3));
}

export function resolveDisplayPriceWithFlash(
  product: any,
  selectedCombination: any | null,
  unit: PurchaseUnit,
  opts?: { includeFlash?: boolean }
): DisplayPriceResult {
  if (!product) {
    return { price: null, basePrice: null, flashApplied: false, fromCombination: false };
  }

  const includeFlash = opts?.includeFlash !== false;
  const flash = normalizeFlash(product);
  const basePrice = resolveBasePrice(product, selectedCombination, unit);

  let price = basePrice;
  let flashApplied = false;

  if (includeFlash && product?.venteFlashActive) {
    // First, try to use displayFlashPrice from the API (already calculated by backend)
    const apiFlashPrice = numOrNull(product?.displayFlashPrice);
    if (apiFlashPrice !== null && apiFlashPrice > 0 && (basePrice === null || apiFlashPrice < basePrice)) {
      price = apiFlashPrice;
      flashApplied = true;
    } else {
      // Fallback: calculate flash price ourselves
      if (flash.target === "product") {
        price = applyFlashDiscount(basePrice, flash);
      } else if (isComboFlashEligible(flash, getComboId(selectedCombination))) {
        price = applyFlashDiscount(basePrice, flash);
      }
      flashApplied =
        isFlashActive(flash) &&
        price !== null &&
        basePrice !== null &&
        price < basePrice;
    }
  }

  return {
    price,
    basePrice,
    flashApplied,
    fromCombination: !!selectedCombination,
  };
}

export function resolveListingMinPriceWithFlash(
  product: any,
  unit: PurchaseUnit,
  opts?: { includeFlash?: boolean }
): ListingPriceResult {
  const includeFlash = opts?.includeFlash !== false;
  const flash = normalizeFlash(product);
  const combos: any[] = Array.isArray(product?.combinations)
    ? product.combinations
    : [];

  let minPrice: number | null = null;
  let minBase: number | null = null;
  let minComboId: string | null = null;
  combos.forEach((combo) => {
    const base = resolveBasePrice(product, combo, unit);
    let finalPrice = base;

    if (includeFlash) {
      if (flash.target === "product") {
        finalPrice = applyFlashDiscount(base, flash);
      } else if (isComboFlashEligible(flash, getComboId(combo))) {
        finalPrice = applyFlashDiscount(base, flash);
      }
    }

    if (finalPrice !== null) {
      if (minPrice === null || finalPrice < minPrice) {
        minPrice = finalPrice;
        minBase = base;
        minComboId = getComboId(combo);
      }
    }
  });

  if (minPrice !== null) {
    const flashApplied =
      includeFlash &&
      isFlashActive(flash) &&
      minBase !== null &&
      minPrice < minBase;
    return {
      price: minPrice,
      basePrice: minBase,
      flashApplied,
      fromCombination: true,
      hasRange: combos.length > 1,
      combinationId: minComboId,
    };
  }

  const basePrice = resolveBasePrice(product, null, unit);
  const price =
    includeFlash && flash.target === "product"
      ? applyFlashDiscount(basePrice, flash)
      : basePrice;

  const flashApplied =
    includeFlash &&
    isFlashActive(flash) &&
    price !== null &&
    basePrice !== null &&
    price < basePrice;

  return {
    price,
    basePrice,
    flashApplied,
    fromCombination: false,
    hasRange: false,
    combinationId: null,
  };
}

export function resolvePriceForUnit(
  product: any,
  unit: PurchaseUnit,
  selectedCombination?: any | null,
  opts?: { includeFlash?: boolean }
): PriceResolutionResult {
  if (selectedCombination) {
    const res = resolveDisplayPriceWithFlash(
      product,
      selectedCombination,
      unit,
      opts
    );
    return {
      price: res.price,
      fromCombination: true,
      hasRange: false,
    };
  }

  const res = resolveListingMinPriceWithFlash(product, unit, opts);
  return {
    price: res.price,
    fromCombination: res.fromCombination,
    hasRange: res.hasRange,
  };
}

export function formatPriceTND(v: number | null | undefined): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "--";
  try {
    return new Intl.NumberFormat("fr-TN", {
      style: "currency",
      currency: "TND",
      minimumFractionDigits: 3,
    }).format(v);
  } catch {
    return `${Number(v).toFixed(3)} DT`;
  }
}
