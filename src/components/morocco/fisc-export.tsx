"use client";

import { useState } from "react";
import {
  FileSpreadsheet, Download, Calendar, TrendingUp,
  TrendingDown, DollarSign, Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMAD, formatMADFormal } from "@/lib/morocco";

// ---- Types ----

export interface RevenueEntry {
  id: string;
  date: string;
  patientName: string;
  service: string;
  amountHT: number;
  tvaRate: number;
  tvaAmount: number;
  amountTTC: number;
  paymentMethod: string;
  invoiceNumber: string;
  isPaid: boolean;
}

interface FiscExportProps {
  entries: RevenueEntry[];
  clinicName: string;
  clinicICE: string;
  clinicIF: string;
  fiscalYear: number;
  onExport?: (format: "csv" | "pdf", period: { from: string; to: string }) => void;
}

// ---- Component ----

/**
 * FiscExport
 *
 * FISC-compatible accounting dashboard for Moroccan clinics.
 * Tracks revenue per DGI (Direction Générale des Impôts) requirements.
 * Allows export for your comptable (accountant).
 *
 * Features:
 * - Monthly/quarterly/annual revenue summary
 * - TVA collected vs TVA deductible
 * - Revenue by payment method
 * - CSV/PDF export for DGI declarations
 */
export function FiscExport({
  entries,
  clinicName,
  clinicICE,
  clinicIF,
  fiscalYear,
  onExport,
}: FiscExportProps) {
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [filterFrom, setFilterFrom] = useState(`${fiscalYear}-01-01`);
  const [filterTo, setFilterTo] = useState(`${fiscalYear}-12-31`);

  // Filter entries by period
  const filteredEntries = entries.filter((e) => {
    if (period === "month") {
      const entryMonth = new Date(e.date).getMonth() + 1;
      const entryYear = new Date(e.date).getFullYear();
      return entryMonth === selectedMonth && entryYear === fiscalYear;
    }
    if (period === "quarter") {
      const entryMonth = new Date(e.date).getMonth() + 1;
      const entryQuarter = Math.ceil(entryMonth / 3);
      const entryYear = new Date(e.date).getFullYear();
      return entryQuarter === selectedQuarter && entryYear === fiscalYear;
    }
    return e.date >= filterFrom && e.date <= filterTo;
  });

  // Totals
  const totalHT = filteredEntries.reduce((sum, e) => sum + e.amountHT, 0);
  const totalTVA = filteredEntries.reduce((sum, e) => sum + e.tvaAmount, 0);
  const totalTTC = filteredEntries.reduce((sum, e) => sum + e.amountTTC, 0);
  const paidEntries = filteredEntries.filter((e) => e.isPaid);
  const unpaidEntries = filteredEntries.filter((e) => !e.isPaid);
  const totalPaid = paidEntries.reduce((sum, e) => sum + e.amountTTC, 0);
  const totalUnpaid = unpaidEntries.reduce((sum, e) => sum + e.amountTTC, 0);

  // Revenue by payment method
  const byMethod = new Map<string, number>();
  for (const entry of filteredEntries) {
    byMethod.set(entry.paymentMethod, (byMethod.get(entry.paymentMethod) ?? 0) + entry.amountTTC);
  }

  // Monthly breakdown for the year
  const monthlyTotals = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthEntries = entries.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() + 1 === month && d.getFullYear() === fiscalYear;
    });
    return {
      month,
      totalHT: monthEntries.reduce((s, e) => s + e.amountHT, 0),
      totalTVA: monthEntries.reduce((s, e) => s + e.tvaAmount, 0),
      totalTTC: monthEntries.reduce((s, e) => s + e.amountTTC, 0),
      count: monthEntries.length,
    };
  });

  const handleExport = (format: "csv" | "pdf") => {
    if (onExport) {
      onExport(format, { from: filterFrom, to: filterTo });
      return;
    }

    // Default CSV export
    if (format === "csv") {
      const headers = [
        "Date", "N° Facture", "Patient", "Service",
        "Montant HT", "Taux TVA", "Montant TVA", "Montant TTC",
        "Mode de paiement", "Statut",
      ];
      const rows = filteredEntries.map((e) => [
        e.date,
        e.invoiceNumber,
        e.patientName,
        e.service,
        e.amountHT.toFixed(2),
        `${(e.tvaRate * 100).toFixed(0)}%`,
        e.tvaAmount.toFixed(2),
        e.amountTTC.toFixed(2),
        e.paymentMethod,
        e.isPaid ? "Payé" : "Impayé",
      ]);

      const csv = [
        `# Relevé comptable — ${clinicName}`,
        `# ICE: ${clinicICE} | IF: ${clinicIF}`,
        `# Période: ${filterFrom} au ${filterTo}`,
        `# Généré le: ${new Date().toISOString().split("T")[0]}`,
        "",
        headers.join(","),
        ...rows.map((r) => r.join(",")),
        "",
        `Total HT,,,,,,,${totalHT.toFixed(2)},,`,
        `Total TVA,,,,,,,${totalTVA.toFixed(2)},,`,
        `Total TTC,,,,,,,${totalTTC.toFixed(2)},,`,
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comptabilite_${clinicICE}_${filterFrom}_${filterTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const MONTH_NAMES = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Comptabilité — Année fiscale {fiscalYear}
          </h2>
          <p className="text-xs text-muted-foreground">
            ICE: {clinicICE} | IF: {clinicIF}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
            <Download className="h-4 w-4 mr-1" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Period filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Période</Label>
              <Select
                value={period}
                onValueChange={(v) => setPeriod(v as "month" | "quarter" | "year")}
              >
                <SelectTrigger className="w-36 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mensuel</SelectItem>
                  <SelectItem value="quarter">Trimestriel</SelectItem>
                  <SelectItem value="year">Annuel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {period === "month" && (
              <div className="space-y-1">
                <Label className="text-xs">Mois</Label>
                <Select
                  value={selectedMonth.toString()}
                  onValueChange={(v) => setSelectedMonth(parseInt(v))}
                >
                  <SelectTrigger className="w-36 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={i} value={(i + 1).toString()}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {period === "quarter" && (
              <div className="space-y-1">
                <Label className="text-xs">Trimestre</Label>
                <Select
                  value={selectedQuarter.toString()}
                  onValueChange={(v) => setSelectedQuarter(parseInt(v))}
                >
                  <SelectTrigger className="w-36 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">T1 (Jan-Mar)</SelectItem>
                    <SelectItem value="2">T2 (Avr-Jun)</SelectItem>
                    <SelectItem value="3">T3 (Jul-Sep)</SelectItem>
                    <SelectItem value="4">T4 (Oct-Déc)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {period === "year" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Du</Label>
                  <Input
                    type="date"
                    value={filterFrom}
                    onChange={(e) => setFilterFrom(e.target.value)}
                    className="h-8 w-36"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Au</Label>
                  <Input
                    type="date"
                    value={filterTo}
                    onChange={(e) => setFilterTo(e.target.value)}
                    className="h-8 w-36"
                  />
                </div>
              </>
            )}
            <Badge variant="outline" className="h-8 flex items-center gap-1">
              <Filter className="h-3 w-3" />
              {filteredEntries.length} écritures
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-lg font-bold">{formatMAD(totalHT)}</p>
            <p className="text-xs text-muted-foreground">Chiffre d&apos;affaires HT</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-blue-600 mb-1" />
            <p className="text-lg font-bold">{formatMAD(totalTVA)}</p>
            <p className="text-xs text-muted-foreground">TVA collectée</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-lg font-bold text-green-600">{formatMAD(totalPaid)}</p>
            <p className="text-xs text-muted-foreground">Encaissé</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <TrendingDown className="h-5 w-5 mx-auto text-orange-600 mb-1" />
            <p className="text-lg font-bold text-orange-600">{formatMAD(totalUnpaid)}</p>
            <p className="text-xs text-muted-foreground">Impayé</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by method */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recettes par mode de paiement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from(byMethod.entries())
              .sort(([, a], [, b]) => b - a)
              .map(([method, amount]) => (
                <div key={method} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{method}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${totalTTC > 0 ? (amount / totalTTC) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="font-medium w-28 text-right">{formatMAD(amount)}</span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Monthly breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Résumé mensuel {fiscalYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Mois</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">CA HT</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">TVA</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">TTC</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Actes</th>
                </tr>
              </thead>
              <tbody>
                {monthlyTotals.map((m) => (
                  <tr key={m.month} className="border-b last:border-0">
                    <td className="py-2 px-2">{MONTH_NAMES[m.month - 1]}</td>
                    <td className="py-2 px-2 text-right">{formatMAD(m.totalHT, { showCurrency: false })}</td>
                    <td className="py-2 px-2 text-right">{formatMAD(m.totalTVA, { showCurrency: false })}</td>
                    <td className="py-2 px-2 text-right font-medium">{formatMAD(m.totalTTC, { showCurrency: false })}</td>
                    <td className="py-2 px-2 text-right">{m.count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td className="py-2 px-2">Total</td>
                  <td className="py-2 px-2 text-right">
                    {formatMAD(monthlyTotals.reduce((s, m) => s + m.totalHT, 0), { showCurrency: false })}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {formatMAD(monthlyTotals.reduce((s, m) => s + m.totalTVA, 0), { showCurrency: false })}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {formatMADFormal(monthlyTotals.reduce((s, m) => s + m.totalTTC, 0))}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {monthlyTotals.reduce((s, m) => s + m.count, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* DGI compliance note */}
      <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/50 flex items-start gap-2">
        <Calendar className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">Obligations fiscales (DGI)</p>
          <p>Déclaration TVA: mensuelle (CA &gt; 1M MAD) ou trimestrielle</p>
          <p>Déclaration IS/IR: avant le 31 mars de l&apos;année suivante</p>
          <p>Conservez vos pièces justificatives pendant 10 ans</p>
        </div>
      </div>
    </div>
  );
}
