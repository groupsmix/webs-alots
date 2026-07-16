"use client";

import { AlertTriangle, Package, Plus, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/locale-switcher";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  min_stock: number;
  unit_price: number;
  supplier: string | null;
  expiry_date: string | null;
  notes: string | null;
}

const categoryLabels: Record<string, Record<string, string>> = {
  medications: { fr: "Médicaments", ar: "أدوية" },
  consumables: { fr: "Consommables", ar: "مستهلكات" },
  equipment: { fr: "Équipement", ar: "معدات" },
  lab_supplies: { fr: "Fournitures labo", ar: "مستلزمات مخبرية" },
  office_supplies: { fr: "Fournitures bureau", ar: "لوازم مكتبية" },
  other: { fr: "Autre", ar: "أخرى" },
};

const categories = [
  "medications",
  "consumables",
  "equipment",
  "lab_supplies",
  "office_supplies",
  "other",
];

export function InventoryManager() {
  const [locale] = useLocale();
  const lang = locale === "ar" ? "ar" : "fr";
  const isRtl = lang === "ar";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);

  const [newItem, setNewItem] = useState({
    name: "",
    category: "consumables",
    quantity: 0,
    unit: "",
    minStock: 5,
    unitPrice: 0,
    supplier: "",
    expiryDate: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);
      if (showLowStock) params.set("low_stock", "true");
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/clinic/inventory?${params.toString()}`);
      const json = (await res.json()) as {
        ok: boolean;
        data?: { items: InventoryItem[]; lowStockCount: number };
        error?: string;
      };
      if (!json.ok || !json.data) {
        setError(json.error ?? (lang === "ar" ? "خطأ في التحميل" : "Erreur de chargement"));
        return;
      }
      setItems(json.data.items);
      setLowStockCount(json.data.lowStockCount);
    } catch {
      setError(lang === "ar" ? "خطأ في الاتصال" : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [filterCategory, showLowStock, searchQuery, lang]);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    timeouts.push(
      setTimeout(() => {
        void fetchItems();
      }, 0),
    );

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [fetchItems]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/clinic/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setError(json.error ?? (lang === "ar" ? "خطأ في الإضافة" : "Erreur lors de l'ajout"));
        return;
      }
      setShowAddForm(false);
      setNewItem({
        name: "",
        category: "consumables",
        quantity: 0,
        unit: "",
        minStock: 5,
        unitPrice: 0,
        supplier: "",
        expiryDate: "",
        notes: "",
      });
      void fetchItems();
    } catch {
      setError(lang === "ar" ? "خطأ في الاتصال" : "Erreur de connexion");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`space-y-6 ${isRtl ? "text-end" : ""}`} dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          <Package className="me-2 inline-block h-6 w-6" />
          {lang === "ar" ? "إدارة المخزون" : "Gestion du stock"}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => void fetchItems()}
            className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50"
            title={lang === "ar" ? "تحديث" : "Actualiser"}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {lang === "ar" ? "إضافة" : "Ajouter"}
          </button>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <span className="text-sm font-medium text-orange-700">
            {lang === "ar"
              ? `${lowStockCount} منتج(ات) بمخزون منخفض`
              : `${lowStockCount} article(s) en stock bas`}
          </span>
          <button
            onClick={() => setShowLowStock(!showLowStock)}
            className="ms-auto text-sm font-medium text-orange-700 underline"
          >
            {showLowStock
              ? lang === "ar"
                ? "عرض الكل"
                : "Voir tout"
              : lang === "ar"
                ? "عرض المنخفض فقط"
                : "Voir stock bas"}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={lang === "ar" ? "بحث..." : "Rechercher..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border py-2 ps-10 pe-3 text-sm"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">{lang === "ar" ? "كل الفئات" : "Toutes catégories"}</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {categoryLabels[cat]?.[lang] ?? cat}
            </option>
          ))}
        </select>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form
          onSubmit={(e) => void handleAdd(e)}
          className="space-y-4 rounded-lg border bg-gray-50 p-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {lang === "ar" ? "إضافة منتج جديد" : "Ajouter un article"}
            </h2>
            <button type="button" onClick={() => setShowAddForm(false)}>
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              placeholder={lang === "ar" ? "اسم المنتج" : "Nom de l'article"}
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="rounded border px-3 py-2 text-sm"
            />
            <select
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
              className="rounded border px-3 py-2 text-sm"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {categoryLabels[cat]?.[lang] ?? cat}
                </option>
              ))}
            </select>
            <input
              required
              type="number"
              min={0}
              placeholder={lang === "ar" ? "الكمية" : "Quantité"}
              value={newItem.quantity || ""}
              onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
              className="rounded border px-3 py-2 text-sm"
            />
            <input
              required
              placeholder={lang === "ar" ? "الوحدة (علبة، قطعة...)" : "Unité (boîte, pièce...)"}
              value={newItem.unit}
              onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
              className="rounded border px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              min={0}
              placeholder={lang === "ar" ? "الحد الأدنى للمخزون" : "Stock minimum"}
              value={newItem.minStock || ""}
              onChange={(e) => setNewItem({ ...newItem, minStock: Number(e.target.value) })}
              className="rounded border px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              min={0}
              step={0.01}
              placeholder={lang === "ar" ? "السعر (درهم)" : "Prix unitaire (MAD)"}
              value={newItem.unitPrice || ""}
              onChange={(e) => setNewItem({ ...newItem, unitPrice: Number(e.target.value) })}
              className="rounded border px-3 py-2 text-sm"
            />
            <input
              placeholder={lang === "ar" ? "المورد" : "Fournisseur"}
              value={newItem.supplier}
              onChange={(e) => setNewItem({ ...newItem, supplier: e.target.value })}
              className="rounded border px-3 py-2 text-sm"
            />
            <input
              type="date"
              placeholder={lang === "ar" ? "تاريخ الانتهاء" : "Date d'expiration"}
              value={newItem.expiryDate}
              onChange={(e) => setNewItem({ ...newItem, expiryDate: e.target.value })}
              className="rounded border px-3 py-2 text-sm"
            />
          </div>
          <textarea
            placeholder={lang === "ar" ? "ملاحظات" : "Notes"}
            value={newItem.notes}
            onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
            rows={2}
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting
              ? lang === "ar"
                ? "جاري الإضافة..."
                : "Ajout en cours..."
              : lang === "ar"
                ? "إضافة"
                : "Ajouter"}
          </button>
        </form>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ms-2 text-gray-500">
            {lang === "ar" ? "جاري التحميل..." : "Chargement..."}
          </span>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-gray-50 p-8 text-center">
          <Package className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-2 text-gray-500">
            {lang === "ar" ? "لا توجد منتجات في المخزون" : "Aucun article en stock"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-600">
                  {lang === "ar" ? "المنتج" : "Article"}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600">
                  {lang === "ar" ? "الفئة" : "Catégorie"}
                </th>
                <th className="px-4 py-3 text-end font-medium text-gray-600">
                  {lang === "ar" ? "الكمية" : "Quantité"}
                </th>
                <th className="px-4 py-3 text-end font-medium text-gray-600">
                  {lang === "ar" ? "الحد الأدنى" : "Min"}
                </th>
                <th className="px-4 py-3 text-end font-medium text-gray-600">
                  {lang === "ar" ? "السعر" : "Prix (MAD)"}
                </th>
                <th className="px-4 py-3 text-start font-medium text-gray-600">
                  {lang === "ar" ? "الحالة" : "Statut"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => {
                const isLow = item.quantity <= item.min_stock;
                return (
                  <tr key={item.id} className={isLow ? "bg-orange-50" : ""}>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {categoryLabels[item.category]?.[lang] ?? item.category}
                    </td>
                    <td className="px-4 py-3 text-end text-gray-900">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-end text-gray-500">{item.min_stock}</td>
                    <td className="px-4 py-3 text-end text-gray-900">
                      {item.unit_price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                          <AlertTriangle className="h-3 w-3" />
                          {lang === "ar" ? "منخفض" : "Bas"}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          {lang === "ar" ? "متوفر" : "OK"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
