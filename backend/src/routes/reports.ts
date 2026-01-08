/**
 * Reports Routes
 *
 * Admin-only endpoints for viewing task completion reports.
 *
 * Endpoints:
 * - GET /api/reports/completions - Get completion reports
 */

import { Router, Response } from "express";
import { PrismaClient, Role } from "@prisma/client";
import { clerkAuth } from "../middleware/clerkAuth";
import { requireRole, AdminAuthRequest } from "../middleware/requireAdmin";

const router = Router();
const prisma = new PrismaClient();

// ============================================================
// GET /api/reports/completions - Get completion reports (ADMIN only)
// ============================================================
router.get(
    "/completions",
    clerkAuth,
    requireRole(Role.ADMIN),
    async (req: AdminAuthRequest, res: Response) => {
        try {
            // Parse query params
            const start = req.query.start
                ? new Date(req.query.start as string)
                : new Date(new Date().setDate(new Date().getDate() - 30)); // Last 30 days

            const end = req.query.end
                ? new Date(req.query.end as string)
                : new Date();

            const assignedTo = req.query.assignedTo as string | undefined;

            // Build filter
            const whereClause: any = {
                completedAt: {
                    gte: start,
                    lte: end,
                },
            };

            if (assignedTo && assignedTo !== "all") {
                whereClause.completedById = parseInt(assignedTo, 10);
            }

            // Fetch completions
            const completions = await prisma.taskCompletion.findMany({
                where: whereClause,
                include: {
                    task: {
                        select: {
                            id: true,
                            title: true,
                            type: true,
                            category: true,
                        },
                    },
                    completedBy: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            role: true,
                        },
                    },
                },
                orderBy: [
                    { completedAt: "desc" },
                ],
            });

            // Group by employee -> date -> tasks
            const grouped: Record<
                number,
                {
                    employee: {
                        id: number;
                        fullName: string;
                        email: string | null;
                        role: Role;
                    };
                    dates: Record<
                        string,
                        Array<{
                            completionId: string;
                            taskId: string;
                            taskTitle: string;
                            taskType: string;
                            taskCategory: string | null;
                            occurrenceDate: string;
                            completedAt: string;
                            reportText: string;
                            timeSpentMin: number | null;
                            blockers: string | null;
                        }>
                    >;
                }
            > = {};

            for (const completion of completions) {
                const employeeId = completion.completedById;
                const dateKey = completion.occurrenceDate.toISOString().split("T")[0];

                if (!grouped[employeeId]) {
                    grouped[employeeId] = {
                        employee: completion.completedBy,
                        dates: {},
                    };
                }

                if (!grouped[employeeId].dates[dateKey]) {
                    grouped[employeeId].dates[dateKey] = [];
                }

                grouped[employeeId].dates[dateKey].push({
                    completionId: completion.id,
                    taskId: completion.task.id,
                    taskTitle: completion.task.title,
                    taskType: completion.task.type,
                    taskCategory: completion.task.category,
                    occurrenceDate: completion.occurrenceDate.toISOString(),
                    completedAt: completion.completedAt.toISOString(),
                    reportText: completion.reportText,
                    timeSpentMin: completion.timeSpentMin,
                    blockers: completion.blockers,
                });
            }

            // Convert to array format
            const result = Object.values(grouped).map((entry) => ({
                employee: entry.employee,
                dates: Object.entries(entry.dates).map(([date, tasks]) => ({
                    date,
                    tasks,
                    totalTimeSpent: tasks.reduce(
                        (acc, t) => acc + (t.timeSpentMin || 0),
                        0
                    ),
                })),
            }));

            return res.json({
                range: { start: start.toISOString(), end: end.toISOString() },
                data: result,
                totalCompletions: completions.length,
            });
        } catch (err: any) {
            console.error("[GET /api/reports/completions] Error:", err.message);
            return res.status(500).json({ error: "Failed to fetch completion reports" });
        }
    }
);

export default router;
