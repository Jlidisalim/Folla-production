/**
 * Task Routes
 *
 * Express router for task management with RBAC.
 *
 * Endpoints:
 * - GET /api/tasks - List tasks (with recurring expansion)
 * - POST /api/tasks - Create task (ADMIN only)
 * - GET /api/tasks/:id - Get single task
 * - PATCH /api/tasks/:id - Update task (ADMIN only)
 * - DELETE /api/tasks/:id - Delete task (ADMIN only)
 * - PATCH /api/tasks/:id/status - Update status (admin or assignee)
 * - POST /api/tasks/:id/complete - Submit completion report (assignee only)
 */

import { Router, Response } from "express";
import { PrismaClient, Role, TaskStatus, TaskType, RepeatRule } from "@prisma/client";
import { z } from "zod";
import { clerkAuth, ClerkAuthRequest } from "../middleware/clerkAuth";
import { requireAdmin, requireRole, AdminAuthRequest } from "../middleware/requireAdmin";
import taskService, { TaskWithRelations, expandRecurringTasks, markCompletedOccurrences } from "../services/taskService";

const router = Router();
const prisma = new PrismaClient();

// ============================================================
// Zod Schemas for Validation
// ============================================================

const createTaskSchema = z.object({
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().optional(),
    type: z.enum(["CALL", "MEETING", "MILESTONE", "TASK"]).default("TASK"),
    category: z.string().optional(),
    priority: z.number().int().min(1).max(3).default(2),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    dueAt: z.string().datetime().optional(),
    repeatRule: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).default("NONE"),
    assignedToId: z.number().int().positive("Assignee is required"),
});

const updateTaskSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().optional().nullable(),
    type: z.enum(["CALL", "MEETING", "MILESTONE", "TASK"]).optional(),
    category: z.string().optional().nullable(),
    priority: z.number().int().min(1).max(3).optional(),
    status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED", "CANCELED"]).optional(),
    startAt: z.string().datetime().optional().nullable(),
    endAt: z.string().datetime().optional().nullable(),
    dueAt: z.string().datetime().optional().nullable(),
    repeatRule: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).optional(),
    assignedToId: z.number().int().positive().optional(),
});

const updateStatusSchema = z.object({
    status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED", "CANCELED"]),
});

const completeTaskSchema = z.object({
    occurrenceDate: z.string().datetime(),
    reportText: z.string().min(1, "Report text is required"),
    timeSpentMin: z.number().int().positive().optional(),
    blockers: z.string().optional(),
});

// ============================================================
// Helper: Get employee from request
// ============================================================
async function getEmployeeFromRequest(req: AdminAuthRequest): Promise<{
    id: number;
    role: Role;
    fullName: string;
} | null> {
    if (!req.dbUser) return null;
    return {
        id: req.dbUser.id,
        role: req.dbUser.role,
        fullName: req.dbUser.name || "",
    };
}

