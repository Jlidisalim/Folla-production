// server/src/routes/clients.ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "@clerk/express";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const router = Router();

// ---------------------
// Simple file-backed cart store keyed by Clerk userId
// ---------------------
const cartStorePath = path.join(process.cwd(), "cart-store.json");

type StoredCartItem = {
  id: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
  shippingPrice?: number | null;
  minQty?: number | null;
  maxQty?: number | null;
  variant?: string | null;
  color?: string | null;
  size?: string | null;
  attributes?: any;
};

function readCartStore(): Record<string, StoredCartItem[]> {
  try {
    const raw = fs.readFileSync(cartStorePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // ignore
  }
  return {};
}

function writeCartStore(data: Record<string, StoredCartItem[]>) {
  try {
    fs.writeFileSync(cartStorePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to persist cart store", err);
  }
}

const normalizePhone = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * ðŸ§¾ GET all clients
 */
router.get("/", async (_, res) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { id: "desc" },
    });
    res.json(clients);
  } catch (err) {
    console.error("âŒ Failed to get clients", err);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

/**
 * âž• Create client (manual)
 */
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, purchaseUnit, clerkId } = req.body;

    if (!email) return res.status(400).json({ error: "Email is required" });

    // 1ï¸âƒ£ Check if a client already exists with same email or clerkId
    let existing = null;

    if (clerkId) {
      existing = await prisma.client.findUnique({ where: { clerkId } });
    }
    if (!existing) {
      existing = await prisma.client.findUnique({ where: { email } });
    }

    if (existing) {
      // If the existing one doesn't have a clerkId yet, update it
      if (!existing.clerkId && clerkId) {
        const updated = await prisma.client.update({
          where: { id: existing.id },
          data: { clerkId },
        });
        return res.json(updated);
      }
      return res.status(409).json({ error: "Client already exists" });
    }

    // 2ï¸âƒ£ Create new client with optional clerkId
    const client = await prisma.client.create({
      data: {
        name,
        email,
        phone,
        purchaseUnit: purchaseUnit || "piece",
        clerkId: clerkId || null,
      },
    });

    res.status(201).json(client);
  } catch (err) {
    console.error("âŒ Error creating client", err);
    res.status(500).json({ error: "Failed to create client" });
  }
});

/**
 * âœï¸ Update client (used for purchaseUnit or info)
 */
router.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id))
    return res.status(400).json({ error: "Invalid client ID" });

  try {
    const { name, email, phone, purchaseUnit, clerkId } = req.body;

    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone && { phone }),
        ...(purchaseUnit && { purchaseUnit }),
        ...(clerkId && { clerkId }),
      },
    });

    res.json(client);
  } catch (err) {
    console.error("âŒ Error updating client", err);
    res.status(500).json({ error: "Failed to update client" });
  }
});

/**
 * ðŸ—‘ï¸ Delete client
 */
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id))
    return res.status(400).json({ error: "Invalid client ID" });

  try {
    await prisma.client.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("âŒ Error deleting client", err);
    res.status(500).json({ error: "Failed to delete client" });
  }
});

/* --------------------------
 * NEW: POST /clients/sync
 * Upsert a client by clerkId (create if missing, update if present).
 * Body: { clerkId, email?, name? }
 * ------------------------- */
