/**
 * TaskCalendarSection - Full calendar grid view with sidebar
 *
 * Features:
 * - Monthly calendar grid with tasks displayed on their dates
 * - Calendar/List view toggle
 * - Assignee filter dropdown
 * - Category filter
 * - Right sidebar showing selected date's tasks (desktop) or drawer (mobile)
 * - Fully responsive with mobile drawer
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Plus,
    Calendar as CalendarIcon,
    List,
    ChevronLeft,
    ChevronRight,
    RefreshCcw,
    User,
    X,
    ClipboardList,
} from "lucide-react";
import { useAuthenticatedApi } from "@/lib/api";
import {
    CalendarEvent,
    Task,
    Employee,
    TASK_TYPE_COLORS,
    TASK_TYPE_LABELS,
    TASK_STATUS_LABELS,
} from "./types";
import AddTaskModal from "./AddTaskModal";
import EditTaskModal from "./EditTaskModal";
import CompleteTaskModal from "./CompleteTaskModal";
import ViewTaskModal from "./ViewTaskModal";

interface TaskCalendarSectionProps {
    employees: Employee[];
}

const DAYS_FR = ["Samedi", "Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const MONTHS_FR = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

export default function TaskCalendarSection({ employees }: TaskCalendarSectionProps) {
    const { authApi, authGet } = useAuthenticatedApi();

    // State
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

    // Mobile drawer state
    const [isTasksOpen, setIsTasksOpen] = useState(false);

    // User info
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<number>(0);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    // Filters
    const [filterAssignee, setFilterAssignee] = useState<string>("all");
    const [filterCategory, setFilterCategory] = useState<string>("all");

    // Prevent body scroll when drawer is open
    useEffect(() => {
        if (isTasksOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isTasksOpen]);

    // Fetch user role
    useEffect(() => {
        const fetchUserRole = async () => {
            const { data } = await authGet<{ role: string; id: number; isActive: boolean }>(
                "/api/me/role"
            );
            if (data) {
                setIsAdmin(data.role === "ADMIN");
                setCurrentUserId(data.id);
            }
        };
        fetchUserRole();
    }, [authGet]);

    // Fetch tasks for current month
    const fetchTasks = useCallback(async () => {
        setLoading(true);

        try {
            const api = await authApi();
            if (!api) return;

            const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

            const params = new URLSearchParams({
                start: start.toISOString(),
                end: end.toISOString(),
                view: "calendar",
                assignedTo: filterAssignee,
            });

            const res = await api.get(`/api/tasks?${params}`);
            setEvents(res.data);
        } catch (err) {
            console.error("Failed to fetch tasks:", err);
        } finally {
            setLoading(false);
        }
    }, [authApi, currentDate, filterAssignee]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    // Generate calendar grid
    const calendarDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();

        // Adjust to start on Saturday (6)
        let startOffset = firstDay.getDay() - 6;
        if (startOffset < 0) startOffset += 7;

        const days: { date: Date | null; isCurrentMonth: boolean }[] = [];

        // Previous month days
        for (let i = 0; i < startOffset; i++) {
            const prevDate = new Date(year, month, -startOffset + i + 1);
            days.push({ date: prevDate, isCurrentMonth: false });
        }

        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ date: new Date(year, month, i), isCurrentMonth: true });
        }

        // Fill remaining cells
        const remainingDays = 42 - days.length;
        for (let i = 1; i <= remainingDays; i++) {
            days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
        }

        return days;
    }, [currentDate]);

    // Get events for a specific date
    const getEventsForDate = (date: Date | null) => {
        if (!date) return [];
        const dateStr = date.toISOString().split("T")[0];
        return events.filter((event) => {
            const eventDate = new Date(event.start).toISOString().split("T")[0];
            return eventDate === dateStr;
        }).filter((event) => {
            if (filterCategory === "all") return true;
            return event.extendedProps.category === filterCategory;
        });
    };

    // Selected date events
    const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate!) : [];

    // Navigation
    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    // Format date for display
    const formatSelectedDate = (date: Date | null) => {
        if (!date) return "";
        return `${date.getDate()} ${MONTHS_FR[date.getMonth()]} ${date.getFullYear()}`;
    };

    // Get unique categories
    const categories = useMemo(() => {
        const cats = new Set<string>();
        events.forEach((e) => {
            if (e.extendedProps.category) cats.add(e.extendedProps.category);
        });
        return Array.from(cats);
    }, [events]);

    // Handlers
    const handleComplete = (event: CalendarEvent) => {
        setSelectedEvent(event);
        setShowCompleteModal(true);
    };

    const handleEdit = (event: CalendarEvent) => {
        const fetchTask = async () => {
            try {
                const api = await authApi();
                if (!api) return;
                const res = await api.get(`/api/tasks/${event.extendedProps.taskId}`);
                setSelectedTask(res.data);
                setShowEditModal(true);
            } catch (err) {
                console.error("Failed to fetch task:", err);
            }
        };
        fetchTask();
    };

    const handleView = (event: CalendarEvent) => {
        setSelectedTaskId(event.extendedProps.taskId);
        setShowViewModal(true);
    };

    const handleEditFromView = (task: Task) => {
        setShowViewModal(false);
        setSelectedTask(task);
        setShowEditModal(true);
    };

    const isToday = (date: Date | null) => {
        if (!date) return false;
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const isSelected = (date: Date | null) => {
        if (!date || !selectedDate) return false;
        return date.toDateString() === selectedDate.toDateString();
    };

    // Tasks Panel Content (shared between drawer and desktop sidebar)
    const TasksPanelContent = () => (
        <>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="text-sm font-semibold text-gray-900">
                        {formatSelectedDate(selectedDate)}
                    </p>
                    <p className="text-xs text-gray-500">
                        {selectedDateEvents.length} tâche(s)
                    </p>
                </div>
                {/* Close button - only on mobile */}
                <button
                    onClick={() => setIsTasksOpen(false)}
                    className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Fermer"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="space-y-3 max-h-[calc(100vh-200px)] md:max-h-[400px] overflow-y-auto">
                {selectedDateEvents.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">
                        Pas de tâches
                    </p>
                ) : (
                    selectedDateEvents.map((event) => {
                        const typeColors = TASK_TYPE_COLORS[event.extendedProps.type];
                        const isAssignedToMe = event.extendedProps.assignedToId === currentUserId;
                        const canComplete = isAssignedToMe && event.extendedProps.status !== "COMPLETED";

                        return (
                            <div
                                key={event.id}
                                className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <input
                                        type="checkbox"
                                        checked={event.extendedProps.status === "COMPLETED"}
                                        disabled={!canComplete}
                                        onChange={() => canComplete && handleComplete(event)}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${typeColors.bg} ${typeColors.text}`}
                                    >
                                        {TASK_TYPE_LABELS[event.extendedProps.type]}
                                    </span>
                                </div>
                                <p
                                    onClick={() => handleView(event)}
                                    className="text-sm font-medium text-gray-900 mb-1 cursor-pointer hover:text-blue-600"
                                >
                                    {event.title}
                                </p>
                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[9px] font-bold">
                                        {event.extendedProps.assignedToName?.charAt(0) || "?"}
                                    </div>
                                    <span className="truncate">{event.extendedProps.assignedToName}</span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Add task for selected date */}
            {isAdmin && (
                <button
                    onClick={() => {
                        setIsTasksOpen(false);
                        setShowAddModal(true);
                    }}
                    className="w-full mt-4 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-blue-600 py-2 border border-dashed rounded-lg hover:border-blue-300 transition-colors"
                >
                    Ajouter <Plus className="h-4 w-4" />
                </button>
            )}
        </>
    );

    return (
        <>
            <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-3 md:px-4 py-3 border-b border-slate-100">
                    {/* Top row: Title + Mobile buttons */}
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-lg md:text-xl font-bold text-gray-900">Calendrier & Tâches</h2>
                            {/* Assignee filter - desktop */}
                            {isAdmin && (
                                <div className="hidden sm:flex items-center gap-2 mt-1">
                                    <span className="text-sm text-gray-500">Assigné à:</span>
                                    <select
                                        value={filterAssignee}
                                        onChange={(e) => setFilterAssignee(e.target.value)}
                                        className="text-sm border-0 bg-transparent font-medium text-gray-700 focus:ring-0 cursor-pointer"
                                    >
                                        <option value="all">Tous</option>
                                        {employees.map((emp) => (
                                            <option key={emp.id} value={emp.id.toString()}>
                                                {emp.fullName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Mobile buttons */}
                        <div className="flex items-center gap-2 md:hidden">
                            <button
                                onClick={() => setIsTasksOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
                            >
                                <ClipboardList className="h-4 w-4" />
                                <span className="hidden xs:inline">Tâches</span>
                                {selectedDateEvents.length > 0 && (
                                    <span className="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                        {selectedDateEvents.length}
                                    </span>
                                )}
                            </button>
                            {isAdmin && (
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    aria-label="Ajouter une tâche"
                                >
                                    <Plus className="h-5 w-5" />
                                </button>
                            )}
                        </div>

                        {/* Desktop Add Task button */}
                        {isAdmin && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all"
                            >
                                Add Task <Plus className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Mobile assignee filter */}
                    {isAdmin && (
                        <div className="flex sm:hidden items-center gap-2 mb-3">
                            <span className="text-sm text-gray-500">Assigné à:</span>
                            <select
                                value={filterAssignee}
                                onChange={(e) => setFilterAssignee(e.target.value)}
                                className="text-sm border rounded-lg px-2 py-1 font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 flex-1"
                            >
                                <option value="all">Tous</option>
                                {employees.map((emp) => (
                                    <option key={emp.id} value={emp.id.toString()}>
                                        {emp.fullName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Month navigation row */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 md:gap-2 bg-slate-100 rounded-lg px-2 py-1">
                            <button onClick={prevMonth} className="p-1 hover:bg-slate-200 rounded">
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="text-xs md:text-sm font-semibold min-w-[90px] md:min-w-[120px] text-center whitespace-nowrap">
                                {MONTHS_FR[currentDate.getMonth()]} {currentDate.getFullYear()}
                            </span>
                            <button onClick={nextMonth} className="p-1 hover:bg-slate-200 rounded">
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>

                        <button
                            onClick={fetchTasks}
                            disabled={loading}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="px-3 md:px-4 py-2 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        {/* View toggle */}
                        <div className="flex bg-slate-100 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode("calendar")}
                                className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-colors ${viewMode === "calendar"
                                    ? "bg-white shadow-sm text-blue-600"
                                    : "text-gray-600 hover:text-gray-900"
                                    }`}
                            >
                                <CalendarIcon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                <span className="hidden xs:inline">Calendrier</span>
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-colors ${viewMode === "list"
                                    ? "bg-white shadow-sm text-blue-600"
                                    : "text-gray-600 hover:text-gray-900"
                                    }`}
                            >
                                <List className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                <span className="hidden xs:inline">Liste</span>
                            </button>
                        </div>
                    </div>

                    {/* Category filter */}
                    <div className="flex items-center gap-1 md:gap-2">
                        <span className="text-xs md:text-sm text-gray-500 hidden sm:inline">Catégorie:</span>
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="text-xs md:text-sm border rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">Toutes</option>
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Main content */}
                <div className="flex flex-col md:flex-row">
                    {/* Calendar Grid - Full width on mobile */}
                    <div className={`flex-1 w-full ${viewMode === "list" ? "hidden" : ""}`}>
                        {loading ? (
                            <div className="h-[300px] md:h-[400px] flex items-center justify-center text-gray-500">
                                <RefreshCcw className="h-6 w-6 animate-spin" />
                            </div>
                        ) : (
                            <div className="p-2 md:p-4">
                                {/* Weekday headers */}
                                <div className="grid grid-cols-7 gap-0.5 md:gap-1 mb-1 md:mb-2">
                                    {DAYS_FR.map((day) => (
                                        <div
                                            key={day}
                                            className="text-center text-[10px] md:text-xs font-semibold text-gray-500 py-1 md:py-2"
                                        >
                                            {day.slice(0, 2)}
                                        </div>
                                    ))}
                                </div>

                                {/* Calendar grid */}
                                <div className="grid grid-cols-7 gap-0.5 md:gap-1">
                                    {calendarDays.map((dayObj, idx) => {
                                        const dayEvents = getEventsForDate(dayObj.date);
                                        const selected = isSelected(dayObj.date);
                                        const today = isToday(dayObj.date);

                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => {
                                                    if (dayObj.date) {
                                                        setSelectedDate(dayObj.date);
                                                        // On mobile, open drawer when clicking a date with events
                                                        if (window.innerWidth < 768 && getEventsForDate(dayObj.date).length > 0) {
                                                            setIsTasksOpen(true);
                                                        }
                                                    }
                                                }}
                                                className={`min-h-[50px] md:min-h-[80px] p-0.5 md:p-1 border rounded md:rounded-lg cursor-pointer transition-all ${selected
                                                    ? "border-blue-500 bg-blue-50 ring-1 md:ring-2 ring-blue-200"
                                                    : "border-slate-200 hover:border-slate-300"
                                                    } ${!dayObj.isCurrentMonth ? "bg-slate-50 opacity-50" : "bg-white"}`}
                                            >
                                                <div
                                                    className={`text-xs md:text-sm font-medium mb-0.5 md:mb-1 ${today
                                                        ? "bg-blue-600 text-white w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[10px] md:text-sm"
                                                        : dayObj.isCurrentMonth
                                                            ? "text-gray-900"
                                                            : "text-gray-400"
                                                        }`}
                                                >
                                                    {dayObj.date?.getDate()}
                                                </div>
                                                {/* Events - show dots on mobile, text on desktop */}
                                                <div className="space-y-0.5">
                                                    {/* Mobile: show dots */}
                                                    <div className="flex gap-0.5 flex-wrap md:hidden">
                                                        {dayEvents.slice(0, 3).map((event) => {
                                                            const typeColors = TASK_TYPE_COLORS[event.extendedProps.type];
                                                            return (
                                                                <div
                                                                    key={event.id}
                                                                    className={`w-1.5 h-1.5 rounded-full ${typeColors.bg.replace('bg-', 'bg-').replace('-50', '-500')}`}
                                                                />
                                                            );
                                                        })}
                                                        {dayEvents.length > 3 && (
                                                            <span className="text-[8px] text-gray-400">+{dayEvents.length - 3}</span>
                                                        )}
                                                    </div>
                                                    {/* Desktop: show event titles */}
                                                    <div className="hidden md:block space-y-0.5">
                                                        {dayEvents.slice(0, 3).map((event) => {
                                                            const typeColors = TASK_TYPE_COLORS[event.extendedProps.type];
                                                            return (
                                                                <div
                                                                    key={event.id}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleView(event);
                                                                    }}
                                                                    className={`text-[10px] px-1.5 py-0.5 rounded truncate ${typeColors.bg} ${typeColors.text} cursor-pointer hover:opacity-80`}
                                                                >
                                                                    {event.title}
                                                                </div>
                                                            );
                                                        })}
                                                        {dayEvents.length > 3 && (
                                                            <div className="text-[10px] text-gray-500 px-1">
                                                                +{dayEvents.length - 3} plus
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* List view */}
                    {viewMode === "list" && (
                        <div className="flex-1 p-3 md:p-4">
                            {events.length === 0 ? (
                                <div className="h-[200px] md:h-[300px] flex items-center justify-center text-gray-500">
                                    Aucune tâche ce mois
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[400px] md:max-h-[500px] overflow-y-auto">
                                    {events.map((event) => {
                                        const typeColors = TASK_TYPE_COLORS[event.extendedProps.type];
                                        const eventDate = new Date(event.start);
                                        return (
                                            <div
                                                key={event.id}
                                                onClick={() => handleView(event)}
                                                className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-xl border border-slate-200 hover:shadow-md transition-shadow cursor-pointer"
                                            >
                                                <div className="text-center min-w-[32px] md:min-w-[40px]">
                                                    <div className="text-base md:text-lg font-bold text-gray-900">
                                                        {eventDate.getDate()}
                                                    </div>
                                                    <div className="text-[9px] md:text-[10px] uppercase text-gray-500">
                                                        {MONTHS_FR[eventDate.getMonth()].slice(0, 3)}
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className={`px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[10px] font-medium ${typeColors.bg} ${typeColors.text}`}>
                                                        {TASK_TYPE_LABELS[event.extendedProps.type]}
                                                    </span>
                                                    <p className="text-xs md:text-sm font-semibold text-gray-900 truncate mt-1">
                                                        {event.title}
                                                    </p>
                                                    <div className="flex items-center gap-1 text-[10px] md:text-xs text-gray-500 mt-0.5">
                                                        <User className="h-3 w-3" />
                                                        <span className="truncate">{event.extendedProps.assignedToName}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Right sidebar - Selected date tasks (DESKTOP ONLY) */}
                    {viewMode === "calendar" && (
                        <div className="hidden md:block w-64 border-l border-slate-200 p-4 bg-slate-50">
                            <TasksPanelContent />
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Drawer Backdrop */}
            {isTasksOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/40 z-40 transition-opacity"
                    onClick={() => setIsTasksOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Mobile Drawer */}
            <div
                className={`md:hidden fixed inset-y-0 right-0 w-[85%] max-w-sm bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out p-4 ${isTasksOpen ? "translate-x-0" : "translate-x-full"
                    }`}
            >
                <TasksPanelContent />
            </div>

            {/* Modals */}
            <AddTaskModal
                open={showAddModal}
                onClose={() => setShowAddModal(false)}
                onCreated={fetchTasks}
            />

            <EditTaskModal
                open={showEditModal}
                task={selectedTask}
                onClose={() => {
                    setShowEditModal(false);
                    setSelectedTask(null);
                }}
                onUpdated={fetchTasks}
                onDeleted={fetchTasks}
            />

            <CompleteTaskModal
                open={showCompleteModal}
                event={selectedEvent}
                onClose={() => {
                    setShowCompleteModal(false);
                    setSelectedEvent(null);
                }}
                onCompleted={fetchTasks}
            />

            <ViewTaskModal
                open={showViewModal}
                taskId={selectedTaskId}
                onClose={() => {
                    setShowViewModal(false);
                    setSelectedTaskId(null);
                }}
                onEdit={handleEditFromView}
                isAdmin={isAdmin}
            />
        </>
    );
}
