/**
 * ViewTaskModal Component
 *
 * Modal to view all task details including completions history.
 */

import { useState, useEffect } from "react";
import { X, Calendar, Clock, User, Tag, CheckCircle, AlertCircle, Edit2 } from "lucide-react";
import { useAuthenticatedApi } from "@/lib/api";
import {
    Task,
    TaskCompletion,
    TASK_TYPE_COLORS,
    TASK_TYPE_LABELS,
    TASK_STATUS_COLORS,
    TASK_STATUS_LABELS,
    PRIORITY_COLORS,
    PRIORITY_LABELS,
    REPEAT_RULE_LABELS,
} from "./types";

interface ViewTaskModalProps {
    open: boolean;
    taskId: string | null;
    onClose: () => void;
    onEdit?: (task: Task) => void;
    isAdmin?: boolean;
}

export default function ViewTaskModal({
    open,
    taskId,
    onClose,
    onEdit,
    isAdmin = false,
}: ViewTaskModalProps) {
    const { authApi } = useAuthenticatedApi();
    const [task, setTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch task details
    useEffect(() => {
        if (!open || !taskId) {
            setTask(null);
            return;
        }

        const fetchTask = async () => {
            setLoading(true);
            setError(null);

            try {
                const api = await authApi();
                if (!api) {
                    setError("Non authentifié");
                    return;
                }

                const res = await api.get(`/api/tasks/${taskId}`);
                setTask(res.data);
            } catch (err: any) {
                setError(err.response?.data?.error || "Échec du chargement");
            } finally {
                setLoading(false);
            }
        };

        fetchTask();
    }, [open, taskId, authApi]);

    if (!open) return null;

    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return "Non défini";
        return new Date(dateStr).toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatShortDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl m-4">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
                    <h2 className="text-lg font-semibold">Détails de la tâche</h2>
                    <div className="flex items-center gap-2">
                        {isAdmin && task && (
                            <button
                                onClick={() => onEdit?.(task)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 text-sm rounded-md hover:bg-blue-50 transition-colors"
                            >
                                <Edit2 className="h-4 w-4" />
                                Modifier
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <X className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-48 text-red-600">
                            <AlertCircle className="h-8 w-8 mb-2" />
                            <p>{error}</p>
                        </div>
                    ) : task ? (
                        <div className="space-y-6">
                            {/* Title and badges */}
                            <div>
                                <div className="flex items-start gap-3 mb-3">
                                    <span className={`px-2.5 py-1 rounded text-xs font-medium ${TASK_TYPE_COLORS[task.type].bg} ${TASK_TYPE_COLORS[task.type].text}`}>
                                        {TASK_TYPE_LABELS[task.type]}
                                    </span>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${TASK_STATUS_COLORS[task.status].bg} ${TASK_STATUS_COLORS[task.status].text}`}>
                                        {TASK_STATUS_LABELS[task.status]}
                                    </span>
                                    <span className={`text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>
                                        ● Priorité {PRIORITY_LABELS[task.priority]}
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">{task.title}</h3>
                            </div>

                            {/* Description */}
                            {task.description && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Description</h4>
                                    <p className="text-gray-600 whitespace-pre-wrap">{task.description}</p>
                                </div>
                            )}

                            {/* Details grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <User className="h-4 w-4 text-gray-400" />
                                    <span className="text-gray-500">Assigné à:</span>
                                    <span className="font-medium text-gray-900">{task.assignedTo?.fullName}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <User className="h-4 w-4 text-gray-400" />
                                    <span className="text-gray-500">Créé par:</span>
                                    <span className="font-medium text-gray-900">{task.createdBy?.fullName}</span>
                                </div>
                                {task.category && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Tag className="h-4 w-4 text-gray-400" />
                                        <span className="text-gray-500">Catégorie:</span>
                                        <span className="font-medium text-gray-900">{task.category}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-sm">
                                    <Clock className="h-4 w-4 text-gray-400" />
                                    <span className="text-gray-500">Récurrence:</span>
                                    <span className="font-medium text-gray-900">{REPEAT_RULE_LABELS[task.repeatRule]}</span>
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                <h4 className="text-sm font-semibold text-gray-700">Dates</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-blue-500" />
                                        <span className="text-gray-500">Début:</span>
                                        <span className="text-gray-900">{formatDate(task.startAt)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-green-500" />
                                        <span className="text-gray-500">Fin:</span>
                                        <span className="text-gray-900">{formatDate(task.endAt)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 col-span-2">
                                        <Calendar className="h-4 w-4 text-red-500" />
                                        <span className="text-gray-500">Date limite:</span>
                                        <span className="text-gray-900">{formatDate(task.dueAt)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Completions history */}
                            {task.completions && task.completions.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                        Historique des complétions ({task.completions.length})
                                    </h4>
                                    <div className="space-y-3 max-h-64 overflow-y-auto">
                                        {task.completions.map((completion: TaskCompletion) => (
                                            <div
                                                key={completion.id}
                                                className="border rounded-lg p-3 bg-green-50 border-green-200"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                                        <span className="text-sm font-medium text-green-800">
                                                            {completion.completedBy?.fullName || "Employé"}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-gray-500">
                                                        {formatShortDate(completion.completedAt)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-700 mb-2">{completion.reportText}</p>
                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                    {completion.timeSpentMin && (
                                                        <span>⏱ {completion.timeSpentMin} min</span>
                                                    )}
                                                    {completion.blockers && (
                                                        <span className="text-amber-600">⚠ Blocages signalés</span>
                                                    )}
                                                </div>
                                                {completion.blockers && (
                                                    <p className="text-xs text-amber-700 mt-1 bg-amber-50 p-2 rounded">
                                                        {completion.blockers}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Created/Updated timestamps */}
                            <div className="text-xs text-gray-400 pt-4 border-t">
                                <p>Créé le {formatShortDate(task.createdAt)}</p>
                                <p>Modifié le {formatShortDate(task.updatedAt)}</p>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
