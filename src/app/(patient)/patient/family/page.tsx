"use client";

import { UserPlus, Phone, Edit2, Trash2 } from "lucide-react";
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
import { PageLoader } from "@/components/ui/page-loader";
import {
  getCurrentUser,
  fetchFamilyMembers,
  createFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  type FamilyMemberView,
} from "@/lib/data/client";
import { logger } from "@/lib/logger";

const relationColors: Record<string, string> = {
  Wife: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  Husband: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Son: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Daughter: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  Parent: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const emptyForm = { name: "", relationship: "Wife", phone: "" };

export default function FamilyMembersPage() {
  const [members, setMembers] = useState<FamilyMemberView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      setClinicId(user.clinic_id);
      const data = await fetchFamilyMembers(user.id);
      if (controller.signal.aborted) return;
      setMembers(data);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        logger.warn("Failed to load family members", { context: "patient/family", error: err });
        setLoadError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setSuccess(false);
    setFormOpen(true);
  }

  function openEdit(member: FamilyMemberView) {
    setEditingId(member.id);
    setForm({ name: member.name, relationship: member.relationship, phone: member.phone ?? "" });
    setFormError(null);
    setSuccess(false);
    setFormOpen(true);
  }

  async function handleSubmit() {
    if (!userId || !clinicId) {
      setFormError("Your account is not linked to a clinic, so family members cannot be saved.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const phone = form.phone.trim() || null;
      if (editingId) {
        const ok = await updateFamilyMember(editingId, {
          name: form.name.trim(),
          relationship: form.relationship,
          phone,
        });
        if (!ok) throw new Error("update failed");
        setMembers((prev) =>
          prev.map((m) =>
            m.id === editingId
              ? { ...m, name: form.name.trim(), relationship: form.relationship, phone }
              : m,
          ),
        );
      } else {
        const created = await createFamilyMember({
          primaryUserId: userId,
          clinicId,
          name: form.name.trim(),
          relationship: form.relationship,
          phone,
        });
        if (!created) throw new Error("create failed");
        setMembers((prev) => [...prev, created]);
      }
      setSuccess(true);
      setTimeout(() => {
        setFormOpen(false);
        setSuccess(false);
        setEditingId(null);
        setForm(emptyForm);
      }, 1200);
    } catch (err) {
      logger.warn("Failed to save family member", { context: "patient/family", error: err });
      setFormError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const ok = await deleteFamilyMember(id);
      if (!ok) throw new Error("delete failed");
      setMembers((prev) => prev.filter((m) => m.id !== id));
      setDeleteId(null);
    } catch (err) {
      logger.warn("Failed to delete family member", { context: "patient/family", error: err });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <PageLoader message="Loading family members..." />;

  if (loadError) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load family members.</p>
        {loadError.message && (
          <p className="text-sm text-muted-foreground mt-2">{loadError.message}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Patient", href: "/patient/dashboard" }, { label: "Family" }]} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Family Members</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage family members under your account. {members.length} member
            {members.length !== 1 ? "s" : ""} added.
          </p>
        </div>
        <Button onClick={openAdd}>
          <UserPlus className="h-4 w-4 mr-1" />
          Add Member
        </Button>
      </div>

      {members.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No family members yet. Use “Add Member” to add a spouse, child, or relative.
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
                        .join("")}
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
                    <span>{member.phone ?? "—"}</span>
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Family Member" : "Add Family Member"}</DialogTitle>
            <DialogDescription>
              Add a spouse, child, or other family member to your account.
            </DialogDescription>
          </DialogHeader>
          {success ? (
            <div className="text-center py-6">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center mx-auto mb-3">
                <UserPlus className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                {editingId ? "Family member updated." : "Family member added."}
              </p>
            </div>
          ) : (
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
                    <option value="Wife">Wife</option>
                    <option value="Husband">Husband</option>
                    <option value="Son">Son</option>
                    <option value="Daughter">Daughter</option>
                    <option value="Parent">Parent</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="memberPhone">Phone</Label>
                  <Input
                    id="memberPhone"
                    type="tel"
                    placeholder="+212 6XX XX XX XX"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={saving || !form.name.trim()}
              >
                {saving
                  ? editingId
                    ? "Saving..."
                    : "Adding..."
                  : editingId
                    ? "Save Changes"
                    : "Add Family Member"}
              </Button>
            </div>
          )}
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
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {deleting ? "Removing..." : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
