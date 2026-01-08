/* eslint-disable @typescript-eslint/no-explicit-any */
/* src/pages/admin/EmployeesAdmin.tsx */
import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  BadgeCheck,
  Circle,
  Download,
  Filter,
  Mail,
  Phone,
  Shield,
  UserPlus,
  Users,
  LogIn,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthenticatedApi } from "@/lib/api";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { SignInButton } from "@clerk/clerk-react";
import { EmployeesAdminSkeleton } from "@/components/skeletons";
import TaskCalendarSection from "@/components/calendar/TaskCalendarSection";

type Role = "ADMIN" | "PRODUCT_MANAGER" | "ORDER_MANAGER" | "CUSTOMER";

type Employee = {
  id: number;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  role: Role;
  isActive: boolean;
  createdAt?: string;
};

const emptyEmployee: Omit<Employee, "id" | "isActive" | "role"> & {
  role: Role;
  isActive: boolean;
} = {
  fullName: "",
  email: "",
  phone: "",
  role: "PRODUCT_MANAGER",
  isActive: true,
};

const roleTone: Record<Role, string> = {
  ADMIN: "bg-blue-50 text-blue-700 border-blue-200",
  PRODUCT_MANAGER: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ORDER_MANAGER: "bg-amber-50 text-amber-700 border-amber-200",
  CUSTOMER: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function EmployeesAdmin() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<"unauthorized" | "forbidden" | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyEmployee });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [employeeToDeactivate, setEmployeeToDeactivate] = useState<Employee | null>(null);
  const location = useLocation();

  const { authGet, authPost, authPatch, isSignedIn, isLoading: authLoading, user } = useAuthenticatedApi();

  const headerTitle = useMemo(() => (editingId ? "Modifier un employe" : "Ajouter un employe"), [editingId]);

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.isActive).length;
    const inactive = total - active;
    const onLeave = 0;
    return { total, active, inactive, onLeave };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((emp) => {
      const matchSearch =
        term.length === 0 ||
        emp.fullName.toLowerCase().includes(term) ||
        (emp.email ?? "").toLowerCase().includes(term) ||
        (emp.phone ?? "").toLowerCase().includes(term) ||
        emp.role.toLowerCase().includes(term);
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && emp.isActive) ||
        (statusFilter === "inactive" && !emp.isActive);
      return matchSearch && matchStatus;
    });
  }, [employees, search, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const term = params.get("search");
    if (term !== null) {
      setSearch(term);
      setPage(1);
    }
  }, [location.search]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const pageEmployees = filteredEmployees.slice((page - 1) * pageSize, page * pageSize);

  const formatDate = (value?: string) => {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const load = useCallback(async () => {
    if (!isSignedIn || authLoading) {
      setAuthError("unauthorized");
      return;
    }
    try {
      setLoading(true);
      setAuthError(null);
      const { data, status, error: apiError } = await authGet<Employee[]>("/api/employees");
      if (status === 401) {
        setAuthError("unauthorized");
        return;
      }
      if (status === 403) {
        setAuthError("forbidden");
        return;
      }
      if (apiError) {
        setError(apiError);
        return;
      }
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Impossible de charger");
    } finally {
      setLoading(false);
    }
  }, [authGet, isSignedIn, authLoading]);

  useEffect(() => {
    if (!authLoading && isSignedIn) {
      load();
    } else if (!authLoading && !isSignedIn) {
      setAuthError("unauthorized");
    }
  }, [authLoading, isSignedIn, load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyEmployee });
    setFormOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setForm({
      fullName: emp.fullName,
      email: emp.email ?? "",
      phone: emp.phone ?? "",
      role: emp.role,
      isActive: emp.isActive,
    });
    setFormOpen(true);
  };

  const validate = () => {
    const errs: string[] = [];
    if (!form.fullName.trim()) errs.push("Nom complet requis");
    if (!form.email.trim() && !form.phone.trim()) errs.push("Email ou telephone requis");
    return errs;
  };

  const save = async () => {
    const errs = validate();
    if (errs.length) {
      alert(errs.join("\n"));
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await authPatch(`/api/employees/${editingId}`, {
          fullName: form.fullName.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          role: form.role,
          isActive: form.isActive,
        });
      } else {
        await authPost("/api/employees", {
          fullName: form.fullName.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          role: form.role,
        });
      }
      setFormOpen(false);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    if (!employeeToDeactivate) return;
    try {
      setDeactivateLoading(true);
      await authPatch(`/api/employees/${employeeToDeactivate.id}/deactivate`, {});
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Erreur lors de la desactivation");
    } finally {
      setDeactivateLoading(false);
      setDeactivateDialogOpen(false);
      setEmployeeToDeactivate(null);
    }
  };

  const askDeactivate = (emp: Employee) => {
    setEmployeeToDeactivate(emp);
    setDeactivateDialogOpen(true);
  };

  const toggleActive = async (emp: Employee) => {
    try {
      setSaving(true);
      await authPatch(`/api/employees/${emp.id}`, {
        fullName: emp.fullName,
        email: emp.email ?? null,
        phone: emp.phone ?? null,
        role: emp.role,
        isActive: !emp.isActive,
      });
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Impossible de modifier le statut");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const header = ["ID", "Nom", "Role", "Email", "Telephone", "Statut"];
    const rows = filteredEmployees.map((emp) => [
      emp.id,
      `"${emp.fullName.replace(/"/g, '""')}"`,
      emp.role,
      emp.email ?? "",
      emp.phone ?? "",
      emp.isActive ? "Actif" : "Inactif",
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "employees.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  // Convert employees to format expected by TaskCalendarSection
  const taskEmployees = employees.map((emp) => ({
    id: emp.id,
    fullName: emp.fullName,
    email: emp.email ?? null,
    role: emp.role,
  }));

  // Show loading while checking auth
  if (authLoading) {
    return <EmployeesAdminSkeleton />;
  }

  // Show sign-in prompt if not authenticated
  if (authError === "unauthorized") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-lg">
          <LogIn className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Connexion requise</h2>
          <p className="text-gray-500 mb-6">
            Vous devez être connecté pour accéder à la gestion des employés.
          </p>
          <SignInButton mode="modal">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8">
              Se connecter
            </Button>
          </SignInButton>
        </div>
      </div>
    );
  }

  // Show access denied if authenticated but not admin
  if (authError === "forbidden") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-lg">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Accès refusé</h2>
          <p className="text-gray-500 mb-4">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
          <p className="text-sm text-gray-400">
            Connecté en tant que : {user?.emailAddresses?.[0]?.emailAddress || "Inconnu"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-[#f7f8fb] min-h-screen">
      <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.16),transparent_40%)]" />
          <div className="relative p-6 sm:p-7 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white/20 p-3 backdrop-blur-sm">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold">Vue employes & acces</h1>
                <p className="text-sm sm:text-base text-white/80">
                  Pilotez les roles et la securite de votre equipe.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={openCreate}
                className="bg-white text-blue-700 hover:bg-white/90 font-semibold shadow-md"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Ajouter un employe
              </Button>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/10 text-white/90 text-sm backdrop-blur-sm">
                <BadgeCheck className="h-4 w-4" />
                Controle d'acces centralise
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Employes</span>
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">{stats.total}</div>
            <p className="text-[11px] text-green-600 mt-1">+0% vs mois dernier</p>
          </div>
          <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Actifs</span>
              <BadgeCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-700 mt-2">{stats.active}</div>
            <p className="text-[11px] text-emerald-600 mt-1">+0% vs mois dernier</p>
          </div>
          <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>En conge</span>
              <Circle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-700 mt-2">{stats.onLeave}</div>
            <p className="text-[11px] text-amber-600 mt-1">+0% vs mois dernier</p>
          </div>
          <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Inactifs</span>
              <Shield className="h-4 w-4 text-gray-500" />
            </div>
            <div className="text-2xl font-bold text-gray-700 mt-2">{stats.inactive}</div>
            <p className="text-[11px] text-red-500 mt-1">-0% vs mois dernier</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-4 py-3">
          {error}
        </div>
      )}

      {/* Employee list table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Liste des employes ({filteredEmployees.length})
            </h2>
            <p className="text-sm text-gray-500">
              Recherchez, filtrez ou ajoutez un membre de l&apos;équipe.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full">
            <div className="relative flex-1 min-w-[200px] sm:min-w-[220px] sm:flex-none">
              <Input
                placeholder="Rechercher un employe"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 h-10 w-full sm:w-64 border-slate-200 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div className="relative flex-1 min-w-[180px] sm:min-w-[200px] sm:flex-none">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actifs</option>
                <option value="inactive">Inactifs</option>
              </select>
              <Filter className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
            <div className="flex w-full sm:w-auto gap-2">
              <Button
                variant="outline"
                onClick={exportCsv}
                className="flex-1 sm:flex-none border-slate-200 text-gray-700 hover:bg-white hover:text-black"
              >
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </Button>
              <Button
                onClick={openCreate}
                className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full min-w-[600px] sm:min-w-[720px] md:min-w-[840px] lg:min-w-[960px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-sm text-gray-700">
                <th className="px-5 py-3 font-semibold">Nom</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Contact</th>
                <th className="px-5 py-3 font-semibold">Statut</th>
                <th className="px-5 py-3 font-semibold">Cree le</th>
                <th className="px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center">Chargement...</td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-gray-500">Aucun employe</td>
                </tr>
              ) : (
                pageEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-gray-900">{emp.fullName}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide border ${roleTone[emp.role]}`}>
                        {emp.role.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-2 text-xs text-gray-600">
                          <Mail className="h-4 w-4 text-blue-500" />
                          {emp.email || "--"}
                        </span>
                        <span className="inline-flex items-center gap-2 text-xs text-gray-600">
                          <Phone className="h-4 w-4 text-blue-500" />
                          {emp.phone || "--"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${emp.isActive ? "bg-green-100 text-green-700 border border-green-200" : "bg-gray-100 text-gray-600 border border-gray-200"}`}>
                        {emp.isActive ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{formatDate(emp.createdAt)}</td>
                    <td className="px-5 py-4 space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(emp)} className="border-blue-200 text-blue-700 hover:bg-blue-50">
                        Modifier
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => emp.isActive ? askDeactivate(emp) : toggleActive(emp)}
                        className={emp.isActive ? "border-red-200 text-red-700 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}
                        disabled={saving}
                      >
                        {emp.isActive ? "Desactiver" : "Activer"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-t border-slate-100 text-sm text-gray-600">
          <div>
            Affichage {pageEmployees.length === 0 ? 0 : (page - 1) * pageSize + 1}-{(page - 1) * pageSize + pageEmployees.length} sur {filteredEmployees.length} enregistrements
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="border-slate-200 text-gray-700 hover:bg-slate-50">
              Precedent
            </Button>
            <span className="text-xs text-gray-500">Page {page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="border-slate-200 text-gray-700 hover:bg-slate-50">
              Suivant
            </Button>
          </div>
        </div>
      </div>

      {/* Task Calendar and Team Overview Section */}
      <div className="grid gap-4 lg:grid-cols-3 max-w-6xl mx-auto">
        {/* Task Calendar Section - replaces old holiday calendars */}
        <TaskCalendarSection employees={taskEmployees} />

        {/* Team quick view */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Equipe en vue</h3>
              <p className="text-sm text-gray-500">Membres recents avec statut.</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-gray-700">
              {Math.min(pageEmployees.length, 5)} affiches
            </span>
          </div>
          <div className="space-y-2">
            {pageEmployees.slice(0, 5).map((emp) => (
              <div key={emp.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{emp.fullName}</p>
                  <p className="text-xs text-gray-600">{emp.role.replace(/_/g, " ")} • {emp.email || emp.phone || "Contact --"}</p>
                </div>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${emp.isActive ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-600 border border-gray-200"}`}>
                  {emp.isActive ? "Actif" : "Inactif"}
                </span>
              </div>
            ))}
            {pageEmployees.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-4">Aucun employe a afficher</div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Employee Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">{headerTitle}</h3>
              <Button variant="ghost" onClick={() => setFormOpen(false)}>Fermer</Button>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">
                Nom complet
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                  placeholder="Prenom Nom"
                  className="mt-1"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Email
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="exemple@domaine.com"
                  className="mt-1"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Telephone
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+216 ..."
                  className="mt-1"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Role
                <select
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as Role }))}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="PRODUCT_MANAGER">PRODUCT_MANAGER</option>
                  <option value="ORDER_MANAGER">ORDER_MANAGER</option>
                </select>
              </label>
              {editingId && (
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  Activer l'acces
                </label>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setFormOpen(false)}>Annuler</Button>
              <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                {saving ? "En cours..." : "Enregistrer"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={deactivateDialogOpen}
        onOpenChange={(open) => {
          setDeactivateDialogOpen(open);
          if (!open && !deactivateLoading) setEmployeeToDeactivate(null);
        }}
        title="Desactiver cet employe ?"
        description={`Cette action desactivera ${employeeToDeactivate?.fullName ?? "cet employe"} et retirera son acces actif.`}
        confirmLabel="Desactiver"
        cancelLabel="Annuler"
        loading={deactivateLoading}
        onConfirm={deactivate}
      />
    </div>
  );
}