// ============================================================
// GET /api/tasks - List tasks with recurring expansion
// ============================================================
router.get(
    "/",
    clerkAuth,
    requireAdmin,
    async (req: AdminAuthRequest, res: Response) => {
        try {
            const employee = await getEmployeeFromRequest(req);
            if (!employee) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            // Parse query params
            const start = req.query.start
                ? new Date(req.query.start as string)
                : new Date(new Date().setDate(1)); // First day of current month

            const end = req.query.end
                ? new Date(req.query.end as string)
                : new Date(new Date().setMonth(new Date().getMonth() + 1, 0)); // Last day of current month

            const assignedTo = req.query.assignedTo as string | undefined;
            const view = (req.query.view as string) || "calendar";

            // Build filter
            let assignedToId: number | undefined;

            if (assignedTo === "me") {
                assignedToId = employee.id;
            } else if (assignedTo && assignedTo !== "all" && employee.role === Role.ADMIN) {
                assignedToId = parseInt(assignedTo, 10);
            } else if (employee.role !== Role.ADMIN) {
                // Non-admins can only see their own tasks
                assignedToId = employee.id;
            }

            // Fetch tasks
            const whereClause: any = {};
            if (assignedToId) {
                whereClause.assignedToId = assignedToId;
            }

            // For calendar view, get tasks that might appear in the date range
            if (view === "calendar") {
                whereClause.OR = [
                    { startAt: { gte: start, lte: end } },
                    { dueAt: { gte: start, lte: end } },
                    { repeatRule: { not: RepeatRule.NONE } }, // Include recurring tasks
                ];
            }

            const tasks = await prisma.task.findMany({
                where: whereClause,
                include: {
                    assignedTo: {
                        select: { id: true, fullName: true, email: true },
                    },
                    createdBy: {
                        select: { id: true, fullName: true, email: true },
                    },
                    completions: {
                        select: { id: true, occurrenceDate: true, completedAt: true },
                    },
                },
                orderBy: { startAt: "asc" },
            });

            // For calendar view, expand recurring tasks
            if (view === "calendar") {
                const events = expandRecurringTasks(tasks as TaskWithRelations[], start, end);
                const eventsWithCompletions = await markCompletedOccurrences(events, assignedToId);
                return res.json(eventsWithCompletions);
            }

            // For list view, return raw tasks
            return res.json(tasks);
        } catch (err: any) {
            console.error("[GET /api/tasks] Error:", err.message);
            return res.status(500).json({ error: "Failed to fetch tasks" });
        }
    }
);

// ============================================================
// POST /api/tasks - Create task (ADMIN only)
// ============================================================
router.post(
    "/",
    clerkAuth,
    requireRole(Role.ADMIN),
    async (req: AdminAuthRequest, res: Response) => {
        try {
            const employee = await getEmployeeFromRequest(req);
            if (!employee) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            // Validate body
            const validation = createTaskSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    error: "Validation failed",
                    details: validation.error.flatten().fieldErrors,
                });
            }

            const data = validation.data;

            // Verify assignee exists
            const assignee = await prisma.employee.findUnique({
                where: { id: data.assignedToId },
            });

            if (!assignee) {
                return res.status(400).json({ error: "Assignee not found" });
            }

            // Create task
            const task = await prisma.task.create({
                data: {
                    title: data.title,
                    description: data.description,
                    type: data.type as TaskType,
                    category: data.category,
                    priority: data.priority,
                    startAt: data.startAt ? new Date(data.startAt) : null,
                    endAt: data.endAt ? new Date(data.endAt) : null,
                    dueAt: data.dueAt ? new Date(data.dueAt) : null,
                    repeatRule: data.repeatRule as RepeatRule,
                    assignedToId: data.assignedToId,
                    createdById: employee.id,
                },
                include: {
                    assignedTo: {
                        select: { id: true, fullName: true, email: true },
                    },
                    createdBy: {
                        select: { id: true, fullName: true, email: true },
                    },
                },
            });

            return res.status(201).json(task);
        } catch (err: any) {
            console.error("[POST /api/tasks] Error:", err.message);
            return res.status(500).json({ error: "Failed to create task" });
        }
    }
);

// ============================================================
// GET /api/tasks/:id - Get single task
// ============================================================
router.get(
    "/:id",
    clerkAuth,
    requireAdmin,
    async (req: AdminAuthRequest, res: Response) => {
        try {
            const employee = await getEmployeeFromRequest(req);
            if (!employee) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const task = await prisma.task.findUnique({
                where: { id: req.params.id },
                include: {
                    assignedTo: {
                        select: { id: true, fullName: true, email: true },
                    },
                    createdBy: {
                        select: { id: true, fullName: true, email: true },
                    },
                    completions: {
                        orderBy: { completedAt: "desc" },
                    },
                },
            });

            if (!task) {
                return res.status(404).json({ error: "Task not found" });
            }

            // Check access: admin or assignee
            if (employee.role !== Role.ADMIN && task.assignedToId !== employee.id) {
                return res.status(403).json({ error: "Access denied" });
            }

            return res.json(task);
        } catch (err: any) {
            console.error("[GET /api/tasks/:id] Error:", err.message);
            return res.status(500).json({ error: "Failed to fetch task" });
        }
    }
);

