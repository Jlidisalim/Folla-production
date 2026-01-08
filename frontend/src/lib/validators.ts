/**
 * Frontend Validation Schemas
 *
 * Mirrors backend validation for instant client-side feedback.
 * Tunisia-specific rules for phone (8 digits), name (letters only with accents).
 */

import { z } from "zod";

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Sanitize string input: trim and collapse multiple spaces
 */
export const sanitizeString = (val: string) => val.trim().replace(/\s+/g, " ");

// ============================================================
// CHECKOUT FORM VALIDATION SCHEMAS
// ============================================================

/**
 * Tunisia phone validation: exactly 8 digits
 * No +216 prefix, no spaces, no hyphens
 */
const phoneSchema = z
    .string()
    .min(1, "Le numéro de téléphone est requis")
    .transform(sanitizeString)
    .refine((val) => /^\d{8}$/.test(val), {
        message: "Le numéro doit contenir exactement 8 chiffres",
    });

/**
 * Name validation: letters and spaces only (with French accents)
 * Allows: é, è, ê, ë, à, â, ô, î, ï, ù, û, ü, ÿ, ç, etc.
 */
const nameSchema = z
    .string()
    .min(1, "Le nom est requis")
    .transform(sanitizeString)
    .refine((val) => val.length >= 2, {
        message: "Le nom doit contenir au moins 2 caractères",
    })
    .refine((val) => /^[A-Za-zÀ-ÿ\s]+$/.test(val), {
        message: "Le nom ne doit contenir que des lettres",
    });

/**
 * Email validation: standard email format
 */
const emailSchema = z
    .string()
    .min(1, "L'email est requis")
    .transform(sanitizeString)
    .refine((val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
        message: "Email invalide",
    });

/**
 * Address validation:
 * - Minimum 10 characters
 * - Must contain letters AND numbers (e.g., street + number)
 * - Rejects garbage/very short strings
 */
const addressSchema = z
    .string()
    .min(1, "L'adresse est requise")
    .transform(sanitizeString)
    .refine((val) => val.length >= 10, {
        message: "L'adresse doit contenir au moins 10 caractères",
    })
    .refine((val) => /[a-zA-ZÀ-ÿ]/.test(val), {
        message: "L'adresse doit contenir des lettres",
    })
    .refine((val) => /\d/.test(val), {
        message: "L'adresse doit contenir un numéro",
    });

/**
 * Region validation: required, non-empty
 */
const regionSchema = z.string().min(1, "Le gouvernorat est requis");

// ============================================================
// CHECKOUT FORM SCHEMA (STRICT VALIDATION)
// ============================================================

export const checkoutFormSchema = z.object({
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    address: addressSchema,
    region: regionSchema,
});

// ============================================================
// CANCEL ORDER SCHEMA
// ============================================================

export const cancelOrderSchema = z.object({
    reason: z
        .string()
        .min(1, "La raison est requise")
        .transform(sanitizeString)
        .refine((val) => val.length >= 5, {
            message: "La raison doit contenir au moins 5 caractères",
        })
        .refine((val) => val.length <= 500, {
            message: "La raison ne peut pas dépasser 500 caractères",
        }),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type CheckoutFormInput = z.infer<typeof checkoutFormSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

// ============================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================

/**
 * Validate a single field and return error message or null
 */
export function validateField<T>(
    schema: z.ZodSchema<T>,
    value: unknown
): string | null {
    const result = schema.safeParse(value);
    if (result.success) {
        return null;
    }
    return result.error.issues[0]?.message || "Valeur invalide";
}

/**
 * Validate phone number
 */
export function validatePhone(phone: string): string | null {
    const sanitized = sanitizeString(phone);
    if (!sanitized) return "Le numéro de téléphone est requis";
    if (!/^\d{8}$/.test(sanitized)) {
        return "Le numéro doit contenir exactement 8 chiffres";
    }
    return null;
}

/**
 * Validate name
 */
export function validateName(name: string): string | null {
    const sanitized = sanitizeString(name);
    if (!sanitized) return "Le nom est requis";
    if (sanitized.length < 2) return "Le nom doit contenir au moins 2 caractères";
    if (!/^[A-Za-zÀ-ÿ\s]+$/.test(sanitized)) {
        return "Le nom ne doit contenir que des lettres";
    }
    return null;
}

/**
 * Validate email
 */
export function validateEmail(email: string): string | null {
    const sanitized = sanitizeString(email);
    if (!sanitized) return "L'email est requis";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized)) {
        return "Email invalide";
    }
    return null;
}

/**
 * Validate address
 */
export function validateAddress(address: string): string | null {
    const sanitized = sanitizeString(address);
    if (!sanitized) return "L'adresse est requise";
    if (sanitized.length < 10) {
        return "L'adresse doit contenir au moins 10 caractères";
    }
    if (!/[a-zA-ZÀ-ÿ]/.test(sanitized)) {
        return "L'adresse doit contenir des lettres";
    }
    if (!/\d/.test(sanitized)) {
        return "L'adresse doit contenir un numéro";
    }
    return null;
}

/**
 * Validate region
 */
export function validateRegion(region: string): string | null {
    if (!region || !sanitizeString(region)) {
        return "Le gouvernorat est requis";
    }
    return null;
}

/**
 * Validate cancellation reason
 */
export function validateCancelReason(reason: string): string | null {
    const sanitized = sanitizeString(reason);
    if (!sanitized) return "La raison est requise";
    if (sanitized.length < 5) {
        return "La raison doit contenir au moins 5 caractères";
    }
    if (sanitized.length > 500) {
        return "La raison ne peut pas dépasser 500 caractères";
    }
    return null;
}

// ============================================================
// FORM ERROR TYPE
// ============================================================

export interface FormErrors {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    region?: string;
}

/**
 * Validate entire checkout form and return all errors
 */
export function validateCheckoutForm(form: {
    name: string;
    email: string;
    phone: string;
    address: string;
    region: string;
}): FormErrors {
    const errors: FormErrors = {};

    const nameError = validateName(form.name);
    if (nameError) errors.name = nameError;

    const emailError = validateEmail(form.email);
    if (emailError) errors.email = emailError;

    const phoneError = validatePhone(form.phone);
    if (phoneError) errors.phone = phoneError;

    const addressError = validateAddress(form.address);
    if (addressError) errors.address = addressError;

    const regionError = validateRegion(form.region);
    if (regionError) errors.region = regionError;

    return errors;
}

/**
 * Check if form has no errors
 */
export function isFormValid(errors: FormErrors): boolean {
    return Object.keys(errors).length === 0;
}