router.post("/sync", async (req, res) => {
  try {
    const { clerkId, email, name, phone } = req.body;

    if (!clerkId) return res.status(400).json({ error: "clerkId required" });

    const normalizedPhone = normalizePhone(phone);

    // Try find by clerkId
    let client = await prisma.client.findUnique({ where: { clerkId } });

    // If not found by clerkId, try by email (attach clerkId if matches)
    if (!client && email) {
      client = await prisma.client.findUnique({ where: { email } });
    }

    if (client) {
      // update missing fields if necessary
      const updateData: Record<string, any> = {};

      if (name && !client.name) updateData.name = name;
      if (email && !client.email) updateData.email = email;
      if (
        normalizedPhone &&
        (!client.phone || client.phone !== normalizedPhone)
      ) {
        updateData.phone = normalizedPhone;
      }
      if (!client.clerkId) updateData.clerkId = clerkId;

      if (Object.keys(updateData).length > 0) {
        const updated = await prisma.client.update({
          where: { id: client.id },
          data: updateData,
        });
        return res.json(updated);
      }

      return res.json(client);
    }

    // create new
    const created = await prisma.client.create({
      data: {
        clerkId,
        email: email || null,
        name: name || null,
        phone: normalizedPhone,
        purchaseUnit: "piece",
      },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error("âŒ Error in /clients/sync:", err);
    res.status(500).json({ error: "Failed to sync client" });
  }
});

/* --------------------------
 * NEW: GET /clients/current
 * Returns client based on header x-clerk-id OR ?clerkId=
 * This is a light-weight, non-authenticated helper for frontend.
 * ------------------------- */
router.get("/current", async (req, res) => {
  try {
    const clerkIdHeader = (req.headers["x-clerk-id"] as string) || null;
    const clerkIdQuery = (req.query.clerkId as string) || null;
    const clerkId = clerkIdHeader || clerkIdQuery;

    if (!clerkId) return res.status(400).json({ error: "clerkId required" });

    const client = await prisma.client.findUnique({ where: { clerkId } });
    if (!client) return res.status(404).json({ error: "Client not found" });

    res.json(client);
  } catch (err) {
    console.error("âŒ Error in /clients/current:", err);
    res.status(500).json({ error: "Failed to fetch client" });
  }
});

/**
 * ðŸ™‹â€â™‚ï¸ Auto-sync Clerk user to Client table (server-validated)
 * This endpoint requires Clerk session cookies / token and uses requireAuth()
 */
router.get("/me", requireAuth(), async (req: any, res) => {
  try {
    const { userId, sessionClaims } = req.auth();

    const email =
      sessionClaims?.email_address ||
      sessionClaims?.email ||
      sessionClaims?.primary_email ||
      null;

    const name =
      sessionClaims?.name ||
      sessionClaims?.full_name ||
      sessionClaims?.username ||
      "Unnamed";

    const sessionPhone =
      sessionClaims?.phone_number ||
      sessionClaims?.phone ||
      sessionClaims?.primary_phone ||
      sessionClaims?.phoneNumber ||
      null;
    const headerPhone =
      (req.headers["x-user-phone"] as string) ||
      (req.headers["x-user-phone-number"] as string) ||
      null;
    const normalizedPhone =
      normalizePhone(sessionPhone) ?? normalizePhone(headerPhone);

    if (!userId || !email) {
      return res.status(400).json({ error: "Missing Clerk user data" });
    }

    let client = await prisma.client.findUnique({ where: { clerkId: userId } });
    if (!client) {
      client = await prisma.client.findUnique({ where: { email } });
    }

    if (!client) {
      client = await prisma.client.create({
        data: {
          name,
          email,
          clerkId: userId,
          phone: normalizedPhone,
          purchaseUnit: "piece",
        },
      });
    } else {
      const needsClerkId = !client.clerkId;
      const needsPhoneUpdate = Boolean(
        normalizedPhone && normalizedPhone !== client.phone
      );

      if (needsClerkId || needsPhoneUpdate) {
        client = await prisma.client.update({
          where: { id: client.id },
          data: {
            ...(needsClerkId ? { clerkId: userId } : {}),
            ...(needsPhoneUpdate ? { phone: normalizedPhone } : {}),
          },
        });
      }
    }

    res.json(client);
  } catch (err) {
    console.error("Clerk /me sync error:", err);
    res.status(500).json({ error: "Failed to sync client" });
  }
});

/**
 * Persist/retrieve cart per Clerk user (file-backed).
 */
router.get("/cart", requireAuth(), async (req: any, res) => {
  const userId = req.auth?.()?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const store = readCartStore();
  res.json({ items: store[userId] ?? [] });
});

router.put("/cart", requireAuth(), async (req: any, res) => {
  const userId = req.auth?.()?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items)
    return res
      .status(400)
      .json({ error: "items must be an array of cart entries" });

  const sanitized: StoredCartItem[] = items.map((i: any) => ({
    id: String(i.id),
    title: String(i.title ?? ""),
    price: Number.isFinite(Number(i.price)) ? Number(i.price) : 0,
    quantity: Number.isFinite(Number(i.quantity)) ? Number(i.quantity) : 1,
    image: String(i.image ?? ""),
    shippingPrice: Number.isFinite(Number(i.shippingPrice))
      ? Number(i.shippingPrice)
      : null,
    minQty: Number.isFinite(Number(i.minQty)) ? Number(i.minQty) : null,
    maxQty: Number.isFinite(Number(i.maxQty)) ? Number(i.maxQty) : null,
    variant: i.variant ?? null,
    color: i.color ?? null,
    size: i.size ?? null,
    attributes: i.attributes ?? null,
  }));

  const store = readCartStore();
  store[userId] = sanitized;
  writeCartStore(store);

  res.json({ items: sanitized });
});

export default router;






