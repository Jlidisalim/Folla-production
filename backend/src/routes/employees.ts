import { Router } from "express";
import { PrismaClient, Role } from "@prisma/client";
import { clerkAuth, ClerkAuthRequest } from "../middleware/clerkAuth";
import { requireAdmin, AdminAuthRequest } from "../middleware/requireAdmin";

const prisma = new PrismaClient();
const router = Router();

const allowedRoles = new Set(Object.values(Role));

function ensureContact(res: any, email?: string | null, phone?: string | null) {
  if (!email && !phone) {
    res
      .status(400)
      .json({ message: "Email ou téléphone est requis pour un employé" });
    return false;
  }
  return true;
}

// List employees (ADMIN only - using Clerk auth)
router.get(
  "/",
  clerkAuth,
  requireAdmin,
  async (_req: AdminAuthRequest, res) => {
    try {
      const employees = await prisma.employee.findMany({
        orderBy: { id: "desc" },
      });
      res.json(employees);
    } catch (err) {
      console.error("Failed to list employees", err);
      res.status(500).json({ message: "Failed to list employees" });
    }
  }
);

// Create employee (ADMIN only)
router.post(
  "/",
  clerkAuth,
  requireAdmin,
  async (req: AdminAuthRequest, res) => {
    try {
      const { fullName, email, phone, role } = req.body;
      if (!ensureContact(res, email, phone)) return;
      if (!fullName) {
        return res.status(400).json({ message: "Nom complet requis" });
      }
      if (!allowedRoles.has(role)) {
        return res.status(400).json({ message: "Rôle invalide" });
      }

      const employee = await prisma.employee.create({
        data: {
          fullName,
          email: email || null,
          phone: phone || null,
          role,
        },
      });
      res.status(201).json(employee);
    } catch (err: any) {
      console.error("Failed to create employee", err);
      if (err.code === "P2002") {
        return res
          .status(400)
          .json({ message: "Email ou téléphone déjà utilisé" });
      }
      res.status(500).json({ message: "Failed to create employee" });
    }
  }
);

// Update employee (ADMIN only)
router.put(
  "/:id",
  clerkAuth,
  requireAdmin,
  async (req: AdminAuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id))
        return res.status(400).json({ message: "ID invalide" });
      const { fullName, email, phone, role, isActive } = req.body;
      if (!ensureContact(res, email, phone)) return;
      if (role && !allowedRoles.has(role)) {
        return res.status(400).json({ message: "Rôle invalide" });
      }

      const employee = await prisma.employee.update({
        where: { id },
        data: {
          fullName: fullName ?? undefined,
          email: email ?? null,
          phone: phone ?? null,
          role: role ?? undefined,
          isActive: isActive ?? undefined,
        },
      });
      res.json(employee);
    } catch (err: any) {
      console.error("Failed to update employee", err);
      if (err.code === "P2025") {
        return res.status(404).json({ message: "Employé introuvable" });
      }
      if (err.code === "P2002") {
        return res
          .status(400)
          .json({ message: "Email ou téléphone déjà utilisé" });
      }
      res.status(500).json({ message: "Failed to update employee" });
    }
  }
);

// PATCH update employee (ADMIN only) - for partial updates
router.patch(
  "/:id",
  clerkAuth,
  requireAdmin,
  async (req: AdminAuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id))
        return res.status(400).json({ message: "ID invalide" });
      const { fullName, email, phone, role, isActive } = req.body;
      if (role && !allowedRoles.has(role)) {
        return res.status(400).json({ message: "Rôle invalide" });
      }

      const employee = await prisma.employee.update({
        where: { id },
        data: {
          fullName: fullName ?? undefined,
          email: email !== undefined ? (email || null) : undefined,
          phone: phone !== undefined ? (phone || null) : undefined,
          role: role ?? undefined,
          isActive: isActive ?? undefined,
        },
      });
      res.json(employee);
    } catch (err: any) {
      console.error("Failed to update employee", err);
      if (err.code === "P2025") {
        return res.status(404).json({ message: "Employé introuvable" });
      }
      if (err.code === "P2002") {
        return res
          .status(400)
          .json({ message: "Email ou téléphone déjà utilisé" });
      }
      res.status(500).json({ message: "Failed to update employee" });
    }
  }
);

// Deactivate employee (ADMIN only)
router.patch(
  "/:id/deactivate",
  clerkAuth,
  requireAdmin,
  async (req: AdminAuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id))
        return res.status(400).json({ message: "ID invalide" });

      const employee = await prisma.employee.update({
        where: { id },
        data: { isActive: false },
      });
      res.json(employee);
    } catch (err: any) {
      console.error("Failed to deactivate employee", err);
      if (err.code === "P2025") {
        return res.status(404).json({ message: "Employé introuvable" });
      }
      res.status(500).json({ message: "Failed to deactivate employee" });
    }
  }
);

export default router;
