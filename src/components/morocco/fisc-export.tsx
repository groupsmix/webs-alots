"use client";

import {
  FileSpreadsheet, Download, Calendar, TrendingUp,
  TrendingDown, DollarSign, Filter, FileText, Receipt,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { escapeHtml } from "@/lib/escape-html";
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

/** Optional expense entries for profit calculation */
export interface ExpenseEntry {
  id: string;
  date: string;
  description: string;
  amountHT: number;
  tvaRate: number;
  tvaAmount: number;
  amountTTC: number;
  category: string;
  invoiceNumber?: string;
}

interface FiscExportProps {
  entries: RevenueEntry[];
  /** Optional expenses for profit/loss calculation and TVA deductible */
  expenses?: ExpenseEntry[];
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
  expenses = [],
  clinicName,
  clinicICE,
  clinicIF,
  fiscalYear: initialFiscalYear,
  onExport,
}: FiscExportProps) {
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(initialFiscalYear);
  const [filterFrom, setFilterFrom] = useState(`${initialFiscalYear}-01-01`);
  const [filterTo, setFilterTo] = useState(`${initialFiscalYear}-12-31`);

  // Moroccan fiscal year = calendar year
  const fiscalYear = selectedFiscalYear;
  const fiscalYearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

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

  // Filter expenses by the same period as revenue entries
  const filteredExpenses = expenses.filter((e) => {
    if (period === "month") {
      const d = new Date(e.date);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === fiscalYear;
    }
    if (period === "quarter") {
      const d = new Date(e.date);
      const q = Math.ceil((d.getMonth() + 1) / 3);
      return q === selectedQuarter && d.getFullYear() === fiscalYear;
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

  // Expense totals
  const totalExpensesHT = filteredExpenses.reduce((sum, e) => sum + e.amountHT, 0);
  const totalTVADeductible = filteredExpenses.reduce((sum, e) => sum + e.tvaAmount, 0);
  const _totalExpensesTTC = filteredExpenses.reduce((sum, e) => sum + e.amountTTC, 0);

  // TVA declaration summary
  const tvaToPay = Math.max(0, totalTVA - totalTVADeductible);
  const tvaCredit = totalTVADeductible > totalTVA ? totalTVADeductible - totalTVA : 0;

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
    const monthExpenses = expenses.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() + 1 === month && d.getFullYear() === fiscalYear;
    });
    return {
      month,
      totalHT: monthEntries.reduce((s, e) => s + e.amountHT, 0),
      totalTVA: monthEntries.reduce((s, e) => s + e.tvaAmount, 0),
      totalTTC: monthEntries.reduce((s, e) => s + e.amountTTC, 0),
      count: monthEntries.length,
      expensesHT: monthExpenses.reduce((s, e) => s + e.amountHT, 0),
      tvaDeductible: monthExpenses.reduce((s, e) => s + e.tvaAmount, 0),
    };
  });

  const MONTH_NAMES = [
    "Janvier", "F\u00E9vrier", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Ao\u00FBt", "Septembre", "Octobre", "Novembre", "D\u00E9cembre",
  ];

  /** Escape a CSV field value (quote if contains comma, newline, or quote) */
  const csvField = (val: string): string => {
    if (val.includes(",") || val.includes("\n") || val.includes('"')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  /** Generate accountant-ready CSV export */
  const exportCSV = () => {
    const headers = [
      "Date", "N\u00B0 Facture", "Patient", "Service",
      "Montant HT", "Taux TVA (%)", "Montant TVA", "Montant TTC",
      "Mode de paiement", "Statut",
    ];
    const rows = filteredEntries.map((e) => [
      e.date,
      csvField(e.invoiceNumber),
      csvField(e.patientName),
      csvField(e.service),
      e.amountHT.toFixed(2),
      (e.tvaRate * 100).toFixed(0),
      e.tvaAmount.toFixed(2),
      e.amountTTC.toFixed(2),
      csvField(e.paymentMethod),
      e.isPaid ? "Pay\u00E9" : "Impay\u00E9",
    ]);

    // BOM for Excel UTF-8 compatibility
    const BOM = "\uFEFF";
    const csv = BOM + [
      `# Relev\u00E9 comptable \u2014 ${clinicName}`,
      `# ICE: ${clinicICE} | IF: ${clinicIF}`,
      `# Ann\u00E9e fiscale: ${fiscalYear}`,
      `# P\u00E9riode: ${filterFrom} au ${filterTo}`,
      `# G\u00E9n\u00E9r\u00E9 le: ${new Date().toISOString().split("T")[0]}`,
      "",
      headers.join(";"),
      ...rows.map((r) => r.join(";")),
      "",
      `# --- R\u00E9sum\u00E9 ---`,
      `Total HT;${totalHT.toFixed(2)}`,
      `TVA collect\u00E9e;${totalTVA.toFixed(2)}`,
      `Total TTC;${totalTTC.toFixed(2)}`,
      `Encaiss\u00E9;${totalPaid.toFixed(2)}`,
      `Impay\u00E9;${totalUnpaid.toFixed(2)}`,
      "",
      `# --- D\u00E9charges ---`,
      `Total d\u00E9penses HT;${totalExpensesHT.toFixed(2)}`,
      `TVA d\u00E9ductible;${totalTVADeductible.toFixed(2)}`,
      "",
      `# --- D\u00E9claration TVA ---`,
      `CA HT;${totalHT.toFixed(2)}`,
      `TVA collect\u00E9e;${totalTVA.toFixed(2)}`,
      `TVA d\u00E9ductible;${totalTVADeductible.toFixed(2)}`,
      `TVA \u00E0 payer;${tvaToPay.toFixed(2)}`,
      tvaCredit > 0 ? `Cr\u00E9dit TVA;${tvaCredit.toFixed(2)}` : "",
      "",
      `# --- Ventilation mensuelle ---`,
      "Mois;CA HT;TVA collect\u00E9e;D\u00E9penses HT;TVA d\u00E9ductible;R\u00E9sultat HT",
      ...monthlyTotals.map((m) =>
        [
          MONTH_NAMES[m.month - 1],
          m.totalHT.toFixed(2),
          m.totalTVA.toFixed(2),
          m.expensesHT.toFixed(2),
          m.tvaDeductible.toFixed(2),
          (m.totalHT - m.expensesHT).toFixed(2),
        ].join(";"),
      ),
    ].filter(Boolean).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comptabilite_${clinicICE}_${fiscalYear}_${filterFrom}_${filterTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /** Generate fiscal report PDF via print dialog */
  const exportPDF = () => {
    const monthRows = monthlyTotals
      .map(
        (m) => `<tr>
          <td>${MONTH_NAMES[m.month - 1]}</td>
          <td class="num">${escapeHtml(formatMAD(m.totalHT, { showCurrency: false }))}</td>
          <td class="num">${escapeHtml(formatMAD(m.totalTVA, { showCurrency: false }))}</td>
          <td class="num">${escapeHtml(formatMAD(m.expensesHT, { showCurrency: false }))}</td>
          <td class="num">${escapeHtml(formatMAD(m.tvaDeductible, { showCurrency: false }))}</td>
          <td class="num font-bold">${escapeHtml(formatMAD(m.totalHT - m.expensesHT, { showCurrency: false }))}</td>
          <td class="num">${m.count}</td>
        </tr>`,
      )
      .join("\n");

    const methodRows = Array.from(byMethod.entries())
      .sort(([, a], [, b]) => b - a)
      .map(
        ([method, amount]) => `<tr>
          <td>${escapeHtml(method)}</td>
          <td class="num">${escapeHtml(formatMAD(amount))}</td>
          <td class="num">${totalTTC > 0 ? ((amount / totalTTC) * 100).toFixed(1) : "0"}%</td>
        </tr>`,
      )
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport Fiscal ${fiscalYear} \u2014 ${escapeHtml(clinicName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; font-size: 12px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 14px; margin: 20px 0 10px; border-bottom: 2px solid #16a34a; padding-bottom: 4px; color: #16a34a; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; }
    .header-info { color: #6b7280; font-size: 11px; text-align: right; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
    .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; text-align: center; }
    .kpi-value { font-size: 18px; font-weight: 700; color: #1e293b; }
    .kpi-label { font-size: 10px; color: #64748b; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
    th { background: #f1f5f9; padding: 6px 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
    td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .font-bold { font-weight: 700; }
    .tva-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin-bottom: 20px; }
    .tva-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
    .tva-row.total { border-top: 2px solid #16a34a; margin-top: 8px; padding-top: 8px; font-weight: 700; font-size: 14px; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; text-align: center; }
    @media print { body { padding: 15px; } table { break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(clinicName)}</h1>
      <p style="color:#6b7280;font-size:12px;">Rapport Fiscal DGI \u2014 Ann\u00E9e ${fiscalYear}</p>
    </div>
    <div class="header-info">
      <p>ICE: ${escapeHtml(clinicICE)}</p>
      <p>IF: ${escapeHtml(clinicIF)}</p>
      <p>P\u00E9riode: ${escapeHtml(filterFrom)} au ${escapeHtml(filterTo)}</p>
      <p>G\u00E9n\u00E9r\u00E9: ${new Date().toLocaleDateString("fr-MA")}</p>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-value">${escapeHtml(formatMADFormal(totalHT))}</div>
      <div class="kpi-label">Chiffre d'affaires HT</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${escapeHtml(formatMADFormal(totalTVA))}</div>
      <div class="kpi-label">TVA collect\u00E9e</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${escapeHtml(formatMADFormal(totalExpensesHT))}</div>
      <div class="kpi-label">D\u00E9penses HT</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${escapeHtml(formatMADFormal(totalHT - totalExpensesHT))}</div>
      <div class="kpi-label">R\u00E9sultat HT</div>
    </div>
    <div class="kpi">
      <div class="kpi-value" style="color:#16a34a">${escapeHtml(formatMADFormal(totalPaid))}</div>
      <div class="kpi-label">Encaiss\u00E9</div>
    </div>
    <div class="kpi">
      <div class="kpi-value" style="color:#ea580c">${escapeHtml(formatMADFormal(totalUnpaid))}</div>
      <div class="kpi-label">Impay\u00E9</div>
    </div>
  </div>

  <h2>D\u00E9claration TVA</h2>
  <div class="tva-box">
    <div class="tva-row"><span>Chiffre d'affaires HT</span><span>${escapeHtml(formatMADFormal(totalHT))}</span></div>
    <div class="tva-row"><span>TVA collect\u00E9e (20%)</span><span>${escapeHtml(formatMADFormal(totalTVA))}</span></div>
    <div class="tva-row"><span>TVA d\u00E9ductible</span><span>- ${escapeHtml(formatMADFormal(totalTVADeductible))}</span></div>
    <div class="tva-row total"><span>TVA \u00E0 payer</span><span>${escapeHtml(formatMADFormal(tvaToPay))}</span></div>
    ${tvaCredit > 0 ? `<div class="tva-row"><span>Cr\u00E9dit TVA reportable</span><span>${escapeHtml(formatMADFormal(tvaCredit))}</span></div>` : ""}
  </div>

  <h2>Ventilation mensuelle</h2>
  <table>
    <thead>
      <tr>
        <th>Mois</th><th class="num">CA HT</th><th class="num">TVA</th>
        <th class="num">D\u00E9penses</th><th class="num">TVA d\u00E9d.</th>
        <th class="num">R\u00E9sultat</th><th class="num">Actes</th>
      </tr>
    </thead>
    <tbody>${monthRows}</tbody>
    <tfoot>
      <tr style="border-top:2px solid #333;font-weight:700">
        <td>Total</td>
        <td class="num">${escapeHtml(formatMAD(monthlyTotals.reduce((s, m) => s + m.totalHT, 0), { showCurrency: false }))}</td>
        <td class="num">${escapeHtml(formatMAD(monthlyTotals.reduce((s, m) => s + m.totalTVA, 0), { showCurrency: false }))}</td>
        <td class="num">${escapeHtml(formatMAD(monthlyTotals.reduce((s, m) => s + m.expensesHT, 0), { showCurrency: false }))}</td>
        <td class="num">${escapeHtml(formatMAD(monthlyTotals.reduce((s, m) => s + m.tvaDeductible, 0), { showCurrency: false }))}</td>
        <td class="num font-bold">${escapeHtml(formatMADFormal(monthlyTotals.reduce((s, m) => s + m.totalHT - m.expensesHT, 0)))}</td>
        <td class="num">${monthlyTotals.reduce((s, m) => s + m.count, 0)}</td>
      </tr>
    </tfoot>
  </table>

  <h2>Recettes par mode de paiement</h2>
  <table>
    <thead><tr><th>Mode</th><th class="num">Montant</th><th class="num">%</th></tr></thead>
    <tbody>${methodRows || '<tr><td colspan="3" style="text-align:center;color:#9ca3af">Aucune donn\u00E9e</td></tr>'}</tbody>
  </table>

  <div class="footer">
    <p>Ce rapport a \u00E9t\u00E9 g\u00E9n\u00E9r\u00E9 automatiquement par ${escapeHtml(clinicName)}.</p>
    <p>Conservez vos pi\u00E8ces justificatives pendant 10 ans (obligation DGI).</p>
  </div>
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Veuillez autoriser les pop-ups pour g\u00E9n\u00E9rer le rapport PDF.");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleExport = (format: "csv" | "pdf") => {
    if (onExport) {
      onExport(format, { from: filterFrom, to: filterTo });
      return;
    }
    if (format === "csv") exportCSV();
    if (format === "pdf") exportPDF();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Comptabilit&eacute; &mdash; Ann&eacute;e fiscale {fiscalYear}
          </h2>
          <p className="text-xs text-muted-foreground">
            ICE: {clinicICE} | IF: {clinicIF}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
            <FileText className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
            <Download className="h-4 w-4 mr-1" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Period filter with fiscal year selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Fiscal year selector (Moroccan fiscal year = calendar year) */}
            <div className="space-y-1">
              <Label className="text-xs">Ann&eacute;e fiscale</Label>
              <Select
                value={selectedFiscalYear.toString()}
                onValueChange={(v) => {
                  const yr = parseInt(v);
                  setSelectedFiscalYear(yr);
                  setFilterFrom(`${yr}-01-01`);
                  setFilterTo(`${yr}-12-31`);
                }}
              >
                <SelectTrigger className="w-28 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fiscalYearOptions.map((yr) => (
                    <SelectItem key={yr} value={yr.toString()}>
                      {yr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">P&eacute;riode</Label>
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

      {/* TVA Declaration Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="h-4 w-4 text-green-600" />
            D&eacute;claration TVA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Chiffre d&apos;affaires HT</span>
              <span className="font-medium">{formatMADFormal(totalHT)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">TVA collect&eacute;e (20%)</span>
              <span className="font-medium">{formatMADFormal(totalTVA)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">TVA d&eacute;ductible</span>
              <span className="font-medium">- {formatMADFormal(totalTVADeductible)}</span>
            </div>
            <div className="flex justify-between text-sm border-t-2 border-green-600 pt-2 mt-2">
              <span className="font-bold">TVA &agrave; payer</span>
              <span className="font-bold text-green-700">{formatMADFormal(tvaToPay)}</span>
            </div>
            {tvaCredit > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cr&eacute;dit TVA reportable</span>
                <span className="font-medium text-blue-600">{formatMADFormal(tvaCredit)}</span>
              </div>
            )}
          </div>
          {totalExpensesHT > 0 && (
            <div className="mt-3 pt-3 border-t space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total d&eacute;penses HT</span>
                <span className="font-medium">{formatMAD(totalExpensesHT)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">R&eacute;sultat HT (CA - D&eacute;penses)</span>
                <span className="font-bold">{formatMADFormal(totalHT - totalExpensesHT)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
