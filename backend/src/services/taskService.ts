/**
 * Task Service
 *
 * Service functions for task management including:
 * - Recurring task expansion for calendar views
 * - Task formatting for FullCalendar
 * - Completion checking
 */

import { PrismaClient, Task, RepeatRule, TaskStatus } from "@prisma/client";

const prisma = new PrismaClient();

// Type for task with relations
export interface TaskWithRelations extends Task {
    assignedTo: {
        id: number;
        fullName: string;
        email: string | null;
    };
    createdBy: {
        id: number;
        fullName: string;
        email: string | null;
    };
    completions?: Array<{
        id: string;
        occurrenceDate: Date;
        completedAt: Date;
    }>;
}

// FullCalendar event format
export interface CalendarEvent {
    id: string;
    title: string;
    start: string;
    end?: string;
    extendedProps: {
        status: TaskStatus;
        type: string;
        category: string | null;
        dueAt: string | null;
        priority: number;
        assignedToId: number;
        assignedToName: string;
        isRecurring: boolean;
        occurrenceDate: string;
        description: string | null;
        taskId: string;
    };
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Add weeks to a date
 */
function addWeeks(date: Date, weeks: number): Date {
    return addDays(date, weeks * 7);
}

/**
 * Add months to a date
 */
function addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}

/**
 * Get the start of day for a date in UTC
 */
function startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setUTCHours(0, 0, 0, 0);
    return result;
}

/**
 * Check if two dates are the same day
 */
function isSameDay(date1: Date, date2: Date): boolean {
    return (
        date1.getUTCFullYear() === date2.getUTCFullYear() &&
        date1.getUTCMonth() === date2.getUTCMonth() &&
        date1.getUTCDate() === date2.getUTCDate()
    );
}

/**
 * Expand a single recurring task into occurrences within a date range
 */
export function expandRecurringTask(
    task: TaskWithRelations,
    rangeStart: Date,
    rangeEnd: Date
): CalendarEvent[] {
    const events: CalendarEvent[] = [];

    // Task must have a startAt date to generate occurrences
    const taskStart = task.startAt;
    if (!taskStart) {
        // Non-recurring task without startAt - show at dueAt or skip
        if (task.dueAt && task.dueAt >= rangeStart && task.dueAt <= rangeEnd) {
            events.push(formatTaskAsEvent(task, task.dueAt));
        }
        return events;
    }

    // If not recurring, just return single event if in range
    if (task.repeatRule === RepeatRule.NONE) {
        if (taskStart >= rangeStart && taskStart <= rangeEnd) {
            events.push(formatTaskAsEvent(task, taskStart));
        }
        return events;
    }

    // Generate recurring occurrences
    let currentDate = new Date(taskStart);

    // Start from the task's start date or the range start, whichever is later
    while (currentDate < rangeStart) {
        currentDate = getNextOccurrence(currentDate, task.repeatRule);
    }

    // Generate occurrences until range end (max 365 to prevent infinite loops)
    let count = 0;
    const maxCount = 365;

    while (currentDate <= rangeEnd && count < maxCount) {
        events.push(formatTaskAsEvent(task, currentDate));
        currentDate = getNextOccurrence(currentDate, task.repeatRule);
        count++;
    }

    return events;
}

/**
 * Get the next occurrence date based on repeat rule
 */
function getNextOccurrence(date: Date, repeatRule: RepeatRule): Date {
    switch (repeatRule) {
        case RepeatRule.DAILY:
            return addDays(date, 1);
        case RepeatRule.WEEKLY:
            return addWeeks(date, 1);
        case RepeatRule.MONTHLY:
            return addMonths(date, 1);
        default:
            return addDays(date, 1); // Fallback
    }
}

/**
 * Format a task as a FullCalendar event
 */
export function formatTaskAsEvent(
    task: TaskWithRelations,
    occurrenceDate: Date
): CalendarEvent {
    const isRecurring = task.repeatRule !== RepeatRule.NONE;

    // For recurring tasks, create unique ID per occurrence
    const eventId = isRecurring
        ? `${task.id}_${occurrenceDate.toISOString().split("T")[0]}`
        : task.id;

    return {
        id: eventId,
        title: task.title,
        start: occurrenceDate.toISOString(),
        end: task.endAt?.toISOString(),
        extendedProps: {
            status: task.status,
            type: task.type,
            category: task.category,
            dueAt: task.dueAt?.toISOString() ?? null,
            priority: task.priority,
            assignedToId: task.assignedToId,
            assignedToName: task.assignedTo?.fullName ?? "",
            isRecurring,
            occurrenceDate: occurrenceDate.toISOString(),
            description: task.description,
            taskId: task.id,
        },
    };
}

/**
 * Expand all recurring tasks into calendar events
 */
export function expandRecurringTasks(
    tasks: TaskWithRelations[],
    rangeStart: Date,
    rangeEnd: Date
): CalendarEvent[] {
    const allEvents: CalendarEvent[] = [];

    for (const task of tasks) {
        const taskEvents = expandRecurringTask(task, rangeStart, rangeEnd);
        allEvents.push(...taskEvents);
    }

    return allEvents;
}

/**
 * Check if a task occurrence has been completed
 */
export async function isTaskCompletedForDate(
    taskId: string,
    occurrenceDate: Date,
    completedById?: number
): Promise<boolean> {
    const whereClause: any = {
        taskId,
        occurrenceDate: startOfDay(occurrenceDate),
    };

    if (completedById) {
        whereClause.completedById = completedById;
    }

    const completion = await prisma.taskCompletion.findFirst({
        where: whereClause,
    });

    return !!completion;
}

/**
 * Mark occurrences that have been completed
 * Updates the status in the event's extendedProps if completion exists
 */
export async function markCompletedOccurrences(
    events: CalendarEvent[],
    assignedToId?: number
): Promise<CalendarEvent[]> {
    // Get all task IDs and occurrence dates
    const taskIds = [...new Set(events.map((e) => e.extendedProps.taskId))];

    // Fetch all completions for these tasks
    const completions = await prisma.taskCompletion.findMany({
        where: {
            taskId: { in: taskIds },
            ...(assignedToId ? { completedById: assignedToId } : {}),
        },
        select: {
            taskId: true,
            occurrenceDate: true,
        },
    });

    // Create a set for quick lookup
    const completionSet = new Set(
        completions.map((c) => `${c.taskId}_${c.occurrenceDate.toISOString().split("T")[0]}`)
    );

    // Update events with completion status
    return events.map((event) => {
        const occurrenceKey = `${event.extendedProps.taskId}_${event.extendedProps.occurrenceDate.split("T")[0]}`;

        if (completionSet.has(occurrenceKey)) {
            return {
                ...event,
                extendedProps: {
                    ...event.extendedProps,
                    status: TaskStatus.COMPLETED,
                },
            };
        }

        return event;
    });
}

export default {
    expandRecurringTask,
    expandRecurringTasks,
    formatTaskAsEvent,
    isTaskCompletedForDate,
    markCompletedOccurrences,
};
