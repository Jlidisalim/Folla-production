/**
 * CompleteTaskModal Component
 *
 * Modal for employees to submit completion reports.
 */

import { useState, useEffect } from "react";
import { X, CheckCircle, Loader2 } from "lucide-react";
import { useAuthenticatedApi } from "@/lib/api";
import { CalendarEvent, TaskCompletionFormData, TASK_TYPE_LABELS } from "./types";

interface CompleteTaskModalProps {
    open: boolean;
    event: CalendarEvent | null;
    onClose: () => void;
    onCompleted: () => void;
}

export default function CompleteTaskModal({
    open,
    event,
    onClose,
    onCompleted,
}: CompleteTaskModalProps) {
    const { authApi } = useAuthenticatedApi();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState<TaskCompletionFormData>({
        occurrenceDate: "",
        reportText: "",
        timeSpentMin: undefined,
        blockers: "",
    });

    // Reset form when modal opens with new event
    useEffect(() => {
        if (open && event) {
            setForm({
                occurrenceDate: event.extendedProps.occurrenceDate,
                reportText: "",
                timeSpentMin: undefined,
                blockers: "",
            });
            setError(null);
        }
    }, [open, event]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!form.reportText.trim()) {
            setError("Le rapport de complétion est requis");
            return;
        }

        if (!event) return;

        setLoading(true);

        try {
            const api = await authApi();
            if (!api) {
                setError("Non authentifié");
                return;
            }

            await api.post(`/api/tasks/${event.extendedProps.taskId}/complete`, {
                occurrenceDate: form.occurrenceDate,
                reportText: form.reportText,
                timeSpentMin: form.timeSpentMin || undefined,
                blockers: form.blockers || undefined,
            });

            onCompleted();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || "Échec de la soumission");
        } finally {
            setLoading(false);
        }
    };

    if (!open || !event) return null;

    const occurrenceDate = new Date(event.extendedProps.occurrenceDate);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl m-4">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold">Compléter la tâche</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Task info */}
                <div className="px-6 py-4 bg-gray-50 border-b">
                    <h3 className="font-medium text-gray-900">{event.title}</h3>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                            {TASK_TYPE_LABELS[event.extendedProps.type]}
                        </span>
                        <span>
                            {occurrenceDate.toLocaleDateString("fr-FR", {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                            })}
                        </span>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Error message */}
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Report text (required) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Rapport de complétion *
                        </label>
                        <textarea
                            value={form.reportText}
                            onChange={(e) => setForm({ ...form, reportText: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                            rows={4}
                            placeholder="Décrivez ce que vous avez accompli..."
                            required
                        />
                    </div>

                    {/* Time spent (optional) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Temps passé (minutes)
                        </label>
                        <input
                            type="number"
                            value={form.timeSpentMin || ""}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    timeSpentMin: e.target.value
                                        ? parseInt(e.target.value)
                                        : undefined,
                                })
                            }
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            placeholder="Ex: 45"
                            min={1}
                        />
                    </div>

                    {/* Blockers (optional) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Blocages rencontrés
                        </label>
                        <textarea
                            value={form.blockers || ""}
                            onChange={(e) => setForm({ ...form, blockers: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                            rows={2}
                            placeholder="Décrivez les difficultés ou blocages rencontrés (optionnel)..."
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <CheckCircle className="h-4 w-4" />
                            )}
                            Terminer
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
