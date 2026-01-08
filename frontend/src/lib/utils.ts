import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string) {
  const base = value
    ?.toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "produit";
}

type ProductLike =
  | {
      id: number | string;
      title?: string | null;
    }
  | number
  | string;

export function buildProductPath(
  product: ProductLike,
  titleOverride?: string | null
) {
  const id =
    typeof product === "object" ? product.id : (product as number | string);
  const title =
    typeof product === "object" ? product.title : titleOverride ?? "";
  const slug = slugify(title || `produit-${id}`);
  return `/product/${slug}-${id}`;
}

export function extractIdFromSlug(slug?: string | null) {
  if (!slug) return null;
  const trimmed = slug.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/-(\d+)$/);
  if (match) return match[1];
  if (/^\d+$/.test(trimmed)) return trimmed;
  return null;
}

type ClerkLikeError = {
  errors?: { code?: string; message?: string; longMessage?: string }[];
  message?: string;
};

export function getFriendlyAuthError(
  err: unknown,
  fallback: string
): string {
  const parsed = err as ClerkLikeError;
  const raw =
    parsed?.errors?.[0]?.longMessage ||
    parsed?.errors?.[0]?.message ||
    (parsed as { message?: string })?.message ||
    "";

  const normalized = raw.toString();
  const lower = normalized.toLowerCase();

  const isNetworkIssue =
    lower.includes("network") ||
    lower.includes("failed to fetch") ||
    lower.includes("timeout");

  if (isNetworkIssue) {
    return "Impossible de joindre le service d'authentification. Vérifiez votre connexion internet puis réessayez.";
  }

  const looksTechnical =
    normalized.includes("http") ||
    normalized.includes("://") ||
    lower.includes("clerkjs") ||
    /[_{}]/.test(normalized);

  if (!normalized || looksTechnical) {
    return fallback;
  }

  return normalized;
}
