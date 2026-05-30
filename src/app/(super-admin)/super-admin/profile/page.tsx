/* eslint-disable i18next/no-literal-string */
"use client";

import { User, Mail, Shield, Clock, Save, Lock, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-client";

interface AdminProfile {
  email: string;
  name: string;
  role: string;
  lastSignIn: string | null;
}

export default function ProfilePage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRow } = await supabase
        .from("users") // nosemgrep: tenant-scoping — super-admin querying own profile by auth_id
        .select("name, role")
        .eq("auth_id", user.id)
        .single();

      setProfile({
        email: user.email ?? "",
        name: userRow?.name ?? user.user_metadata?.name ?? "",
        role: userRow?.role ?? "super_admin",
        lastSignIn: user.last_sign_in_at ?? null,
      });
      setName(userRow?.name ?? user.user_metadata?.name ?? "");
    } catch (err) {
      logger.warn("Failed to load profile", { context: "page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function handleSaveName() {
    if (!profile || !name.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // nosemgrep: tenant-scoping — super-admin updating own profile by auth_id
      await supabase.from("users").update({ name: name.trim() }).eq("auth_id", user.id);

      await supabase.auth.updateUser({
        data: { name: name.trim() },
      });

      setProfile((prev) => (prev ? { ...prev, name: name.trim() } : prev));
      addToast("Profile updated successfully", "success");
    } catch (err) {
      logger.warn("Failed to update profile", { context: "page", error: err });
      addToast("Failed to update profile", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 8) {
      addToast("Password must be at least 8 characters", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast("Passwords do not match", "error");
      return;
    }
    setChangingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      addToast("Password changed successfully", "success");
    } catch (err) {
      logger.warn("Failed to change password", { context: "page", error: err });
      addToast("Failed to change password", "error");
    } finally {
      setChangingPassword(false);
    }
  }

  const initials = profile?.name
    ? profile.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "SA";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Profile" }]}
      />

      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <Card className="md:col-span-1">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <Avatar className="h-20 w-20 mb-4">
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <h2 className="text-lg font-semibold">{profile?.name || "Super Admin"}</h2>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
            <Badge className="mt-2 capitalize">{profile?.role?.replace("_", " ")}</Badge>
            {profile?.lastSignIn && (
              <p className="text-xs text-muted-foreground mt-3">
                <Clock className="inline h-3 w-3 mr-1" />
                Last login: {new Date(profile.lastSignIn).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Edit Profile */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Input id="email" value={profile?.email ?? ""} disabled className="bg-muted" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your display name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="role"
                    value={profile?.role?.replace("_", " ") ?? ""}
                    disabled
                    className="bg-muted capitalize"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveName} disabled={saving || name === profile?.name}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  <Save className="h-4 w-4 mr-1" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 8 characters)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleChangePassword}
                  disabled={changingPassword || !currentPassword || !newPassword}
                >
                  {changingPassword && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  <Lock className="h-4 w-4 mr-1" />
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
