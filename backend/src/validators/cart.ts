/**
 * Zod Validation Schemas for Cart API
 * 
 * Provides input validation for all cart endpoints.
 */

import { z } from "zod";

// ============================================================
// CART ITEM SCHEMAS
// ============================================================

export const AddToCartSchema = z.object({
    productId: z.number().int().positive("productId must be a positive integer"),
    quantity: z.number().int().min(1, "quantity must be at least 1").max(999, "quantity cannot exceed 999"),
    combinationId: z.string().max(100).optional(),
    unitType: z.enum(["piece", "quantity"]).default("piece"),
    variantLabel: z.string().max(200).optional(),
}).strict(); // Reject unknown fields

export const UpdateCartItemSchema = z.object({
    quantity: z.number().int().min(1, "quantity must be at least 1").max(999, "quantity cannot exceed 999"),
}).strict();

export const RemoveCartItemSchema = z.object({
    productId: z.number().int().positive("productId must be a positive integer"),
    combinationId: z.string().max(100).optional(),
}).strict();

// ============================================================
// CART SYNC SCHEMA (for full cart replacement)
// ============================================================

const CartItemSchema = z.object({
    productId: z.number().int().positive(),
    combinationId: z.string().max(100).optional().nullable(),
    quantity: z.number().int().min(1).max(999),
    unitType: z.enum(["piece", "quantity"]),
    priceAtAdd: z.number().nonnegative(),
    titleAtAdd: z.string().max(500),
    imageAtAdd: z.string().max(1000).optional().nullable(),
    optionsAtAdd: z.record(z.string(), z.unknown()).optional().nullable(),
    minQty: z.number().int().optional().nullable(),
    maxQty: z.number().int().optional().nullable(),
    variantLabel: z.string().max(200).optional().nullable(),
});

export const SyncCartSchema = z.object({
    items: z.array(CartItemSchema).max(100, "Cart cannot have more than 100 items"),
}).strict();

// ============================================================
// VALIDATION HELPER
// ============================================================

export type AddToCartInput = z.infer<typeof AddToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;
export type RemoveCartItemInput = z.infer<typeof RemoveCartItemSchema>;
export type SyncCartInput = z.infer<typeof SyncCartSchema>;