// ============================================================
// PATCH /api/tasks/:id - Update task (ADMIN only)
// ============================================================
router.patch(
    "/:id",
    clerkAuth,
    requireRole(Role.ADMIN),
    async (req: AdminAuthRequest, res: Response) => {
        try {
            // Validate body
            const validation = updateTaskSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    error: "Validation failed",
                    details: validation.error.flatten().fieldErrors,
                });
            }

            const data = validation.data;

            // Check if task exists
            const existing = await prisma.task.findUnique({
                where: { id: req.params.id },
            });

            if (!existing) {
                return res.status(404).json({ error: "Task not found" });
            }

            // Verify assignee if changing
            if (data.assignedToId) {
                const assignee = await prisma.employee.findUnique({
                    where: { id: data.assignedToId },
                });
                if (!assignee) {
                    return res.status(400).json({ error: "Assignee not found" });
                }
            }

            // Update task
            const updateData: any = {};
            if (data.title !== undefined) updateData.title = data.title;
            if (data.description !== undefined) updateData.description = data.description;
            if (data.type !== undefined) updateData.type = data.type as TaskType;
            if (data.category !== undefined) updateData.category = data.category;
            if (data.priority !== undefined) updateData.priority = data.priority;
            if (data.status !== undefined) updateData.status = data.status as TaskStatus;
            if (data.startAt !== undefined) updateData.startAt = data.startAt ? new Date(data.startAt) : null;
            if (data.endAt !== undefined) updateData.endAt = data.endAt ? new Date(data.endAt) : null;
            if (data.dueAt !== undefined) updateData.dueAt = data.dueAt ? new Date(data.dueAt) : null;
            if (data.repeatRule !== undefined) updateData.repeatRule = data.repeatRule as RepeatRule;
            if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId;

            const task = await prisma.task.update({
                where: { id: req.params.id },
                data: updateData,
                include: {
                    assignedTo: {
                        select: { id: true, fullName: true, email: true },
                    },
                    createdBy: {
                        select: { id: true, fullName: true, email: true },
                    },
                },
            });

            return res.json(task);
        } catch (err: any) {
            console.error("[PATCH /api/tasks/:id] Error:", err.message);
            return res.status(500).json({ error: "Failed to update task" });
        }
    }
);

// ============================================================
// DELETE /api/tasks/:id - Delete task (ADMIN only)
// ============================================================
router.delete(
    "/:id",
    clerkAuth,
    requireRole(Role.ADMIN),
    async (req: AdminAuthRequest, res: Response) => {
        try {
            // Check if task exists
            const existing = await prisma.task.findUnique({
                where: { id: req.params.id },
            });

            if (!existing) {
                return res.status(404).json({ error: "Task not found" });
            }

            await prisma.task.delete({
                where: { id: req.params.id },
            });

            return res.json({ success: true });
        } catch (err: any) {
            console.error("[DELETE /api/tasks/:id] Error:", err.message);
            return res.status(500).json({ error: "Failed to delete task" });
        }
    }
);

