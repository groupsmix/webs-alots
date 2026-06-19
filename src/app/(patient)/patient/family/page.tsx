"use client";

import { UserPlus, Phone, Edit2, Trash2, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import {
  getCurrentUser,
  fetchFamilyMembers,
  createFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  type FamilyMemberView,
  type ClinicUser,
} from "@/lib/data/client";

const RELATIONSHIPS = ["Wife", "Husband", "Son", "Daughter", "Parent", "Sibling", "Other"];

const relationColors: Record<string, string> = {
  Wife: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  Husband: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Son: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Daughter: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  Parent: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

export default function FamilyMembersPage() {
  const { addToast } = useToast();
  const [members, setMembers] = useState<FamilyMemberView[]>([]);
  const [user, setUser] = useState<ClinicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", relationship: "Wife", phone: "" });

  useEffect(() => {
    (async () => {
      try {
        const u = await getCurrentUser();
        setUser(u);
        if (u?.id) {
          setMembers(await fetchFamilyMembers(u.id));
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load family members");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm({ name: "", relationship: "Wife", phone: "" });
    setDialogOpen(true);
  }

  function openEdit(member: FamilyMemberView) {
    setEditingId(member.id);
    setForm({ name: member.name, relationship: member.relationship, phone: member.phone ?? "" });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    if (!user?.id || !user.clinic_id) {
      addToast("Your account is not linked to a clinic.", "error");
      return;
    }
    setSaving(true);
    const res = editingId
      ? await updateFamilyMember(editingId, user.id, {
          name: form.name.trim(),
          relationship: form.relationship,
          phone: form.phone.trim(),
        })
      : await createFamilyMember({
          primaryUserId: user.id,
          clinicId: user.clinic_id,
          name: form.name.trim(),
          relationship: form.relationship,
          phone: form.phone.trim(),
        });
    setSaving(false);
    if (!res.success) {
      addToast(res.error.message || "Could not save family member", "error");
      return;
    }
    const saved = res.data;
    setMembers((prev) =>
      editingId ? prev.map((m) => (m.id === editingId ? saved : m)) : [...prev, saved],
    );
    addToast(editingId ? "Family member updated" : "Family member added", "success");
    setDialogOpen(false);
    setEditingId(null);
    setForm({ name: "", relationship: "Wife", phone: "" });
  }

  async function handleDelete(id: string) {
    if (!user?.id) {
      addToast("Your account is not linked to a clinic.", "error");
      return;
    }
    const previous = members;
    setMembers((m) => m.filter((x) => x.id !== id));
    setDeleteId(null);
    const res = await deleteFamilyMember(id, user.id);
    if (!res.success) {
      setMembers(previous);
      addToast(res.error.message || "Could not remove family member", "error");
    } else {
      addToast("Family member removed", "success");
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Patient", href: "/patient/dashboard" }, { label: "Family" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Family Members</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage family members under your account.
            {!loading && !loadError
              ? ` ${members.length} member${members.length !== 1 ? "s" : ""} added.`
              : ""}
          </p>
        </div>
        <Button onClick={openAdd} disabled={loading || !!loadError}>
          <UserPlus className="h-4 w-4 mr-1" />
          Add Member
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading family members...
        </div>
      ) : loadError ? (
        <Card>
          <CardContent className="p-8 text-center text-destructive">{loadError}</CardContent>
        </Card>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <UserPlus className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No family members yet.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openAdd}>
              Add your first family member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <Card key={member.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{member.name}</p>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${relationColors[member.relationship] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {member.relationship}
                    </span>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{member.phone || "\u2014"}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-4 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEdit(member)}
                  >
                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(member.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingId(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Family Member" : "Add Family Member"}</DialogTitle>
            <DialogDescription>
              Add a spouse, child, or other family member to your account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="memberName">Full Name</Label>
              <Input
                id="memberName"
                placeholder="First and last name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="memberRelation">Relationship</Label>
                <select
                  id="memberRelation"
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.relationship}
                  onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                >
                  {RELATIONSHIPS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="memberPhone">Phone (optional)</Label>
                <Input
                  id="memberPhone"
                  type="tel"
                  placeholder="+212 6XX XX XX XX"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Family Member"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Family Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this family member from your account?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
