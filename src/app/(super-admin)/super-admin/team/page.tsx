/* eslint-disable i18next/no-literal-string */
"use client";

import {
  Shield,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Search,
  MoreHorizontal,
  Eye,
  Trash2,
  Send,
  Sparkles,
  RefreshCw,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { logger } from "@/lib/logger";

// ---------- Types ----------

type AdminRole = "super_admin" | "clinic_admin";

interface AdminMember {
  id: string;
  name: string;
  email: string | null;
  role: AdminRole;
  clinic_id: string | null;
  last_login: string | null;
  created_at: string | null;
}

interface TeamBriefingEntry {
  teamMemberId: string;
  name: string;
  role: string;
  isAvailable: boolean;
  currentTicketCount: number;
  openTickets: number;
  urgentTickets: number;
  stalledOnboardings: number;
  unreadAlerts: number;
  briefing: string | null;
  generatedAt: string | null;
}

// ---------- Helpers ----------

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  clinic_admin: "Clinic Admin",
};

const ROLE_COLORS: Record<AdminRole, "default" | "secondary" | "destructive"> = {
  super_admin: "default",
  clinic_admin: "secondary",
};

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "Just now";
}

// ---------- Component ----------

export default function TeamPage() {
  const { addToast } = useToast();

  const [admins, setAdmins] = useState<AdminMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [briefings, setBriefings] = useState<TeamBriefingEntry[]>([]);
  const [briefingsLoading, setBriefingsLoading] = useState(true);
  const [briefingsGenerating, setBriefingsGenerating] = useState(false);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AdminRole>("clinic_admin");
  const [inviteSending, setInviteSending] = useState(false);

  // Edit role dialog
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminMember | null>(null);
  const [editNewRole, setEditNewRole] = useState<AdminRole>("clinic_admin");

  // Remove confirmation dialog
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<AdminMember | null>(null);

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/team");
      const json = await res.json();
      if (json.ok) {
        setAdmins(json.data.members);
      } else {
        logger.warn("Failed to load team members", { context: "team-page", error: json.error });
      }
    } catch (err) {
      logger.warn("Failed to load team members", { context: "team-page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBriefings = useCallback(async () => {
    setBriefingsLoading(true);
    try {
      const res = await fetch("/api/admin/team/briefings");
      const json = await res.json();
      if (json.ok) {
        setBriefings(json.data.entries ?? []);
      } else {
        logger.warn("Failed to load team briefings", {
          context: "team-page",
          error: json.error,
        });
      }
    } catch (err) {
      logger.warn("Failed to load team briefings", { context: "team-page", error: err });
    } finally {
      setBriefingsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
    loadBriefings();
  }, [loadMembers, loadBriefings]);

  const filtered = admins.filter((a) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      (a.email ?? "").toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q)
    );
  });

  const toggleExpand = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ---------- Invite ----------

  async function handleInvite() {
    if (!inviteEmail.trim() || !inviteName.trim()) {
      addToast("Name and email are required", "error");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      addToast("Please enter a valid email address", "error");
      return;
    }

    setInviteSending(true);
    try {
      const res = await fetch("/api/admin/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "invite",
          name: inviteName,
          email: inviteEmail,
          role: inviteRole,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        addToast(`Invitation sent to ${inviteEmail}`, "success");
        setInviteOpen(false);
        setInviteName("");
        setInviteEmail("");
        setInviteRole("clinic_admin");
        loadMembers();
      } else {
        addToast(json.error ?? "Failed to send invitation", "error");
      }
    } catch {
      addToast("Failed to send invitation", "error");
    } finally {
      setInviteSending(false);
    }
  }

  // ---------- Edit Role ----------

  function openEditRole(admin: AdminMember) {
    setEditTarget(admin);
    setEditNewRole(admin.role);
    setEditRoleOpen(true);
  }

  async function handleEditRole() {
    if (!editTarget) return;
    try {
      const res = await fetch("/api/admin/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: editTarget.id,
          action: "update_role",
          role: editNewRole,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        addToast(`${editTarget.name}'s role updated to ${ROLE_LABELS[editNewRole]}`, "success");
        setEditRoleOpen(false);
        setEditTarget(null);
        loadMembers();
      } else {
        addToast(json.error ?? "Failed to update role", "error");
      }
    } catch {
      addToast("Failed to update role", "error");
    }
  }

  // ---------- Remove ----------

  function openRemove(admin: AdminMember) {
    setRemoveTarget(admin);
    setRemoveOpen(true);
  }

  async function handleRemove() {
    if (!removeTarget) return;
    try {
      const res = await fetch("/api/admin/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: removeTarget.id,
          action: "remove",
        }),
      });
      const json = await res.json();
      if (json.ok) {
        addToast(`${removeTarget.name} has been removed`, "success");
        setRemoveOpen(false);
        setRemoveTarget(null);
        loadMembers();
      } else {
        addToast(json.error ?? "Failed to remove member", "error");
      }
    } catch {
      addToast("Failed to remove member", "error");
    }
  }

  async function handleGenerateBriefings() {
    setBriefingsGenerating(true);
    try {
      const res = await fetch("/api/admin/team/briefings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: true }),
      });
      const json = await res.json();
      if (json.ok) {
        setBriefings(json.data.entries ?? []);
        addToast("Today's team briefings generated", "success");
      } else {
        addToast(json.error ?? "Failed to generate team briefings", "error");
      }
    } catch {
      addToast("Failed to generate team briefings", "error");
    } finally {
      setBriefingsGenerating(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Team" }]}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Team Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage super admin users, roles, permissions, and morning briefings
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Team Member
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Internal morning briefings</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Daily AI-assisted briefings for the internal Oltigo team based on support,
                onboarding, and alerts.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateBriefings}
              disabled={briefingsGenerating}
            >
              {briefingsGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Generate today's briefings
            </Button>
          </div>

          {briefingsLoading ? (
            <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading team briefings…
            </div>
          ) : briefings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No internal briefings available yet. Generate today's briefings to populate this
              workspace.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {briefings.map((entry) => (
                <div key={entry.teamMemberId} className="rounded-lg border p-3 bg-muted/20">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{entry.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {entry.role.replace(/_/g, " ")}
                      </p>
                    </div>
                    <Badge
                      variant={entry.isAvailable ? "success" : "secondary"}
                      className="text-[10px]"
                    >
                      {entry.isAvailable ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                    <Badge variant="outline">Open tickets: {entry.openTickets}</Badge>
                    <Badge variant="outline">Urgent: {entry.urgentTickets}</Badge>
                    <Badge variant="outline">Onboardings: {entry.stalledOnboardings}</Badge>
                    <Badge variant="outline">Alerts: {entry.unreadAlerts}</Badge>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                    {entry.briefing ?? "No briefing generated yet."}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Team Members Table */}
      <Card className="mb-8">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-8 py-3 px-4" />
                  <th className="text-left py-3 px-4 font-medium">Name</th>
                  <th className="text-left py-3 px-4 font-medium">Email</th>
                  <th className="text-left py-3 px-4 font-medium">Role</th>
                  <th className="text-left py-3 px-4 font-medium">Last Login</th>
                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Loading team members...
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      {search ? "No team members match your search." : "No team members found."}
                    </td>
                  </tr>
                )}
                {filtered.map((admin) => {
                  const isExpanded = expandedRows.has(admin.id);
                  return (
                    <Fragment key={admin.id}>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => toggleExpand(admin.id)}
                            className="p-0.5 rounded hover:bg-muted"
                            aria-label={isExpanded ? "Collapse details" : "Expand details"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                              {admin.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </div>
                            <span className="font-medium">{admin.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{admin.email ?? "—"}</td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={ROLE_COLORS[admin.role] ?? "secondary"}
                            className="text-xs"
                          >
                            <Shield className="h-3 w-3 mr-1" />
                            {ROLE_LABELS[admin.role] ?? admin.role}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {formatRelativeTime(admin.last_login)}
                        </td>
                        <td className="py-3 px-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditRole(admin)}>
                                <Shield className="h-4 w-4 mr-2" />
                                Edit Role
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => openRemove(admin)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                      {/* Expanded: Member Details */}
                      {isExpanded && (
                        <tr className="bg-muted/20">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="ml-12 space-y-1 text-xs text-muted-foreground">
                              <p>
                                <strong>ID:</strong> {admin.id}
                              </p>
                              <p>
                                <strong>Joined:</strong>{" "}
                                {admin.created_at
                                  ? new Date(admin.created_at).toLocaleDateString()
                                  : "Unknown"}
                              </p>
                              {admin.clinic_id && (
                                <p>
                                  <strong>Clinic:</strong> {admin.clinic_id}
                                </p>
                              )}
                              <Link href="/super-admin/analytics">
                                <Button variant="ghost" size="sm" className="text-xs mt-1">
                                  <Eye className="h-3 w-3 mr-1" />
                                  View Full Audit Log
                                </Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Team Member
            </DialogTitle>
            <DialogDescription>
              Send an invitation to join the admin team. They will receive an email with
              instructions to set up their account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Name</Label>
              <Input
                id="invite-name"
                placeholder="Full name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="email@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AdminRole)}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="clinic_admin">Clinic Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {inviteRole === "super_admin" &&
                  "Full access to all platform features and settings."}
                {inviteRole === "clinic_admin" && "Can manage their assigned clinic."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviteSending}>
              {inviteSending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={editRoleOpen} onOpenChange={setEditRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Change the role for {editTarget?.name}. This will update their permissions
              immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="edit-role">New Role</Label>
            <Select value={editNewRole} onValueChange={(v) => setEditNewRole(v as AdminRole)}>
              <SelectTrigger id="edit-role" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="clinic_admin">Clinic Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditRole}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{removeTarget?.name}</strong> from the team?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove}>
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Fragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
