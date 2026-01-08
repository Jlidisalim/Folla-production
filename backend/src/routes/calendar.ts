import { Router } from "express";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { clerkAuth, ClerkAuthRequest } from "../middleware/clerkAuth";
import { requireAdmin, AdminAuthRequest } from "../middleware/requireAdmin";

type Holiday = {
  id: string;
  date: string; // ISO date string
  title: string;
  note?: string;
  employeeIds?: number[]; // empty/undefined => applies to all
  createdAt: string;
  updatedAt: string;
};

const router = Router();
const prisma = new PrismaClient();
const dataFile = path.join(process.cwd(), "uploads", "holidays.json");

async function readHolidays(): Promise<Holiday[]> {
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Holiday[]) : [];
  } catch (err: any) {
    if (err.code === "ENOENT") return [];
    console.error("Failed to read holidays file", err);
    return [];
  }
}

async function writeHolidays(data: Holiday[]) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
}

async function validateEmployeeIds(ids: any): Promise<number[] | null> {
  if (ids === undefined || ids === null) return [];
  if (!Array.isArray(ids)) return null;
  if (ids.length === 0) return [];
  const parsed = ids
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (parsed.length !== ids.length) return null;
  const existing = await prisma.employee.findMany({
    where: { id: { in: parsed } },
    select: { id: true },
  });
  if (existing.length !== parsed.length) return null;
  return parsed;
}

function validateBody(body: any) {
  const errors: string[] = [];
  if (!body.title || typeof body.title !== "string") {
    errors.push("Titre requis");
  }
  if (!body.date || typeof body.date !== "string") {
    errors.push("Date requise (ISO string)");
  } else if (Number.isNaN(new Date(body.date).getTime())) {
    errors.push("Date invalide");
  }
  if (body.note && typeof body.note !== "string") {
    errors.push("Note invalide");
  }
  return errors;
}

// List holidays (ADMIN only - using Clerk auth)
router.get(
  "/holidays",
  clerkAuth,
  requireAdmin,
  async (_req: AdminAuthRequest, res) => {
    const holidays = await readHolidays();
    res.json(holidays);
  }
);

// Create holiday (ADMIN only)
router.post(
  "/holidays",
  clerkAuth,
  requireAdmin,
  async (req: AdminAuthRequest, res) => {
    const errors = validateBody(req.body);
    if (errors.length) return res.status(400).json({ message: errors.join(", ") });

    const employeeIds = await validateEmployeeIds(req.body.employeeIds);
    if (employeeIds === null) {
      return res.status(400).json({ message: "employeeIds invalides" });
    }

    const holidays = await readHolidays();
    const now = new Date().toISOString();
    const holiday: Holiday = {
      id: randomUUID(),
      date: new Date(req.body.date).toISOString(),
      title: req.body.title.trim(),
      note: req.body.note?.toString().trim() || undefined,
      employeeIds,
      createdAt: now,
      updatedAt: now,
    };
    holidays.push(holiday);
    await writeHolidays(holidays);
    res.status(201).json(holiday);
  }
);

// Update holiday (ADMIN only)
router.patch(
  "/holidays/:id",
  clerkAuth,
  requireAdmin,
  async (req: AdminAuthRequest, res) => {
    const holidays = await readHolidays();
    const idx = holidays.findIndex((h) => h.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: "Congé introuvable" });

    const next = { ...holidays[idx] };
    if (req.body.title) next.title = String(req.body.title).trim();
    if (req.body.note !== undefined) next.note = req.body.note ? String(req.body.note) : undefined;
    if (req.body.date) {
      const d = new Date(req.body.date);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ message: "Date invalide" });
      }
      next.date = d.toISOString();
    }
    if (req.body.employeeIds !== undefined) {
      const employeeIds = await validateEmployeeIds(req.body.employeeIds);
      if (employeeIds === null) {
        return res.status(400).json({ message: "employeeIds invalides" });
      }
      next.employeeIds = employeeIds;
    }
    next.updatedAt = new Date().toISOString();
    holidays[idx] = next;
    await writeHolidays(holidays);
    res.json(next);
  }
);

// Delete holiday (ADMIN only)
router.delete(
  "/holidays/:id",
  clerkAuth,
  requireAdmin,
  async (req: AdminAuthRequest, res) => {
    const holidays = await readHolidays();
    const next = holidays.filter((h) => h.id !== req.params.id);
    if (next.length === holidays.length) {
      return res.status(404).json({ message: "Congé introuvable" });
    }
    await writeHolidays(next);
    res.json({ ok: true });
  }
);

// Simple calendar feed (ADMIN only)
router.get(
  "/events",
  clerkAuth,
  requireAdmin,
  async (_req: AdminAuthRequest, res) => {
    const holidays = await readHolidays();
    const events = holidays.map((h) => ({
      id: h.id,
      title: h.title,
      date: h.date,
      note: h.note,
      employeeIds: h.employeeIds ?? [],
    }));
    res.json(events);
  }
);

export default router;
