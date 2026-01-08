/**
 * EditTaskModal Component
 *
 * Modal for admin to edit existing tasks.
 */

import { useState, useEffect } from "react";
import { X, Save, Loader2, Trash2 } from "lucide-react";
import { useAuthenticatedApi } from "@/lib/api";
import {
    Task,
    TaskFormData,
    TaskType,
    RepeatRule,
    TaskStatus,
    Employee,
    TASK_TYPE_LABELS,
    TASK_STATUS_LABELS,
    REPEAT_RULE_LABELS,
    CATEGORY_OPTIONS,
    PRIORITY_LABELS,
} from "./types";

interface EditTaskModalProps {
    open: boolean;
    task: Task | null;
    onClose: () => void;
    onUpdated: () => void;
    onDeleted?: () => void;
}

export default function EditTaskModal({
    open,
    task,
    onClose,
    onUpdated,
    onDeleted,
}: EditTaskModalProps) {
    const { authApi } = useAuthenticatedApi();
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const [form, setForm] = useState<TaskFormData & { status: TaskStatus }>({
        title: "",
        description: "",
        type: "TASK",
        category: "",
        priority: 2,
        startAt: "",
        endAt: "",
        dueAt: "",
        repeatRule: "NONE",
        assignedToId: 0,
        status: "TODO",
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

    // Populate form when task changes
    useEffect(() => {
        if (open && task) {
            setForm({
                title: task.title,
                description: task.description || "",
                type: task.type,
                category: task.category || "",
                priority: task.priority,
                startAt: task.startAt ? task.startAt.slice(0, 16) : "",
                endAt: task.endAt ? task.endAt.slice(0, 16) : "",
                dueAt: task.dueAt ? task.dueAt.slice(0, 16) : "",
                repeatRule: task.repeatRule,
                assignedToId: task.assignedToId,
                status: task.status,
            });
            setError(null);
            setConfirmDelete(false);
        }
    }, [open, task]);

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
        if (!task) return;

        setLoading(true);

        try {
            const api = await authApi();
            if (!api) {
                setError("Non authentifié");
                return;
            }

            const payload = {
                title: form.title,
                description: form.description || null,
                type: form.type,
                category: form.category || null,
                priority: form.priority,
                status: form.status,
                startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
                endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
                dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
                repeatRule: form.repeatRule,
                assignedToId: form.assignedToId,
            };

            await api.patch(`/api/tasks/${task.id}`, payload);
            onUpdated();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || "Échec de la modification");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!task) return;

        setDeleting(true);
        try {
            const api = await authApi();
            if (!api) {
                setError("Non authentifié");
                return;
            }

            await api.delete(`/api/tasks/${task.id}`);
            onDeleted?.();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || "Échec de la suppression");
        } finally {
            setDeleting(false);
        }
    };

    if (!open || !task) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl m-4">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold">Modifier la tâche</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                        />
                    </div>

                    {/* Type, Priority, Status row */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Type
                            </label>
                            <select
                                value={form.type}
                                onChange={(e) => setForm({ ...form, type: e.target.value as TaskType })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            >
                                {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Priorité
                            </label>
                            <select
                                value={form.priority}
                                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            >
                                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Statut
                            </label>
                            <select
                                value={form.status}
                                onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            >
                                {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
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
                                <option key={cat} value={cat}>{cat}</option>
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
                            onChange={(e) => setForm({ ...form, assignedToId: parseInt(e.target.value) })}
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
                                Date limite
                            </label>
                            <input
                                type="datetime-local"
                                value={form.dueAt || ""}
                                onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Repeat rule */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Récurrence
                        </label>
                        <select
                            value={form.repeatRule}
                            onChange={(e) => setForm({ ...form, repeatRule: e.target.value as RepeatRule })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            {Object.entries(REPEAT_RULE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-4 border-t">
                        {/* Delete button */}
                        <div>
                            {!confirmDelete ? (
                                <button
                                    type="button"
                                    onClick={() => setConfirmDelete(true)}
                                    className="flex items-center gap-1.5 px-3 py-2 text-red-600 text-sm rounded-md hover:bg-red-50 transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Supprimer
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                                    >
                                        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDelete(false)}
                                        className="px-3 py-2 text-gray-600 text-sm"
                                    >
                                        Annuler
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Save buttons */}
                        <div className="flex gap-3">
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
                                    <Save className="h-4 w-4" />
                                )}
                                Enregistrer
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
