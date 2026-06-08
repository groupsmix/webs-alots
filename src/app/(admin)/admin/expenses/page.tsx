"use client";

import { Plus, Receipt, TrendingUp, TrendingDown, Pencil, Trash2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/components/locale-switcher";
import { useTenant } from "@/components/tenant-provider";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { logger } from "@/lib/logger";
import { formatCurrency } from "@/lib/utils";

interface ExpenseCategory {
  id: string;
  name: string;
  type: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  is_recurring: boolean;
  recurring_interval: string | null;
  notes: string | null;
  category_id: string | null;
  expense_categories: ExpenseCategory | null;
  created_at: string;
}

const CATEGORY_TYPES = [
  "rent",
  "supplies",
  "salaries",
  "equipment",
  "marketing",
  "utilities",
  "insurance",
  "maintenance",
  "operational",
  "other",
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  rent: "Loyer",
  supplies: "Fournitures",
  salaries: "Salaires",
  equipment: "Équipement",
  marketing: "Marketing",
  utilities: "Services publics",
  insurance: "Assurance",
  maintenance: "Maintenance",
  operational: "Opérationnel",
  other: "Autre",
};

export default function ExpensesPage() {
  const [locale] = useLocale();
  const tenant = useTenant();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showCategoryAdd, setShowCategoryAdd] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Form state
  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formRecurring, setFormRecurring] = useState(false);
  const [formInterval, setFormInterval] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Category form
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState("operational");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, catRes] = await Promise.all([
        fetch(`/api/clinic-owner/expenses?month=${month}`),
        fetch("/api/clinic-owner/expense-categories"),
      ]);
      const expJson = await expRes.json();
      const catJson = await catRes.json();
      if (expJson.ok) setExpenses(expJson.data.expenses);
      if (catJson.ok) setCategories(catJson.data.categories);
    } catch (err) {
      logger.warn("Failed to load expenses", { context: "page", error: err });
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    if (tenant?.clinicId) loadData();
  }, [tenant?.clinicId, loadData]);

  const resetForm = () => {
    setFormDesc("");
    setFormAmount("");
    setFormDate("");
    setFormCategoryId("");
    setFormRecurring(false);
    setFormInterval("");
    setFormNotes("");
    setEditExpense(null);
  };

  const handleSave = async () => {
    const amountCentimes = Math.round(parseFloat(formAmount) * 100);
    if (isNaN(amountCentimes) || amountCentimes < 0) return;

    const payload = {
      ...(editExpense ? { id: editExpense.id } : {}),
      description: formDesc,
      amount: amountCentimes,
      expense_date: formDate,
      category_id: formCategoryId || undefined,
      is_recurring: formRecurring,
      recurring_interval: formRecurring ? formInterval || undefined : undefined,
      notes: formNotes || undefined,
    };

    const res = await fetch("/api/clinic-owner/expenses", {
      method: editExpense ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.ok) {
      resetForm();
      setShowAdd(false);
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/clinic-owner/expenses?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.ok) loadData();
  };

  const handleAddCategory = async () => {
    const res = await fetch("/api/clinic-owner/expense-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: catName, type: catType }),
    });
    const json = await res.json();
    if (json.ok) {
      setCatName("");
      setCatType("operational");
      setShowCategoryAdd(false);
      loadData();
    }
  };

  const openEdit = (exp: Expense) => {
    setEditExpense(exp);
    setFormDesc(exp.description);
    setFormAmount(String(exp.amount / 100));
    setFormDate(exp.expense_date);
    setFormCategoryId(exp.category_id ?? "");
    setFormRecurring(exp.is_recurring);
    setFormInterval(exp.recurring_interval ?? "");
    setFormNotes(exp.notes ?? "");
    setShowAdd(true);
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const byCategory: Record<string, number> = {};
  for (const exp of expenses) {
    const catName = exp.expense_categories?.type ?? "other";
    byCategory[catName] = (byCategory[catName] ?? 0) + exp.amount;
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Dépenses" }]} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <h1 className="text-2xl font-bold">Suivi des dépenses</h1>
        <div className="flex gap-2">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-[180px]"
          />
          <Button variant="outline" size="sm" onClick={() => setShowCategoryAdd(true)}>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Plus className="h-4 w-4 mr-1" /> Catégorie
          </Button>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setShowAdd(true);
            }}
          >
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Plus className="h-4 w-4 mr-1" /> Dépense
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Chargement...
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <CardTitle className="text-sm font-medium">Total dépenses</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalExpenses / 100, locale ?? "fr")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <CardTitle className="text-sm font-medium">Plus grande catégorie</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {Object.keys(byCategory).length > 0 ? (
                  <>
                    <div className="text-2xl font-bold">
                      {CATEGORY_LABELS[
                        Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ""
                      ] ?? "—"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(
                        (Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[1] ?? 0) / 100,
                        locale ?? "fr",
                      )}
                    </p>
                  </>
                ) : (
                  <div className="text-muted-foreground">—</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <CardTitle className="text-sm font-medium">Nombre de dépenses</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{expenses.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Category Breakdown */}
          {Object.keys(byCategory).length > 0 && (
            <Card>
              <CardHeader>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <CardTitle>Répartition par catégorie</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(byCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, amount]) => (
                      <div
                        key={cat}
                        className="flex justify-between items-center p-2 rounded-lg border"
                      >
                        <span className="text-sm">{CATEGORY_LABELS[cat] ?? cat}</span>
                        <span className="font-medium text-sm">
                          {formatCurrency(amount / 100, locale ?? "fr")}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Expenses Table */}
          <Card>
            <CardHeader>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <CardTitle>Liste des dépenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <th className="py-3 pr-4 font-medium">Date</th>
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <th className="py-3 pr-4 font-medium">Description</th>
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <th className="py-3 pr-4 font-medium">Catégorie</th>
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <th className="py-3 pr-4 font-medium text-right">Montant</th>
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <th className="py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => (
                      <tr key={exp.id} className="border-b last:border-0">
                        <td className="py-3 pr-4">{exp.expense_date}</td>
                        <td className="py-3 pr-4">
                          {exp.description}
                          {exp.is_recurring && (
                            // eslint-disable-next-line i18next/no-literal-string
                            <Badge variant="secondary" className="ml-2">
                              Récurrent
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {exp.expense_categories
                            ? (CATEGORY_LABELS[exp.expense_categories.type] ??
                              exp.expense_categories.name)
                            : "—"}
                        </td>
                        <td className="py-3 pr-4 text-right font-medium">
                          {formatCurrency(exp.amount / 100, locale ?? "fr")}
                        </td>
                        <td className="py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(exp)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(exp.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {expenses.length === 0 && (
                      <tr>
                        {/* eslint-disable-next-line i18next/no-literal-string */}
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          Aucune dépense pour ce mois
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Add/Edit Expense Dialog */}
      <Dialog
        open={showAdd}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
            setShowAdd(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editExpense ? "Modifier la dépense" : "Ajouter une dépense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="text-sm font-medium">Description</span>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="text-sm font-medium">Montant (MAD)</span>
                <Input
                  type="number"
                  step="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                />
              </div>
              <div>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="text-sm font-medium">Date</span>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>
            </div>
            <div>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="text-sm font-medium">Catégorie</span>
              <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="text-sm font-medium">Notes</span>
              <Input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            {/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */}
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setShowAdd(false);
              }}
            >
              Annuler
            </Button>
            {/* eslint-enable i18next/no-literal-string */}
            <Button onClick={handleSave}>{editExpense ? "Mettre à jour" : "Ajouter"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={showCategoryAdd} onOpenChange={setShowCategoryAdd}>
        <DialogContent>
          <DialogHeader>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <DialogTitle>Ajouter une catégorie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="text-sm font-medium">Nom</span>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} />
            </div>
            <div>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="text-sm font-medium">Type</span>
              <Select value={catType} onValueChange={setCatType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CATEGORY_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Button variant="outline" onClick={() => setShowCategoryAdd(false)}>
              Annuler
            </Button>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Button onClick={handleAddCategory}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