// ============================================================
// PATCH /api/tasks/:id/status - Update status (admin or assignee)
// ============================================================
router.patch(
    "/:id/status",
    clerkAuth,
    requireAdmin,
    async (req: AdminAuthRequest, res: Response) => {
        try {
            const employee = await getEmployeeFromRequest(req);
            if (!employee) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            // Validate body
            const validation = updateStatusSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    error: "Validation failed",
                    details: validation.error.flatten().fieldErrors,
                });
            }

            // Get task
            const task = await prisma.task.findUnique({
                where: { id: req.params.id },
            });

            if (!task) {
                return res.status(404).json({ error: "Task not found" });
            }

            // Check access: admin or assignee
            if (employee.role !== Role.ADMIN && task.assignedToId !== employee.id) {
                return res.status(403).json({ error: "Access denied" });
            }

            // Update status
            const updatedTask = await prisma.task.update({
                where: { id: req.params.id },
                data: { status: validation.data.status as TaskStatus },
                include: {
                    assignedTo: {
                        select: { id: true, fullName: true, email: true },
                    },
                },
            });

            return res.json(updatedTask);
        } catch (err: any) {
            console.error("[PATCH /api/tasks/:id/status] Error:", err.message);
            return res.status(500).json({ error: "Failed to update task status" });
        }
    }
);

// ============================================================
// POST /api/tasks/:id/complete - Submit completion report (assignee only)
// ============================================================
router.post(
    "/:id/complete",
    clerkAuth,
    requireAdmin,
    async (req: AdminAuthRequest, res: Response) => {
        try {
            const employee = await getEmployeeFromRequest(req);
            if (!employee) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            // Validate body
            const validation = completeTaskSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    error: "Validation failed",
                    details: validation.error.flatten().fieldErrors,
                });
            }

            const data = validation.data;

            // Get task
            const task = await prisma.task.findUnique({
                where: { id: req.params.id },
            });

            if (!task) {
                return res.status(404).json({ error: "Task not found" });
            }

            // Only assignee can complete the task
            if (task.assignedToId !== employee.id) {
                return res.status(403).json({
                    error: "Only the assigned employee can complete this task",
                });
            }

            // Parse occurrence date and normalize to start of day
            const occurrenceDate = new Date(data.occurrenceDate);
            occurrenceDate.setUTCHours(0, 0, 0, 0);

            // Check for duplicate completion
            const existingCompletion = await prisma.taskCompletion.findUnique({
                where: {
                    taskId_completedById_occurrenceDate: {
                        taskId: task.id,
                        completedById: employee.id,
                        occurrenceDate: occurrenceDate,
                    },
                },
            });

            if (existingCompletion) {
                return res.status(400).json({
                    error: "This task occurrence has already been completed",
                });
            }

            // Create completion
            const completion = await prisma.taskCompletion.create({
                data: {
                    taskId: task.id,
                    completedById: employee.id,
                    occurrenceDate: occurrenceDate,
                    reportText: data.reportText,
                    timeSpentMin: data.timeSpentMin,
                    blockers: data.blockers,
                },
                include: {
                    task: {
                        select: { id: true, title: true },
                    },
                    completedBy: {
                        select: { id: true, fullName: true },
                    },
                },
            });

            // For non-recurring tasks, also update the task status to COMPLETED
            if (task.repeatRule === RepeatRule.NONE) {
                await prisma.task.update({
                    where: { id: task.id },
                    data: { status: TaskStatus.COMPLETED },
                });
            }

            return res.status(201).json(completion);
        } catch (err: any) {
            console.error("[POST /api/tasks/:id/complete] Error:", err.message);
            return res.status(500).json({ error: "Failed to complete task" });
        }
    }
);

// ============================================================
// GET /api/tasks/employees - Get list of employees for assignment dropdown
// ============================================================
router.get(
    "/employees/list",
    clerkAuth,
    requireRole(Role.ADMIN),
    async (_req: AdminAuthRequest, res: Response) => {
        try {
            const employees = await prisma.employee.findMany({
                where: { isActive: true },
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    role: true,
                },
                orderBy: { fullName: "asc" },
            });

            return res.json(employees);
        } catch (err: any) {
            console.error("[GET /api/tasks/employees/list] Error:", err.message);
            return res.status(500).json({ error: "Failed to fetch employees" });
        }
    }
);

export default router;
