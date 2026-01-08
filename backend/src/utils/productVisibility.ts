/**
 * Product Visibility Utilities
 * 
 * Central source of truth for product visibility logic.
 * All client-facing endpoints should use these utilities.
 */

export type VisibilityStatus = 'HIDDEN' | 'SCHEDULED' | 'PUBLIC';

export interface ProductVisibilityFields {
  visible: boolean;
  publishAt: Date | null;
}

/**
 * Get the visibility status of a product.
 * 
 * Rules (in order of priority):
 * 1. visible=false → HIDDEN (always hidden from clients)
 * 2. publishAt is in the future → SCHEDULED (hidden until date)
 * 3. Otherwise → PUBLIC
 */
export function getProductVisibilityStatus(
  product: ProductVisibilityFields,
  now: Date = new Date()
): VisibilityStatus {
  // Rule 1: visible=false takes absolute priority
  if (!product.visible) {
    return 'HIDDEN';
  }

  // Rule 2: future publishAt means scheduled
  if (product.publishAt && product.publishAt > now) {
    return 'SCHEDULED';
  }

  // Rule 3: visible=true and no future date means public
  return 'PUBLIC';
}

/**
 * Check if a product is currently public (visible to clients).
 */
export function isProductPublic(
  product: ProductVisibilityFields,
  now: Date = new Date()
): boolean {
  return getProductVisibilityStatus(product, now) === 'PUBLIC';
}

/**
 * Get Prisma WHERE clause for filtering public products.
 * Use this in all client-facing product queries.
 * 
 * Returns products where:
 * - visible = true
 * - AND (publishAt is null OR publishAt <= now)
 */
export function getClientVisibilityFilter(now: Date = new Date()) {
  return {
    visible: true,
    OR: [
      { publishAt: null },
      { publishAt: { lte: now } }
    ]
  };
}

/**
 * Get human-readable status label in French.
 */
export function getVisibilityLabel(status: VisibilityStatus): string {
  switch (status) {
    case 'HIDDEN':
      return 'Caché';
    case 'SCHEDULED':
      return 'Programmé';
    case 'PUBLIC':
      return 'Publié';
  }
}

/**
 * Get status badge color classes (Tailwind).
 */
export function getVisibilityBadgeColor(status: VisibilityStatus): string {
  switch (status) {
    case 'HIDDEN':
      return 'bg-red-100 text-red-800';
    case 'SCHEDULED':
      return 'bg-yellow-100 text-yellow-800';
    case 'PUBLIC':
      return 'bg-green-100 text-green-800';
  }
}
