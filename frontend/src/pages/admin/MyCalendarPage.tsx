/**
 * MyCalendarPage - Personal task calendar for managers
 *
 * Shows only tasks assigned to the current user.
 * Available to PRODUCT_MANAGER and ORDER_MANAGER roles.
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
    CheckCircle,
} from "lucide-react";
import { useAuthenticatedApi } from "@/lib/api";
import {
    CalendarEvent,
    Task,
    TASK_TYPE_COLORS,
    TASK_TYPE_LABELS,
} from "@/components/calendar/types";
import CompleteTaskModal from "@/components/calendar/CompleteTaskModal";
import ViewTaskModal from "@/components/calendar/ViewTaskModal";

const DAYS_FR = ["Samedi", "Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const MONTHS_FR = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

export default function MyCalendarPage() {
    const { authApi, authGet } = useAuthenticatedApi();

    // State
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [userLoading, setUserLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
    const [userName, setUserName] = useState<string>("");
    const [currentUserId, setCurrentUserId] = useState<number>(0);

    // Modals
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    // Filters
    const [filterCategory, setFilterCategory] = useState<string>("all");

    // Fetch user info
    useEffect(() => {
        const fetchUserRole = async () => {
            try {
                const { data } = await authGet<{ role: string; id: number; fullName: string }>(
                    "/api/me/role"
                );
                if (data) {
                    setCurrentUserId(data.id);
                    setUserName(data.fullName || "Mon Calendrier");
                }
            } catch (err) {
                console.error("Failed to fetch user role:", err);
            } finally {
                setUserLoading(false);
            }
        };
        fetchUserRole();
    }, [authGet]);

    // Fetch MY tasks only
    const fetchTasks = useCallback(async () => {
        if (!currentUserId) return;

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
                assignedTo: currentUserId.toString(), // Only my tasks
            });

            const res = await api.get(`/api/tasks?${params}`);
            setEvents(res.data);
        } catch (err) {
            console.error("Failed to fetch tasks:", err);
        } finally {
            setLoading(false);
        }
    }, [authApi, currentDate, currentUserId]);

    useEffect(() => {
        if (currentUserId) {
            fetchTasks();
        }
    }, [fetchTasks, currentUserId]);

    // Generate calendar grid
    const calendarDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();

        let startOffset = firstDay.getDay() - 6;
        if (startOffset < 0) startOffset += 7;

        const days: { date: Date | null; isCurrentMonth: boolean }[] = [];

        for (let i = 0; i < startOffset; i++) {
            const prevDate = new Date(year, month, -startOffset + i + 1);
            days.push({ date: prevDate, isCurrentMonth: false });
        }

        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ date: new Date(year, month, i), isCurrentMonth: true });
        }

        const remainingDays = 42 - days.length;
        for (let i = 1; i <= remainingDays; i++) {
            days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
        }

        return days;
    }, [currentDate]);

    // Get events for a date
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

    const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

    // Navigation
    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

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

    // Stats
    const stats = useMemo(() => {
        const todo = events.filter((e) => e.extendedProps.status === "TODO").length;
        const inProgress = events.filter((e) => e.extendedProps.status === "IN_PROGRESS").length;
        const completed = events.filter((e) => e.extendedProps.status === "COMPLETED").length;
        return { todo, inProgress, completed, total: events.length };
    }, [events]);

    // Handlers
    const handleComplete = (event: CalendarEvent) => {
        setSelectedEvent(event);
        setShowCompleteModal(true);
    };

    const handleView = (event: CalendarEvent) => {
        setSelectedTaskId(event.extendedProps.taskId);
        setShowViewModal(true);
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

    return (
        <div className="p-4 sm:p-6 space-y-6 bg-[#f7f8fb] min-h-screen">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                        Calendrier & Tâches
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Vos tâches assignées • {userName}
                    </p>
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-4">
                        <div className="text-xs text-gray-500">Total ce mois</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
                    </div>
                    <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-4">
                        <div className="text-xs text-gray-500">À faire</div>
                        <div className="text-2xl font-bold text-gray-700 mt-1">{stats.todo}</div>
                    </div>
                    <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-4">
                        <div className="text-xs text-gray-500">En cours</div>
                        <div className="text-2xl font-bold text-blue-600 mt-1">{stats.inProgress}</div>
                    </div>
                    <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-4">
                        <div className="text-xs text-gray-500">Terminées</div>
                        <div className="text-2xl font-bold text-green-600 mt-1">{stats.completed}</div>
                    </div>
                </div>

                {/* Calendar container */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    {/* Toolbar */}
                    <div className="px-4 py-3 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* View toggle */}
                            <div className="flex bg-slate-100 rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode("calendar")}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "calendar"
                                        ? "bg-white shadow-sm text-blue-600"
                                        : "text-gray-600 hover:text-gray-900"
                                        }`}
                                >
                                    <CalendarIcon className="h-4 w-4" />
                                    Calendrier
                                </button>
                                <button
                                    onClick={() => setViewMode("list")}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "list"
                                        ? "bg-white shadow-sm text-blue-600"
                                        : "text-gray-600 hover:text-gray-900"
                                        }`}
                                >
                                    <List className="h-4 w-4" />
                                    Liste
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

                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Month navigation */}
                            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-2 py-1">
                                <button onClick={prevMonth} className="p-1 hover:bg-slate-200 rounded">
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="text-sm font-semibold min-w-[120px] text-center">
                                    {MONTHS_FR[currentDate.getMonth()]} {currentDate.getFullYear()}
                                </span>
                                <button onClick={nextMonth} className="p-1 hover:bg-slate-200 rounded">
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Category filter */}
                            {categories.length > 0 && (
                                <select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="text-sm border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="all">Toutes catégories</option>
                                    {categories.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    {/* Main content */}
                    <div className="flex flex-col lg:flex-row">
                        {/* Calendar Grid */}
                        <div className={`flex-1 ${viewMode === "list" ? "hidden" : ""}`}>
                            {(loading || userLoading) ? (
                                <div className="h-[450px] flex items-center justify-center text-gray-500">
                                    <RefreshCcw className="h-6 w-6 animate-spin" />
                                </div>
                            ) : (
                                <div className="p-4">
                                    {/* Weekday headers */}
                                    <div className="grid grid-cols-7 gap-1 mb-2">
                                        {DAYS_FR.map((day) => (
                                            <div
                                                key={day}
                                                className="text-center text-xs font-semibold text-gray-500 py-2"
                                            >
                                                {day.slice(0, 3)}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Calendar grid */}
                                    <div className="grid grid-cols-7 gap-1">
                                        {calendarDays.map((dayObj, idx) => {
                                            const dayEvents = getEventsForDate(dayObj.date);
                                            const selected = isSelected(dayObj.date);
                                            const today = isToday(dayObj.date);

                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => dayObj.date && setSelectedDate(dayObj.date)}
                                                    className={`min-h-[85px] p-1 border rounded-lg cursor-pointer transition-all ${selected
                                                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                                                        : "border-slate-200 hover:border-slate-300"
                                                        } ${!dayObj.isCurrentMonth ? "bg-slate-50 opacity-50" : "bg-white"}`}
                                                >
                                                    <div
                                                        className={`text-sm font-medium mb-1 ${today
                                                            ? "bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center"
                                                            : dayObj.isCurrentMonth
                                                                ? "text-gray-900"
                                                                : "text-gray-400"
                                                            }`}
                                                    >
                                                        {dayObj.date?.getDate()}
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        {dayEvents.slice(0, 3).map((event) => {
                                                            const typeColors = TASK_TYPE_COLORS[event.extendedProps.type];
                                                            const isCompleted = event.extendedProps.status === "COMPLETED";
                                                            return (
                                                                <div
                                                                    key={event.id}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleView(event);
                                                                    }}
                                                                    className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${isCompleted
                                                                        ? "bg-gray-100 text-gray-500 line-through"
                                                                        : `${typeColors.bg} ${typeColors.text}`
                                                                        }`}
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
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* List view */}
                        {viewMode === "list" && (
                            <div className="flex-1 p-4">
                                {events.length === 0 ? (
                                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                                        Aucune tâche ce mois
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                        {events.map((event) => {
                                            const typeColors = TASK_TYPE_COLORS[event.extendedProps.type];
                                            const eventDate = new Date(event.start);
                                            const isCompleted = event.extendedProps.status === "COMPLETED";
                                            const canComplete = !isCompleted;

                                            return (
                                                <div
                                                    key={event.id}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-shadow cursor-pointer ${isCompleted
                                                        ? "border-gray-200 bg-gray-50"
                                                        : "border-slate-200 hover:shadow-md"
                                                        }`}
                                                >
                                                    <div className="text-center min-w-[40px]">
                                                        <div className={`text-lg font-bold ${isCompleted ? "text-gray-400" : "text-gray-900"}`}>
                                                            {eventDate.getDate()}
                                                        </div>
                                                        <div className="text-[10px] uppercase text-gray-500">
                                                            {MONTHS_FR[eventDate.getMonth()].slice(0, 3)}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0" onClick={() => handleView(event)}>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${isCompleted ? "bg-gray-100 text-gray-500" : `${typeColors.bg} ${typeColors.text}`
                                                            }`}>
                                                            {TASK_TYPE_LABELS[event.extendedProps.type]}
                                                        </span>
                                                        <p className={`text-sm font-semibold truncate mt-1 ${isCompleted ? "text-gray-400 line-through" : "text-gray-900"
                                                            }`}>
                                                            {event.title}
                                                        </p>
                                                    </div>
                                                    {canComplete && (
                                                        <button
                                                            onClick={() => handleComplete(event)}
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                            title="Marquer terminé"
                                                        >
                                                            <CheckCircle className="h-5 w-5" />
                                                        </button>
                                                    )}
                                                    {isCompleted && (
                                                        <div className="text-green-600">
                                                            <CheckCircle className="h-5 w-5 fill-current" />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Right sidebar - Selected date tasks */}
                        {viewMode === "calendar" && (
                            <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-slate-200 p-4 bg-slate-50">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">
                                            {formatSelectedDate(selectedDate)}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {selectedDateEvents.length} tâche(s)
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                    {selectedDateEvents.length === 0 ? (
                                        <p className="text-sm text-gray-500 text-center py-8">
                                            Pas de tâches pour cette date
                                        </p>
                                    ) : (
                                        selectedDateEvents.map((event) => {
                                            const typeColors = TASK_TYPE_COLORS[event.extendedProps.type];
                                            const isCompleted = event.extendedProps.status === "COMPLETED";
                                            const canComplete = !isCompleted;

                                            return (
                                                <div
                                                    key={event.id}
                                                    className={`p-3 rounded-xl border shadow-sm ${isCompleted ? "bg-gray-50 border-gray-200" : "bg-white border-slate-200"
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={isCompleted}
                                                            disabled={!canComplete}
                                                            onChange={() => canComplete && handleComplete(event)}
                                                            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                        />
                                                        <span
                                                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${isCompleted ? "bg-gray-100 text-gray-500" : `${typeColors.bg} ${typeColors.text}`
                                                                }`}
                                                        >
                                                            {TASK_TYPE_LABELS[event.extendedProps.type]}
                                                        </span>
                                                    </div>
                                                    <p
                                                        onClick={() => handleView(event)}
                                                        className={`text-sm font-medium mb-1 cursor-pointer hover:text-blue-600 ${isCompleted ? "text-gray-400 line-through" : "text-gray-900"
                                                            }`}
                                                    >
                                                        {event.title}
                                                    </p>
                                                    {event.extendedProps.description && (
                                                        <p className="text-xs text-gray-500 line-clamp-2">
                                                            {event.extendedProps.description}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
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
                isAdmin={false}
            />
        </div>
    );
}
