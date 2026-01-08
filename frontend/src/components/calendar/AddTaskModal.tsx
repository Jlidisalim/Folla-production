/**
 * AddTaskModal Component
 *
 * Modal for admin to create new tasks.
 */

import { useState, useEffect } from "react";
import { X, Plus, Loader2 } from "lucide-react";
import { useAuthenticatedApi } from "@/lib/api";
import {
    TaskFormData,
    TaskType,
    RepeatRule,
    Employee,
    TASK_TYPE_LABELS,
    REPEAT_RULE_LABELS,
    CATEGORY_OPTIONS,
    PRIORITY_LABELS,
} from "./types";

interface AddTaskModalProps {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
    defaultDate?: string;
}

export default function AddTaskModal({
    open,
    onClose,
    onCreated,
    defaultDate,
}: AddTaskModalProps) {
    const { authApi } = useAuthenticatedApi();
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState<TaskFormData>({
        title: "",
        description: "",
        type: "TASK",
        category: "",
        priority: 2,
        startAt: defaultDate || "",
        endAt: "",
        dueAt: "",
        repeatRule: "NONE",
        assignedToId: 0,
    });

    // Fetch employees for assignment dropdown
    useEffect(() => {
        if (!open) return;

        const fetchEmployees = async () => {
            const api = await authApi();
            if (!api) return;

            try {
                const res = await api.get("/api/tasks/employees/list");
                setEmployees(res.data);
            } catch (err) {
                console.error("Failed to fetch employees:", err);
            }
        };

        fetchEmployees();
    }, [open, authApi]);

    // Reset form when modal opens
    useEffect(() => {
        if (open) {
            setForm({
                title: "",
                description: "",
                type: "TASK",
                category: "",
                priority: 2,
                startAt: defaultDate || "",
                endAt: "",
                dueAt: "",
                repeatRule: "NONE",
                assignedToId: 0,
            });
            setError(null);
        }
    }, [open, defaultDate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!form.title.trim()) {
            setError("Le titre est requis");
            return;
        }
        if (!form.assignedToId) {
            setError("Veuillez sélectionner un assigné");
            return;
        }

        setLoading(true);

        try {
            const api = await authApi();
            if (!api) {
                setError("Non authentifié");
                return;
            }

            // Format dates to ISO if provided
            const payload = {
                ...form,
                startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
                endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
                dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
            };

            await api.post("/api/tasks", payload);
            onCreated();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || "Échec de la création");
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl m-4">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold">Nouvelle tâche</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Error message */}
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Titre *
                        </label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Titre de la tâche"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            value={form.description || ""}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                            rows={3}
                            placeholder="Description optionnelle..."
                        />
                    </div>

                    {/* Type and Priority row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Type
                            </label>
                            <select
                                value={form.type}
                                onChange={(e) =>
                                    setForm({ ...form, type: e.target.value as TaskType })
                                }
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Priorité
                            </label>
                            <select
                                value={form.priority}
                                onChange={(e) =>
                                    setForm({ ...form, priority: parseInt(e.target.value) })
                                }
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Catégorie
                        </label>
                        <select
                            value={form.category || ""}
                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">-- Sélectionner --</option>
                            {CATEGORY_OPTIONS.map((cat) => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Assignee */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Assigné à *
                        </label>
                        <select
                            value={form.assignedToId || ""}
                            onChange={(e) =>
                                setForm({ ...form, assignedToId: parseInt(e.target.value) })
                            }
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">-- Sélectionner --</option>
                            {employees.map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.fullName} ({emp.role || "Employee"})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Date de début
                            </label>
                            <input
                                type="datetime-local"
                                value={form.startAt || ""}
                                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Date de fin
                            </label>
                            <input
                                type="datetime-local"
                                value={form.endAt || ""}
                                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Due date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Date limite (deadline)
                        </label>
                        <input
                            type="datetime-local"
                            value={form.dueAt || ""}
                            onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Repeat rule */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Récurrence
                        </label>
                        <select
                            value={form.repeatRule}
                            onChange={(e) =>
                                setForm({ ...form, repeatRule: e.target.value as RepeatRule })
                            }
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            {Object.entries(REPEAT_RULE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
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
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="h-4 w-4" />
                            )}
                            Créer
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
