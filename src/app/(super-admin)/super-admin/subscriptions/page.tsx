"use client";

import { useState } from "react";
import {
  Search, Filter, Eye, Send, CreditCard, Receipt,
  CheckCircle, Clock, AlertTriangle, Download,
  ChevronDown, ChevronUp, Stethoscope, Crown, Pill,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  clientSubscriptions,
  getTotalMRR,
  getSubscriptionStats,
  systemTypeLabels,
  tierColors,
  statusColors,
  type ClientSubscription,
  type SystemType,
  type TierSlug,
} from "@/lib/pricing-data";

type StatusFilter = "all" | ClientSubscription["status"];
type SystemFilter = "all" | SystemType;

const systemIcons: Record<SystemType, typeof Stethoscope> = {
  doctor: Stethoscope,
  dentist: Crown,
  pharmacy: Pill,
};

export default function SubscriptionsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [systemFilter, setSystemFilter] = useState<SystemFilter>("all");
  const [detailSub, setDetailSub] = useState<ClientSubscription | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderSub, setReminderSub] = useState<ClientSubscription | null>(null);
  const [expandedInvoices, setExpandedInvoices] = useState<string | null>(null);

  const stats = getSubscriptionStats();
  const mrr = getTotalMRR();
  const arr = mrr * 12;

  const filtered = clientSubscriptions.filter((sub) => {
    const q = search.toLowerCase();
    const matchSearch = !q || sub.clinicName.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || sub.status === statusFilter;
    const matchSystem = systemFilter === "all" || sub.systemType === systemFilter;
    return matchSearch && matchStatus && matchSystem;
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case "active": return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
      case "trial": return <Clock className="h-3.5 w-3.5 text-blue-600" />;
      case "past_due": return <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />;
      default: return <AlertTriangle className="h-3.5 w-3.5 text-red-600" />;
    }
  };

  const statusLabel = (status: ClientSubscription["status"]) => {
    const labels: Record<ClientSubscription["status"], string> = {
      active: "Actif",
      trial: "Essai",
      past_due: "Impayé",
      cancelled: "Annulé",
      suspended: "Suspendu",
    };
    return labels[status];
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestion des abonnements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suivi des abonnements clients, facturation et paiements
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">MRR</span>
            </div>
            <p className="text-2xl font-bold">{mrr.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">MAD / mois</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">ARR</span>
            </div>
            <p className="text-2xl font-bold">{arr.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">MAD / an</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Actifs</span>
            </div>
            <p className="text-2xl font-bold">{stats.active}</p>
            <p className="text-xs text-muted-foreground">{stats.trial} en essai</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-xs text-muted-foreground">Problèmes</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.pastDue + stats.cancelled}</p>
            <p className="text-xs text-muted-foreground">{stats.pastDue} impayés, {stats.cancelled} annulés</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher par nom de client..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground mr-1" />
          {(["all", "doctor", "dentist", "pharmacy"] as SystemFilter[]).map((s) => (
            <Button key={s} variant={systemFilter === s ? "default" : "outline"} size="sm" onClick={() => setSystemFilter(s)} className="text-xs">
              {s === "all" ? "Tous" : systemTypeLabels[s as SystemType]}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "active", "trial", "past_due", "suspended", "cancelled"] as StatusFilter[]).map((s) => (
          <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)} className="text-xs">
            {s === "all" ? "Tous" : statusLabel(s as ClientSubscription["status"])}
            <Badge variant="secondary" className="ml-1 text-[10px] px-1">
              {s === "all" ? clientSubscriptions.length : clientSubscriptions.filter((sub) => sub.status === s).length}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Abonnements ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-3 px-4">Client</th>
                  <th className="text-left font-medium py-3 px-4 hidden md:table-cell">Type</th>
                  <th className="text-left font-medium py-3 px-4">Tier</th>
                  <th className="text-left font-medium py-3 px-4 hidden lg:table-cell">Cycle</th>
                  <th className="text-left font-medium py-3 px-4">Montant</th>
                  <th className="text-left font-medium py-3 px-4 hidden lg:table-cell">Période</th>
                  <th className="text-left font-medium py-3 px-4">Statut</th>
                  <th className="text-right font-medium py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub) => {
                  const Icon = systemIcons[sub.systemType];
                  const isInvoicesOpen = expandedInvoices === sub.id;

                  return (
                    <tr key={sub.id} className="border-b last:border-0 hover:bg-muted/50" >
                      <td className="py-3 px-4">
                        <p className="font-medium">{sub.clinicName}</p>
                        <p className="text-xs text-muted-foreground md:hidden">{systemTypeLabels[sub.systemType]}</p>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">{systemTypeLabels[sub.systemType]}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={`text-[10px] ${tierColors[sub.tierSlug]}`}>{sub.tierName}</Badge>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell text-muted-foreground">
                        {sub.billingCycle === "monthly" ? "Mensuel" : "Annuel"}
                      </td>
                      <td className="py-3 px-4 font-medium">{sub.amount.toLocaleString()} {sub.currency}</td>
                      <td className="py-3 px-4 hidden lg:table-cell text-muted-foreground text-xs">
                        {sub.currentPeriodStart} — {sub.currentPeriodEnd}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {statusIcon(sub.status)}
                          <Badge className={`text-[10px] ${statusColors[sub.status]}`}>
                            {statusLabel(sub.status)}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" title="Détails" onClick={() => setDetailSub(sub)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {sub.invoices.length > 0 && (
                            <Button variant="ghost" size="sm" title="Factures" onClick={() => setExpandedInvoices(isInvoicesOpen ? null : sub.id)}>
                              <Receipt className="h-3.5 w-3.5" />
                              {isInvoicesOpen ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
                            </Button>
                          )}
                          {(sub.status === "past_due" || sub.status === "suspended") && (
                            <Button variant="ghost" size="sm" title="Envoyer rappel" className="text-orange-600" onClick={() => { setReminderSub(sub); setReminderOpen(true); }}>
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">Aucun abonnement trouvé.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Expanded Invoices */}
          {expandedInvoices && (() => {
            const sub = clientSubscriptions.find((s) => s.id === expandedInvoices);
            if (!sub) return null;
            return (
              <div className="border-t bg-muted/30 p-4">
                <h4 className="text-sm font-semibold mb-3">Factures — {sub.clinicName}</h4>
                <div className="space-y-2">
                  {sub.invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between rounded-lg border bg-background p-3 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground">{inv.id}</span>
                        <span>{inv.date}</span>
                        <span className="font-medium">{inv.amount.toLocaleString()} MAD</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={inv.status === "paid" ? "success" : inv.status === "overdue" ? "destructive" : inv.status === "refunded" ? "secondary" : "warning"}>
                          {inv.status === "paid" ? "Payé" : inv.status === "overdue" ? "Impayé" : inv.status === "refunded" ? "Remboursé" : "En attente"}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailSub !== null} onOpenChange={() => setDetailSub(null)}>
        {detailSub && (
          <DialogContent onClose={() => setDetailSub(null)} className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{detailSub.clinicName}</DialogTitle>
              <DialogDescription>Détails de l&apos;abonnement</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Type :</span>{" "}
                  <span className="font-medium capitalize">{systemTypeLabels[detailSub.systemType]}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tier :</span>{" "}
                  <Badge className={`text-[10px] ${tierColors[detailSub.tierSlug]}`}>{detailSub.tierName}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Montant :</span>{" "}
                  <span className="font-medium">{detailSub.amount.toLocaleString()} {detailSub.currency}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cycle :</span>{" "}
                  <span>{detailSub.billingCycle === "monthly" ? "Mensuel" : "Annuel"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Début :</span>{" "}
                  <span>{detailSub.currentPeriodStart}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fin :</span>{" "}
                  <span>{detailSub.currentPeriodEnd}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Paiement :</span>{" "}
                  <span>{detailSub.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Renouvellement :</span>{" "}
                  <span>{detailSub.autoRenew ? "Automatique" : "Manuel"}</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Statut :</span>
                <div className="flex items-center gap-1.5">
                  {statusIcon(detailSub.status)}
                  <Badge className={`${statusColors[detailSub.status]}`}>{statusLabel(detailSub.status)}</Badge>
                </div>
              </div>
              {detailSub.trialEndsAt && (
                <p className="text-sm text-muted-foreground">
                  Essai se termine le : <span className="font-medium text-foreground">{detailSub.trialEndsAt}</span>
                </p>
              )}
              {detailSub.cancelledAt && (
                <p className="text-sm text-red-600">
                  Annulé le : {detailSub.cancelledAt}
                </p>
              )}
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-2">Historique de facturation</h4>
                {detailSub.invoices.length > 0 ? (
                  <div className="space-y-2">
                    {detailSub.invoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between text-sm rounded-lg border p-2">
                        <div>
                          <span className="font-mono text-xs text-muted-foreground mr-2">{inv.id}</span>
                          <span>{inv.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{inv.amount.toLocaleString()} MAD</span>
                          <Badge variant={inv.status === "paid" ? "success" : inv.status === "overdue" ? "destructive" : "warning"} className="text-[10px]">
                            {inv.status === "paid" ? "Payé" : inv.status === "overdue" ? "Impayé" : "En attente"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune facture</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailSub(null)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Reminder Dialog */}
      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        {reminderSub && (
          <DialogContent onClose={() => setReminderOpen(false)}>
            <DialogHeader>
              <DialogTitle>Envoyer un rappel de paiement</DialogTitle>
              <DialogDescription>
                Un rappel sera envoyé à {reminderSub.clinicName} pour leur paiement en retard.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
              <p className="text-sm font-medium">{reminderSub.clinicName}</p>
              <p className="text-xs text-muted-foreground">Tier: {reminderSub.tierName} — {reminderSub.amount.toLocaleString()} {reminderSub.currency}</p>
              <p className="text-xs text-red-600">Statut: {statusLabel(reminderSub.status)}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReminderOpen(false)}>Annuler</Button>
              <Button onClick={() => { setReminderOpen(false); setReminderSub(null); }}>
                <Send className="h-4 w-4 mr-1" />
                Envoyer le rappel
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
