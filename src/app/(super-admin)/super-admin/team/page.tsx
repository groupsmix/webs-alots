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
  Ban,
  CheckCircle2,
  Trash2,
  Clock,
  Activity,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useState, useCallback } from "react";
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

// ---------- Types ----------

type AdminRole = "super_admin" | "support_staff" | "viewer";
type AdminStatus = "active" | "disabled";

interface AdminMember {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
  last_login: string | null;
  created_at: string;
  recent_actions: AdminAction[];
}

interface AdminAction {
  id: string;
  action: string;
  target: string;
  timestamp: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  invited_at: string;
  invited_by: string;
}

// ---------- Mock Data ----------

const MOCK_ADMINS: AdminMember[] = [
  {
    id: "admin-1",
    name: "Youssef El Amrani",
    email: "youssef@oltigo.com",
    role: "super_admin",
    status: "active",
    last_login: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    created_at: "2024-01-15T10:00:00Z",
    recent_actions: [
      {
        id: "a1",
        action: "Created clinic",
        target: "Clinique Atlas",
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
      {
        id: "a2",
        action: "Updated pricing tier",
        target: "Pro → Enterprise",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "a3",
        action: "Disabled user",
        target: "receptionist@demo.com",
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
];

const MOCK_INVITATIONS: PendingInvitation[] = [];

// ---------- Helpers ----------

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  support_staff: "Support Staff",
  viewer: "Viewer",
};

const ROLE_COLORS: Record<AdminRole, "default" | "secondary" | "destructive"> = {
  super_admin: "default",
  support_staff: "secondary",
  viewer: "secondary",
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

  const [admins, setAdmins] = useState<AdminMember[]>(MOCK_ADMINS);
  const [invitations, setInvitations] = useState<PendingInvitation[]>(MOCK_INVITATIONS);
  const [search, setSearch] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AdminRole>("support_staff");

  // Edit role dialog
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminMember | null>(null);
  const [editNewRole, setEditNewRole] = useState<AdminRole>("support_staff");

  // Remove confirmation dialog
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<AdminMember | null>(null);

  const filtered = admins.filter((a) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
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

  function handleInvite() {
    if (!inviteEmail.trim() || !inviteName.trim()) {
      addToast("Name and email are required", "error");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      addToast("Please enter a valid email address", "error");
      return;
    }

    const newInvite: PendingInvitation = {
      id: `inv-${Date.now()}`,
      email: inviteEmail,
      name: inviteName,
      role: inviteRole,
      invited_at: new Date().toISOString(),
      invited_by: "Current Admin",
    };
    setInvitations((prev) => [newInvite, ...prev]);
    addToast(`Invitation sent to ${inviteEmail}`, "success");
    setInviteOpen(false);
    setInviteName("");
    setInviteEmail("");
    setInviteRole("support_staff");
  }

  // ---------- Toggle Status ----------

  function toggleStatus(admin: AdminMember) {
    setAdmins((prev) =>
      prev.map((a) =>
        a.id === admin.id
          ? {
              ...a,
              status:
                a.status === "active" ? ("disabled" as AdminStatus) : ("active" as AdminStatus),
            }
          : a,
      ),
    );
    const newStatus = admin.status === "active" ? "disabled" : "enabled";
    addToast(`${admin.name} has been ${newStatus}`, "success");
  }

  // ---------- Edit Role ----------

  function openEditRole(admin: AdminMember) {
    setEditTarget(admin);
    setEditNewRole(admin.role);
    setEditRoleOpen(true);
  }

  function handleEditRole() {
    if (!editTarget) return;
    setAdmins((prev) =>
      prev.map((a) => (a.id === editTarget.id ? { ...a, role: editNewRole } : a)),
    );
    addToast(`${editTarget.name}'s role updated to ${ROLE_LABELS[editNewRole]}`, "success");
    setEditRoleOpen(false);
    setEditTarget(null);
  }

  // ---------- Remove ----------

  function openRemove(admin: AdminMember) {
    setRemoveTarget(admin);
    setRemoveOpen(true);
  }

  function handleRemove() {
    if (!removeTarget) return;
    setAdmins((prev) => prev.filter((a) => a.id !== removeTarget.id));
    addToast(`${removeTarget.name} has been removed`, "success");
    setRemoveOpen(false);
    setRemoveTarget(null);
  }

  // ---------- Remove Invitation ----------

  function removeInvitation(invId: string) {
    setInvitations((prev) => prev.filter((i) => i.id !== invId));
    addToast("Invitation revoked", "info");
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
            Manage super admin users, roles, and permissions
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Team Member
        </Button>
      </div>

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
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
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
                            aria-label={isExpanded ? "Collapse actions" : "Expand actions"}
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
                        <td className="py-3 px-4 text-muted-foreground">{admin.email}</td>
                        <td className="py-3 px-4">
                          <Badge variant={ROLE_COLORS[admin.role]} className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            {ROLE_LABELS[admin.role]}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {formatRelativeTime(admin.last_login)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={admin.status === "active" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {admin.status === "active" ? (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            ) : (
                              <Ban className="h-3 w-3 mr-1" />
                            )}
                            {admin.status}
                          </Badge>
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
                              <DropdownMenuItem onClick={() => toggleStatus(admin)}>
                                {admin.status === "active" ? (
                                  <>
                                    <Ban className="h-4 w-4 mr-2" />
                                    Disable
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Enable
                                  </>
                                )}
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
                      {/* Expanded: Recent Actions */}
                      {isExpanded && (
                        <tr className="bg-muted/20">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="ml-12">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                  <Activity className="h-3.5 w-3.5" />
                                  Recent Actions
                                </h4>
                                <Link href={`/super-admin/analytics?admin=${admin.id}`}>
                                  <Button variant="ghost" size="sm" className="text-xs">
                                    <Eye className="h-3 w-3 mr-1" />
                                    View Full Audit Log
                                  </Button>
                                </Link>
                              </div>
                              {admin.recent_actions.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No recent actions.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {admin.recent_actions.map((action) => (
                                    <div
                                      key={action.id}
                                      className="flex items-center gap-3 text-xs"
                                    >
                                      <span className="text-muted-foreground w-20 shrink-0">
                                        {formatRelativeTime(action.timestamp)}
                                      </span>
                                      <span>{action.action}</span>
                                      <span className="text-muted-foreground">
                                        → {action.target}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
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

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Invitations
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-4 font-medium">Name</th>
                      <th className="text-left py-3 px-4 font-medium">Email</th>
                      <th className="text-left py-3 px-4 font-medium">Role</th>
                      <th className="text-left py-3 px-4 font-medium">Invited</th>
                      <th className="text-left py-3 px-4 font-medium">Invited By</th>
                      <th className="text-left py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv) => (
                      <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-3 px-4 font-medium">{inv.name}</td>
                        <td className="py-3 px-4 text-muted-foreground">{inv.email}</td>
                        <td className="py-3 px-4">
                          <Badge variant={ROLE_COLORS[inv.role]} className="text-xs">
                            {ROLE_LABELS[inv.role]}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {formatRelativeTime(inv.invited_at)}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{inv.invited_by}</td>
                        <td className="py-3 px-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => removeInvitation(inv.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Revoke
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Team Member
            </DialogTitle>
            <DialogDescription>
              Send an invitation to join the super admin team. They will receive an email with
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
                  <SelectItem value="support_staff">Support Staff</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {inviteRole === "super_admin" &&
                  "Full access to all platform features and settings."}
                {inviteRole === "support_staff" &&
                  "Can manage clinics and users, but cannot change platform settings."}
                {inviteRole === "viewer" && "Read-only access to dashboards and reports."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite}>
              <Send className="h-4 w-4 mr-2" />
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
                <SelectItem value="support_staff">Support Staff</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
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

// Fragment helper for expandable rows
function Fragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
