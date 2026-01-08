/**
 * Order Validation Schemas
 *
 * Provides Zod validation for checkout and order operations.
 * Tunisia-specific rules for phone (8 digits), name (letters only with accents).
 */

import { z } from "zod";

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Sanitize string input: trim and collapse multiple spaces
 */
const sanitizeString = (val: string) => val.trim().replace(/\s+/g, " ");

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
const regionSchema = z
    .string()
    .min(1, "Le gouvernorat est requis")
    .max(100, "Le gouvernorat ne peut pas dépasser 100 caractères");

// ============================================================
// CLIENT SCHEMA (FOR ORDER CREATION)
// ============================================================

export const ClientValidationSchema = z.object({
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    address: addressSchema.optional(),
    region: regionSchema.optional(),
});

// Looser version for order creation (allows optional fields)
export const ClientSchemaOptional = z
    .object({
        name: z
            .string()
            .optional()
            .transform((val) => (val ? sanitizeString(val) : val)),
        email: z
            .string()
            .email("Email invalide")
            .optional()
            .transform((val) => (val ? sanitizeString(val) : val)),
        phone: z
            .string()
            .optional()
            .transform((val) => (val ? sanitizeString(val) : val)),
        address: z
            .string()
            .optional()
            .transform((val) => (val ? sanitizeString(val) : val)),
        region: z
            .string()
            .optional()
            .transform((val) => (val ? sanitizeString(val) : val)),
    })
    .optional();

// ============================================================
// CHECKOUT FORM SCHEMA (STRICT VALIDATION)
// ============================================================

export const CheckoutFormSchema = z.object({
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    address: addressSchema,
    region: regionSchema,
});

// ============================================================
// CANCEL ORDER SCHEMA
// ============================================================

export const CancelOrderSchema = z.object({
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
// ORDER ITEM SCHEMA (FOR ORDER CREATION)
// ============================================================

export const OrderItemSchema = z.object({
    productId: z.number().int().positive("productId doit être un entier positif"),
    quantity: z
        .number()
        .int()
        .min(1, "La quantité doit être au moins 1")
        .max(9999, "La quantité ne peut pas dépasser 9999"),
    price: z.number().nonnegative("Le prix ne peut pas être négatif"),
    variant: z.string().max(100).optional().nullable(),
    color: z.string().max(50).optional().nullable(),
    size: z.string().max(50).optional().nullable(),
    attributes: z.record(z.string(), z.unknown()).optional().nullable(),
    combinationId: z.string().max(100).optional(),
});

// ============================================================
// PAYMENT SCHEMA
// ============================================================

export const PaymentSchema = z
    .object({
        method: z.enum(["cod", "card", "paymee_card"]).optional(),
        details: z.unknown().optional().nullable(),
    })
    .optional();

// ============================================================
// CREATE ORDER SCHEMA (WITH STRICT CLIENT VALIDATION)
// ============================================================

export const CreateOrderSchemaStrict = z.object({
    address: addressSchema.optional(),
    total: z
        .number()
        .positive("Le total doit être positif")
        .max(1000000, "Le total ne peut pas dépasser 1,000,000"),
    shipping: z
        .number()
        .nonnegative("Les frais de livraison ne peuvent pas être négatifs")
        .max(100000)
        .optional(),
    items: z
        .array(OrderItemSchema)
        .min(1, "Au moins un article est requis")
        .max(100, "Maximum 100 articles par commande"),
    client: ClientValidationSchema,
    payment: PaymentSchema,
    region: regionSchema.optional(),
});

// Looser version for backward compatibility
export const CreateOrderSchema = z.object({
    address: z.string().min(5).max(500).optional(),
    total: z.number().positive().max(1000000),
    shipping: z.number().nonnegative().max(100000).optional(),
    items: z.array(OrderItemSchema).min(1).max(100),
    client: ClientSchemaOptional,
    payment: PaymentSchema,
    region: z.string().max(100).optional(),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type ClientValidationInput = z.infer<typeof ClientValidationSchema>;
export type CheckoutFormInput = z.infer<typeof CheckoutFormSchema>;
export type CancelOrderInput = z.infer<typeof CancelOrderSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type CreateOrderStrictInput = z.infer<typeof CreateOrderSchemaStrict>;

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Format Zod errors into consistent API error format
 */
export function formatValidationErrors(
    error: z.ZodError<unknown>
): Record<string, string> {
    const details: Record<string, string> = {};

    error.issues.forEach((issue) => {
        const path = issue.path.join(".");
        if (!details[path]) {
            details[path] = issue.message;
        }
    });

    return details;
}

/**
 * Create validation error response
 */
export function createValidationErrorResponse(error: z.ZodError<unknown>) {
    return {
        error: "VALIDATION_ERROR",
        details: formatValidationErrors(error),
    };
}
