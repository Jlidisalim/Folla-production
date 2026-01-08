/**
 * Task Types for Calendar Module
 */

export type TaskType = "CALL" | "MEETING" | "MILESTONE" | "TASK";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELED";
export type RepeatRule = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
export type UserRole = "ADMIN" | "PRODUCT_MANAGER" | "ORDER_MANAGER" | "CUSTOMER";

export interface Employee {
    id: number;
    fullName: string;
    email: string | null;
    role?: UserRole;
}

export interface Task {
    id: string;
    title: string;
    description?: string | null;
    type: TaskType;
    category?: string | null;
    priority: number;
    status: TaskStatus;
    startAt?: string | null;
    endAt?: string | null;
    dueAt?: string | null;
    repeatRule: RepeatRule;
    assignedToId: number;
    assignedTo: Employee;
    createdById: number;
    createdBy: Employee;
    completions?: TaskCompletion[];
    createdAt: string;
    updatedAt: string;
}

export interface TaskCompletion {
    id: string;
    taskId: string;
    completedById: number;
    completedBy?: Employee;
    occurrenceDate: string;
    completedAt: string;
    reportText: string;
    timeSpentMin?: number | null;
    blockers?: string | null;
}

// FullCalendar event format
export interface CalendarEvent {
    id: string;
    title: string;
    start: string;
    end?: string;
    extendedProps: {
        status: TaskStatus;
        type: TaskType;
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

// Form data for creating/editing tasks
export interface TaskFormData {
    title: string;
    description?: string;
    type: TaskType;
    category?: string;
    priority: number;
    startAt?: string;
    endAt?: string;
    dueAt?: string;
    repeatRule: RepeatRule;
    assignedToId: number;
}

// Task completion form data
export interface TaskCompletionFormData {
    occurrenceDate: string;
    reportText: string;
    timeSpentMin?: number;
    blockers?: string;
}

// Task type styling
export const TASK_TYPE_COLORS: Record<TaskType, { bg: string; text: string; border: string }> = {
    CALL: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200" },
    MEETING: { bg: "bg-green-50", text: "text-green-600", border: "border-green-200" },
    MILESTONE: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
    TASK: { bg: "bg-yellow-50", text: "text-yellow-600", border: "border-yellow-200" },
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
    CALL: "Appel",
    MEETING: "Réunion",
    MILESTONE: "Jalon",
    TASK: "Tâche",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, { bg: string; text: string }> = {
    TODO: { bg: "bg-gray-100", text: "text-gray-600" },
    IN_PROGRESS: { bg: "bg-blue-100", text: "text-blue-600" },
    COMPLETED: { bg: "bg-green-100", text: "text-green-600" },
    CANCELED: { bg: "bg-red-100", text: "text-red-600" },
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
    TODO: "À faire",
    IN_PROGRESS: "En cours",
    COMPLETED: "Terminé",
    CANCELED: "Annulé",
};

export const PRIORITY_LABELS: Record<number, string> = {
    1: "Haute",
    2: "Moyenne",
    3: "Basse",
};

export const PRIORITY_COLORS: Record<number, string> = {
    1: "text-red-600",
    2: "text-yellow-600",
    3: "text-green-600",
};

export const REPEAT_RULE_LABELS: Record<RepeatRule, string> = {
    NONE: "Aucune",
    DAILY: "Quotidien",
    WEEKLY: "Hebdomadaire",
    MONTHLY: "Mensuel",
};

export const CATEGORY_OPTIONS = [
    "Commandes",
    "Produits",
    "Marketing",
    "Clients",
    "Livraison",
    "Administration",
    "Autre",
];
