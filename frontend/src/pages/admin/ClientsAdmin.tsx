import { useEffect, useState, useMemo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  Users,
  Package,
  Scale,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { ClientsAdminSkeleton } from "@/components/skeletons";
import DotPagination from "@/components/DotPagination";

type Client = {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  purchaseUnit?: "piece" | "quantity";
  clerkId?: string | null;
  createdAt?: string;
};

export default function ClientsAdmin() {
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const location = useLocation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const load = async () => {
    try {
      const res = await api.get("/clients");
      setAllClients(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load clients", err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const term = params.get("search");
    if (term !== null) {
      setSearch(term);
      setCurrentPage(1);
    }
  }, [location.search]);

  const deleteClient = async () => {
    if (!clientToDelete) return;
    try {
      setDeleteLoading(true);
      await api.delete(`/clients/${clientToDelete.id}`);
      await load();
    } catch (err) {
      console.error("Failed to delete client", err);
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  const askDeleteClient = (client: Client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const togglePurchaseUnit = async (id: number, currentUnit: string) => {
    const newUnit = currentUnit === "piece" ? "quantity" : "piece";
    try {
      await api.patch(`/clients/${id}`, { purchaseUnit: newUnit });
      setAllClients((prev) =>
        prev.map((client) =>
          client.id === id ? { ...client, purchaseUnit: newUnit } : client
        )
      );
    } catch (err) {
      console.error("Failed to update purchase unit", err);
    }
  };

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const countBetween = (clients: Client[], start: Date, end: Date) =>
      clients.filter((client) => {
        const created = client.createdAt
          ? new Date(client.createdAt)
          : undefined;
        return created && created >= start && created < end;
      }).length;

    const percentChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const totalThis = countBetween(allClients, thisMonthStart, nextMonthStart);
    const totalLast = countBetween(allClients, lastMonthStart, thisMonthStart);

    const pieceClients = allClients.filter((c) => c.purchaseUnit === "piece");
    const pieceThis = countBetween(pieceClients, thisMonthStart, nextMonthStart);
    const pieceLast = countBetween(pieceClients, lastMonthStart, thisMonthStart);

    const quantityClients = allClients.filter(
      (c) => c.purchaseUnit === "quantity"
    );
    const quantityThis = countBetween(
      quantityClients,
      thisMonthStart,
      nextMonthStart
    );
    const quantityLast = countBetween(
      quantityClients,
      lastMonthStart,
      thisMonthStart
    );

    return {
      total: allClients.length,
      totalPercent: percentChange(totalThis, totalLast),
      piece: pieceClients.length,
      piecePercent: percentChange(pieceThis, pieceLast),
      quantity: quantityClients.length,
      quantityPercent: percentChange(quantityThis, quantityLast),
    };
  }, [allClients]);

  const filteredClients = allClients
    .filter((client) => {
      if (filter === "piece") return client.purchaseUnit === "piece";
      if (filter === "quantity") return client.purchaseUnit === "quantity";
      return true;
    })
    .filter((client) => {
      const term = search.trim().toLowerCase();
      if (!term) return true;
      return (
        client.name?.toLowerCase().includes(term) ||
        client.email?.toLowerCase().includes(term) ||
        client.phone?.toLowerCase().includes(term) ||
        client.clerkId?.toLowerCase().includes(term)
      );
    });

  const indexOfLast = currentPage * perPage;
  const indexOfFirst = indexOfLast - perPage;
  const currentClients = filteredClients.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / perPage));

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    if (currentPage <= 3) return [1, 2, 3, 4, "...", totalPages];
    if (currentPage >= totalPages - 2)
      return [
        1,
        "...",
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    return [
      1,
      "...",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "...",
      totalPages,
    ];
  };

  const exportReport = () => {
    const header = "ID,Nom,Email,Telephone,Type d'achat,Clerk ID\n";
    const rows = allClients
      .map(
        (client) =>
          `${client.id},${client.name || ""},${client.email || ""},${
            client.phone || ""
          },${client.purchaseUnit || ""},${client.clerkId || ""}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clients.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-6">Gestion des clients</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Clients totaux"
          value={stats.total}
          percent={stats.totalPercent}
        />
        <StatCard
          title="Clients a l'unite"
          value={stats.piece}
          percent={stats.piecePercent}
          icon={<Package size={16} className="ml-2" />}
        />
        <StatCard
          title="Clients en gros"
          value={stats.quantity}
          percent={stats.quantityPercent}
          icon={<Scale size={16} className="ml-2" />}
        />
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Tous les clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les clients</SelectItem>
            <SelectItem value="piece">Clients a l'unite</SelectItem>
            <SelectItem value="quantity">Clients en gros</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full md:w-auto flex-1"
        />

        <div className="flex gap-2 w-full md:w-auto">
          <Button onClick={exportReport} className="bg-black text-white hover:bg-white hover:text-black">
            Exporter le rapport
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Client</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Telephone</th>
              <th className="p-3 text-left">Type d'achat</th>
              <th className="p-3 text-left">Clerk ID</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentClients.map((client) => (
              <tr key={client.id} className="border-t hover:bg-gray-50">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <img
                      className="w-10 h-10 rounded-full"
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                        client.name || "Client"
                      )}&background=0D8ABC&color=fff`}
                      alt=""
                    />
                    <div>
                      <div className="font-medium">{client.name || "—"}</div>
                      <div className="text-sm text-muted-foreground">
                        {client.email || "—"}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-3">{client.createdAt || "—"}</td>
                <td className="p-3">{client.phone || "—"}</td>
                <td className="p-3">
                  <button
                    onClick={() =>
                      togglePurchaseUnit(client.id, client.purchaseUnit ?? "piece")
                    }
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      (client.purchaseUnit ?? "piece") === "piece"
                        ? "bg-orange-100 text-orange-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {(client.purchaseUnit ?? "piece") === "piece"
                      ? "Unite"
                      : "Gros"}
                  </button>
                </td>
                <td className="p-3 text-xs text-gray-500 break-all">
                  {client.clerkId || "—"}
                </td>
                <td className="p-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-800"
                    onClick={() => askDeleteClient(client)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </td>
              </tr>
            ))}

            {currentClients.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-4 text-center text-muted-foreground"
                >
                  Aucun client trouve.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
        <div>
          Affichage {filteredClients.length === 0 ? 0 : indexOfFirst + 1} a{" "}
          {Math.min(indexOfLast, filteredClients.length)} sur{" "}
          {filteredClients.length}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={perPage.toString()}
            onValueChange={(value) => {
              setPerPage(parseInt(value));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="8">8 / page</SelectItem>
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="25">25 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
            </SelectContent>
          </Select>
          <DotPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open && !deleteLoading) setClientToDelete(null);
        }}
        title="Supprimer ce client ?"
        description={`Cette action retirera ${
          clientToDelete?.name ?? "ce client"
        } de la liste des clients.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        loading={deleteLoading}
        onConfirm={deleteClient}
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  percent,
  icon,
}: {
  title: string;
  value: number;
  percent: number;
  icon?: ReactNode;
}) {
  const positive = percent >= 0;
  return (
    <div className="bg-white rounded-lg p-4 shadow flex flex-col">
      <div className="flex items-center text-sm text-gray-500 mb-1">
        {title}
        {icon ?? <Users size={16} className="ml-2" />}
      </div>
      <h2 className="text-3xl font-bold">{value}</h2>
      <div
        className={`flex items-center text-sm ${
          positive ? "text-green-500" : "text-red-500"
        }`}
      >
        {positive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
        {Math.abs(percent)}% vs periode precedente
      </div>
    </div>
  );
}
