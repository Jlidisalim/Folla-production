/**
 * TaskCard Component
 *
 * Displays a task card with type badge, title, status, and action buttons.
 * Used in the calendar sidebar to show selected day's tasks.
 */

import { Clock, CheckCircle, User, Calendar, ChevronRight } from "lucide-react";
import {
    CalendarEvent,
    TASK_TYPE_COLORS,
    TASK_TYPE_LABELS,
    TASK_STATUS_COLORS,
    TASK_STATUS_LABELS,
    PRIORITY_COLORS,
    PRIORITY_LABELS,
} from "./types";

interface TaskCardProps {
    event: CalendarEvent;
    isAdmin: boolean;
    currentUserId: number;
    onComplete?: (event: CalendarEvent) => void;
    onEdit?: (event: CalendarEvent) => void;
    onClick?: (event: CalendarEvent) => void;
}

export default function TaskCard({
    event,
    isAdmin,
    currentUserId,
    onComplete,
    onEdit,
    onClick,
}: TaskCardProps) {
    const { extendedProps } = event;
    const typeColors = TASK_TYPE_COLORS[extendedProps.type];
    const statusColors = TASK_STATUS_COLORS[extendedProps.status];
    const isAssignedToMe = extendedProps.assignedToId === currentUserId;
    const isCompleted = extendedProps.status === "COMPLETED";
    const canComplete = isAssignedToMe && !isCompleted && !isAdmin;

    // Format dates
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return date.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const startTime = formatDate(event.start);
    const dueDate = extendedProps.dueAt
        ? new Date(extendedProps.dueAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
        })
        : null;

    return (
        <div
            className={`bg-white rounded-lg border shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer ${isCompleted ? "opacity-60" : ""
                }`}
            onClick={() => onClick?.(event)}
        >
            {/* Header with type badge and checkbox */}
            <div className="flex items-start gap-3">
                {/* Type badge */}
                <span
                    className={`px-2 py-1 rounded text-xs font-medium ${typeColors.bg} ${typeColors.text}`}
                >
                    {TASK_TYPE_LABELS[extendedProps.type]}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{event.title}</h4>

                    {/* Assigned to */}
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                        <User className="h-3.5 w-3.5" />
                        <span className="truncate">{extendedProps.assignedToName}</span>
                    </div>
                </div>

                {/* Chevron for details */}
                <ChevronRight className="h-5 w-5 text-gray-400" />
            </div>

            {/* Details row */}
            <div className="flex items-center gap-4 mt-3 text-sm">
                {/* Status badge */}
                <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors.bg} ${statusColors.text}`}
                >
                    {TASK_STATUS_LABELS[extendedProps.status]}
                </span>

                {/* Time if available */}
                {startTime && (
                    <div className="flex items-center gap-1 text-gray-500">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{startTime}</span>
                    </div>
                )}

                {/* Due date */}
                {dueDate && (
                    <div className="flex items-center gap-1 text-gray-500">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{dueDate}</span>
                    </div>
                )}

                {/* Priority indicator */}
                <span className={`text-xs ${PRIORITY_COLORS[extendedProps.priority]}`}>
                    ● {PRIORITY_LABELS[extendedProps.priority]}
                </span>
            </div>

            {/* Recurring indicator */}
            {extendedProps.isRecurring && (
                <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                    <span className="w-2 h-2 bg-blue-400 rounded-full" />
                    Tâche récurrente
                </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                {/* Complete button for managers */}
                {canComplete && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onComplete?.(event);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                    >
                        <CheckCircle className="h-4 w-4" />
                        Marquer terminé
                    </button>
                )}

                {/* Edit button for admin */}
                {isAdmin && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit?.(event);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 text-sm rounded-md border hover:bg-gray-50 transition-colors"
                    >
                        Modifier
                    </button>
                )}
            </div>
        </div>
    );
}
