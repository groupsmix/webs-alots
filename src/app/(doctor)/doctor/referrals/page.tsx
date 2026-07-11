"use client";

import { ArrowRightLeft, Send, Inbox, CheckCircle, XCircle, Clock } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/loading-skeleton";

interface Referral {
  id: string;
  clinic_id: string;
  referring_doctor_id: string;
  referred_to_doctor_id: string;
  patient_id: string;
  reason: string;
  notes: string | null;
  status: "pending" | "accepted" | "declined" | "completed";
  whatsapp_notified: boolean;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG = {
  pending: { icon: Clock, color: "text-yellow-600", badge: "warning" as const },
  accepted: { icon: CheckCircle, color: "text-green-600", badge: "default" as const },
  declined: { icon: XCircle, color: "text-red-600", badge: "destructive" as const },
  completed: { icon: CheckCircle, color: "text-blue-600", badge: "default" as const },
};

export default function ReferralsPage() {
  const [direction, setDirection] = useState<"all" | "sent" | "received">("all");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/referrals?direction=${direction}`);
      const json = await res.json();
      if (json.ok) {
        setReferrals(json.data.referrals);
      }
    } finally {
      setLoading(false);
    }
  }, [direction]);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    timeouts.push(
      setTimeout(() => {
        fetchReferrals();
      }, 0),
    );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [fetchReferrals]);

  const updateStatus = async (
    referralId: string,
    status: "accepted" | "declined" | "completed",
  ) => {
    setUpdating(referralId);
    try {
      const res = await fetch("/api/referrals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralId, status }),
      });
      const json = await res.json();
      if (json.ok) {
        setReferrals((prev) => prev.map((r) => (r.id === referralId ? { ...r, status } : r)));
      }
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb items={[{ label: "Doctor" }, { label: "Referrals" }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Patient Referrals</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setDirection("all")}
            className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm ${direction === "all" ? "bg-primary text-white" : "bg-muted"}`}
          >
            <ArrowRightLeft className="h-3 w-3" /> All
          </button>
          <button
            onClick={() => setDirection("sent")}
            className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm ${direction === "sent" ? "bg-primary text-white" : "bg-muted"}`}
          >
            <Send className="h-3 w-3" /> Sent
          </button>
          <button
            onClick={() => setDirection("received")}
            className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm ${direction === "received" ? "bg-primary text-white" : "bg-muted"}`}
          >
            <Inbox className="h-3 w-3" /> Received
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : referrals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ArrowRightLeft className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <p className="text-muted-foreground">No referrals found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {referrals.map((referral) => {
            const config = STATUS_CONFIG[referral.status];
            const StatusIcon = config.icon;

            return (
              <Card key={referral.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={`rounded-full bg-gray-100 p-2 ${config.color}`}>
                      <StatusIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{referral.reason}</p>
                      <p className="text-muted-foreground text-sm">
                        {new Date(referral.created_at).toLocaleDateString()}
                        {referral.notes && ` · ${referral.notes}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant={config.badge}>{referral.status}</Badge>

                    {referral.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(referral.id, "accepted")}
                          disabled={updating === referral.id}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateStatus(referral.id, "declined")}
                          disabled={updating === referral.id}
                        >
                          Decline
                        </Button>
                      </div>
                    )}

                    {referral.status === "accepted" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(referral.id, "completed")}
                        disabled={updating === referral.id}
                      >
                        Complete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
