/**
 * CalendarPage Component
 *
 * Main calendar page with FullCalendar integration.
 * Shows month view calendar on left, task list sidebar on right.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
    Calendar,
    List,
    Plus,
    Search,
    ChevronLeft,
    ChevronRight,
    Loader2,
    RefreshCcw,
} from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useAuthenticatedApi } from "@/lib/api";

import TaskCard from "@/components/calendar/TaskCard";
import AddTaskModal from "@/components/calendar/AddTaskModal";
import CompleteTaskModal from "@/components/calendar/CompleteTaskModal";
import {
    CalendarEvent,
    Employee,
    TASK_TYPE_COLORS,
} from "@/components/calendar/types";

type ViewType = "calendar" | "list";

export default function CalendarPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { authApi, authGet } = useAuthenticatedApi();

    // State
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewType, setViewType] = useState<ViewType>("calendar");
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [searchQuery, setSearchQuery] = useState("");
    const [calendarRef, setCalendarRef] = useState<FullCalendar | null>(null);

    // User info
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<number>(0);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedAssignee, setSelectedAssignee] = useState<string>("me");

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

    // Fetch user role
    useEffect(() => {
        const fetchUserRole = async () => {
            const { data } = await authGet<{ role: string; id: number; isActive: boolean }>(
                "/api/me/role"
            );
            if (data) {
                setIsAdmin(data.role === "ADMIN");
                setCurrentUserId(data.id);
                if (data.role === "ADMIN") {
                    setSelectedAssignee("all"); // Admins see all tasks by default
                }
            }
        };
        fetchUserRole();
    }, [authGet]);

    // Fetch employees for admin filter
    useEffect(() => {
        if (!isAdmin) return;

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
    }, [isAdmin, authApi]);

    // Fetch tasks
    const fetchTasks = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const api = await authApi();
            if (!api) {
                setError("Non authentifié");
                return;
            }

            // Calculate month range
            const calendarApi = calendarRef?.getApi();
            let start: Date, end: Date;

            if (calendarApi) {
                start = calendarApi.view.activeStart;
                end = calendarApi.view.activeEnd;
            } else {
                // Default to current month
                start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
            }

            const params = new URLSearchParams({
                start: start.toISOString(),
                end: end.toISOString(),
                view: viewType,
                assignedTo: selectedAssignee,
            });

            const res = await api.get(`/api/tasks?${params}`);
            setEvents(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || "Échec du chargement");
        } finally {
            setLoading(false);
        }
    }, [authApi, calendarRef, selectedDate, viewType, selectedAssignee]);

    // Fetch tasks on mount and when filters change
    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    // Get tasks for selected date
    const selectedDateTasks = useMemo(() => {
        const dateStr = selectedDate.toISOString().split("T")[0];
        return events.filter((event) => {
            const eventDate = event.start.split("T")[0];
            return eventDate === dateStr;
        });
    }, [events, selectedDate]);

    // Filter tasks by search
    const filteredEvents = useMemo(() => {
        if (!searchQuery.trim()) return events;
        const query = searchQuery.toLowerCase();
        return events.filter(
            (event) =>
                event.title.toLowerCase().includes(query) ||
                event.extendedProps.assignedToName.toLowerCase().includes(query) ||
                (event.extendedProps.category || "").toLowerCase().includes(query)
        );
    }, [events, searchQuery]);

    // Navigation
    const handlePrevMonth = () => {
        calendarRef?.getApi().prev();
        setSelectedDate(new Date(calendarRef?.getApi().getDate() || new Date()));
        setTimeout(fetchTasks, 100);
    };

    const handleNextMonth = () => {
        calendarRef?.getApi().next();
        setSelectedDate(new Date(calendarRef?.getApi().getDate() || new Date()));
        setTimeout(fetchTasks, 100);
    };

    const handleToday = () => {
        calendarRef?.getApi().today();
        setSelectedDate(new Date());
        setTimeout(fetchTasks, 100);
    };

    // Calendar event click
    const handleEventClick = (info: any) => {
        const event = events.find((e) => e.id === info.event.id);
        if (event) {
            setSelectedEvent(event);
        }
    };

    // Calendar date click
    const handleDateClick = (info: any) => {
        setSelectedDate(info.date);
    };

    // Complete task
    const handleComplete = (event: CalendarEvent) => {
        setSelectedEvent(event);
        setShowCompleteModal(true);
    };

    // Edit task (admin)
    const handleEdit = (event: CalendarEvent) => {
        // TODO: Implement edit modal
        console.log("Edit task:", event);
    };

    // Current month label
    const monthLabel = selectedDate.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
    });

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h1 className="text-2xl font-bold text-gray-900">
                        Calendrier & Tâches
                    </h1>

                    <div className="flex items-center gap-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Rechercher..."
                                className="pl-9 pr-4 py-2 border rounded-lg w-48 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        {/* View toggle */}
                        <div className="flex items-center bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setViewType("calendar")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewType === "calendar"
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-600 hover:text-gray-900"
                                    }`}
                            >
                                <Calendar className="h-4 w-4" />
                                Calendrier
                            </button>
                            <button
                                onClick={() => setViewType("list")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewType === "list"
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-600 hover:text-gray-900"
                                    }`}
                            >
                                <List className="h-4 w-4" />
                                Liste
                            </button>
                        </div>

                        {/* Assignee filter (admin only) */}
                        {isAdmin && (
                            <select
                                value={selectedAssignee}
                                onChange={(e) => setSelectedAssignee(e.target.value)}
                                className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">Tous les employés</option>
                                <option value="me">Mes tâches</option>
                                {employees.map((emp) => (
                                    <option key={emp.id} value={emp.id.toString()}>
                                        {emp.fullName}
                                    </option>
                                ))}
                            </select>
                        )}

                        {/* Month navigation */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrevMonth}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button
                                onClick={handleToday}
                                className="px-3 py-1.5 text-sm font-medium hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Aujourd'hui
                            </button>
                            <span className="text-sm font-medium capitalize min-w-[140px] text-center">
                                {monthLabel}
                            </span>
                            <button
                                onClick={handleNextMonth}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Add task button (admin only) */}
                        {isAdmin && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                                <Plus className="h-4 w-4" />
                                Ajouter
                            </button>
                        )}

                        {/* Refresh */}
                        <button
                            onClick={fetchTasks}
                            disabled={loading}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <RefreshCcw
                                className={`h-5 w-5 ${loading ? "animate-spin" : ""}`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* Error message */}
            {error && (
                <div className="mx-6 mt-4 p-4 bg-red-50 text-red-600 rounded-lg">
                    {error}
                </div>
            )}

            {/* Main content */}
            <div className="flex gap-6 p-6">
                {/* Calendar / List */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border overflow-hidden">
                    {loading && events.length === 0 ? (
                        <div className="flex items-center justify-center h-96">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                        </div>
                    ) : viewType === "calendar" ? (
                        <div className="p-4">
                            <FullCalendar
                                ref={(el) => setCalendarRef(el)}
                                plugins={[dayGridPlugin, interactionPlugin]}
                                initialView="dayGridMonth"
                                locale="fr"
                                headerToolbar={false}
                                events={filteredEvents.map((event) => ({
                                    id: event.id,
                                    title: event.title,
                                    start: event.start,
                                    end: event.end,
                                    backgroundColor: TASK_TYPE_COLORS[event.extendedProps.type].bg.replace("bg-", "#").replace("-50", "ee"),
                                    borderColor: TASK_TYPE_COLORS[event.extendedProps.type].border.replace("border-", "#").replace("-200", ""),
                                    textColor: TASK_TYPE_COLORS[event.extendedProps.type].text.replace("text-", "#").replace("-600", ""),
                                }))}
                                eventClick={handleEventClick}
                                dateClick={handleDateClick}
                                height="auto"
                                dayMaxEvents={3}
                                firstDay={1}
                                selectable
                            />
                        </div>
                    ) : (
                        // List view
                        <div className="divide-y max-h-[600px] overflow-y-auto">
                            {filteredEvents.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    Aucune tâche trouvée
                                </div>
                            ) : (
                                filteredEvents.map((event) => (
                                    <div key={event.id} className="p-4 hover:bg-gray-50">
                                        <TaskCard
                                            event={event}
                                            isAdmin={isAdmin}
                                            currentUserId={currentUserId}
                                            onComplete={handleComplete}
                                            onEdit={handleEdit}
                                            onClick={() => setSelectedEvent(event)}
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar - Selected day tasks */}
                <div className="w-80 shrink-0">
                    <div className="bg-white rounded-xl shadow-sm border">
                        {/* Sidebar header */}
                        <div className="px-4 py-3 border-b">
                            <h3 className="font-semibold text-gray-900">
                                {selectedDate.toLocaleDateString("fr-FR", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                })}
                            </h3>
                            <p className="text-sm text-gray-500">
                                {selectedDateTasks.length} tâche{selectedDateTasks.length !== 1 ? "s" : ""}
                            </p>
                        </div>

                        {/* Task list */}
                        <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                            {selectedDateTasks.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-4">
                                    Aucune tâche ce jour
                                </p>
                            ) : (
                                selectedDateTasks.map((event) => (
                                    <TaskCard
                                        key={event.id}
                                        event={event}
                                        isAdmin={isAdmin}
                                        currentUserId={currentUserId}
                                        onComplete={handleComplete}
                                        onEdit={handleEdit}
                                        onClick={() => setSelectedEvent(event)}
                                    />
                                ))
                            )}

                            {/* Add task shortcut for admin */}
                            {isAdmin && (
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 border border-dashed rounded-lg hover:border-blue-300 hover:text-blue-600 transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
                                    Ajouter une tâche
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <AddTaskModal
                open={showAddModal}
                onClose={() => setShowAddModal(false)}
                onCreated={fetchTasks}
                defaultDate={selectedDate.toISOString().slice(0, 16)}
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
        </div>
    );
}
