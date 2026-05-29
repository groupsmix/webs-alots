/* eslint-disable i18next/no-literal-string -- French UI strings */
"use client";

import {
  ChevronLeft,
  ChevronRight,
  Mail,
  RefreshCw,
  UserPlus,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface StaffInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  clinic_admin: "Administrateur",
  receptionist: "Réceptionniste",
  doctor: "Médecin",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  expired: "Expirée",
  revoked: "Révoquée",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  accepted: "default",
  expired: "destructive",
  revoked: "secondary",
};

const STATUS_ICONS: Record<string, typeof Clock> = {
  pending: Clock,
  accepted: CheckCircle,
  expired: XCircle,
  revoked: XCircle,
};

export function StaffInvitationsPanel() {
  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("receptionist");
  const [submitting, setSubmitting] = useState(false);
  const limit = 20;

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      const res = await fetch(`/api/staff-invitations?${params}`);
      const json = await res.json();
      if (json.ok) {
        setInvitations(json.data.invitations);
        setTotal(json.data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/staff-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (res.ok) {
        setEmail("");
        setShowForm(false);
        fetchInvitations();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Invitations du personnel</h2>
          <p className="text-muted-foreground">
            Invitez de nouveaux membres de l&apos;équipe par email
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchInvitations}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            <UserPlus className="h-4 w-4" />
            Inviter
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleInvite} className="rounded-lg border p-4 space-y-4">
          <h3 className="font-medium">Nouvelle invitation</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="invite-email" className="mb-1 block text-sm font-medium">
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@exemple.com"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="invite-role" className="mb-1 block text-sm font-medium">
                Rôle
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="receptionist">Réceptionniste</option>
                <option value="doctor">Médecin</option>
                <option value="clinic_admin">Administrateur</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Mail className="h-4 w-4" />
              {submitting ? "Envoi en cours..." : "Envoyer l'invitation"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : invitations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <Mail className="h-12 w-12" />
          <p>Aucune invitation envoyée</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Rôle</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-left font-medium">Envoyée le</th>
                <th className="px-4 py-3 text-left font-medium">Expire le</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => {
                const StatusIcon = STATUS_ICONS[inv.status] ?? Clock;
                return (
                  <tr key={inv.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3">{inv.email}</td>
                    <td className="px-4 py-3">{ROLE_LABELS[inv.role] ?? inv.role}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANTS[inv.status] ?? "default"}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {STATUS_LABELS[inv.status] ?? inv.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {new Date(inv.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      {new Date(inv.expires_at).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} invitation{total !== 1 ? "s" : ""} au total
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border p-2 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm">
              Page {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border p-2 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
