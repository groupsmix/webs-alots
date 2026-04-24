"use client";

/**
 * Insurance Coverage Calculator Component
 *
 * Supports CNSS (Caisse Nationale de Sécurité Sociale) and
 * CNOPS (Caisse Nationale des Organismes de Prévoyance Sociale)
 * Moroccan insurance systems.
 */

import { useState, useMemo } from "react";
import { Calculator, Shield, FileText } from "lucide-react";

// ---- Types ----

export type InsuranceProvider = "cnss" | "cnops" | "private" | "none";

interface InsuranceCoverageRate {
  category: string;
  cnss: number;
  cnops: number;
  description: string;
}

interface CalculatorResult {
  totalAmount: number;
  coveredAmount: number;
  patientShare: number;
  coverageRate: number;
  provider: InsuranceProvider;
  breakdown: { item: string; amount: number; covered: number }[];
}

// ---- Coverage Rates ----

const COVERAGE_RATES: InsuranceCoverageRate[] = [
  {
    category: "consultation",
    cnss: 0.7,
    cnops: 0.8,
    description: "Medical consultation",
  },
  {
    category: "dental_consultation",
    cnss: 0.7,
    cnops: 0.8,
    description: "Dental consultation",
  },
  {
    category: "dental_care",
    cnss: 0.7,
    cnops: 0.75,
    description: "Dental care (fillings, cleaning)",
  },
  {
    category: "dental_prosthetics",
    cnss: 0.5,
    cnops: 0.6,
    description: "Dental prosthetics (crowns, bridges)",
  },
  {
    category: "dental_orthodontics",
    cnss: 0.5,
    cnops: 0.6,
    description: "Orthodontic treatment",
  },
  {
    category: "dental_surgery",
    cnss: 0.7,
    cnops: 0.8,
    description: "Dental surgery (extractions)",
  },
  {
    category: "radiology",
    cnss: 0.7,
    cnops: 0.8,
    description: "X-rays and imaging",
  },
  {
    category: "laboratory",
    cnss: 0.7,
    cnops: 0.8,
    description: "Laboratory tests",
  },
  {
    category: "medication",
    cnss: 0.7,
    cnops: 0.8,
    description: "Prescribed medication",
  },
  {
    category: "hospitalization",
    cnss: 0.9,
    cnops: 0.9,
    description: "Hospitalization",
  },
];

function getCoverageRate(
  category: string,
  provider: InsuranceProvider,
): number {
  if (provider === "none") return 0;
  if (provider === "private") return 0.8; // Default for private insurance
  const rate = COVERAGE_RATES.find((r) => r.category === category);
  if (!rate) return 0.7; // Default rate
  return provider === "cnss" ? rate.cnss : rate.cnops;
}

// ---- Component ----

interface InsuranceCalculatorProps {
  items?: { name: string; amount: number; category: string }[];
  onCalculate?: (result: CalculatorResult) => void;
  className?: string;
}

export function InsuranceCalculator({
  items: initialItems,
  onCalculate,
  className,
}: InsuranceCalculatorProps) {
  const [provider, setProvider] = useState<InsuranceProvider>("cnss");
  const [items, setItems] = useState(
    (initialItems ?? [
      { name: "Consultation", amount: 200, category: "consultation" },
    ]).map((item) => ({ ...item, _id: crypto.randomUUID() })),
  );

  const result = useMemo<CalculatorResult>(() => {
    const breakdown = items.map((item) => {
      const rate = getCoverageRate(item.category, provider);
      const covered = Math.round(item.amount * rate * 100) / 100;
      return { item: item.name, amount: item.amount, covered };
    });

    const totalAmount = breakdown.reduce((sum, b) => sum + b.amount, 0);
    const coveredAmount = breakdown.reduce((sum, b) => sum + b.covered, 0);

    return {
      totalAmount,
      coveredAmount,
      patientShare: totalAmount - coveredAmount,
      coverageRate:
        totalAmount > 0
          ? Math.round((coveredAmount / totalAmount) * 100) / 100
          : 0,
      provider,
      breakdown,
    };
  }, [items, provider]);

  const addItem = () => {
    setItems([
      ...items,
      { _id: crypto.randomUUID(), name: "", amount: 0, category: "consultation" },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (
    index: number,
    field: "name" | "amount" | "category",
    value: string | number,
  ) => {
    const updated = [...items];
    if (field === "amount") {
      updated[index] = { ...updated[index], amount: Number(value) };
    } else {
      updated[index] = { ...updated[index], [field]: value as string };
    }
    setItems(updated);
  };

  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 ${className ?? ""}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <Calculator className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-semibold">Insurance Coverage Calculator</h3>
      </div>

      <div className="p-6 space-y-6">
        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Insurance Provider
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { id: "cnss" as const, label: "CNSS", desc: "Sécurité Sociale" },
                { id: "cnops" as const, label: "CNOPS", desc: "Prévoyance Sociale" },
                { id: "private" as const, label: "Private", desc: "Assurance privée" },
                { id: "none" as const, label: "None", desc: "Sans assurance" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
                  provider === p.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}
              >
                <Shield
                  className={`h-5 w-5 ${
                    provider === p.id ? "text-blue-500" : "text-gray-400"
                  }`}
                />
                <span className="text-sm font-medium">{p.label}</span>
                <span className="text-xs text-gray-500">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Services</label>
            <button
              onClick={addItem}
              className="text-sm text-blue-500 hover:text-blue-600"
            >
              + Add item
            </button>
          </div>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={item._id} className="flex gap-2 items-center">
                <input
                  value={item.name}
                  onChange={(e) => updateItem(index, "name", e.target.value)}
                  placeholder="Service name"
                  className="flex-1 px-3 py-2 text-sm border rounded-lg bg-transparent"
                />
                <select
                  value={item.category}
                  onChange={(e) =>
                    updateItem(index, "category", e.target.value)
                  }
                  className="px-3 py-2 text-sm border rounded-lg bg-transparent"
                >
                  {COVERAGE_RATES.map((r) => (
                    <option key={r.category} value={r.category}>
                      {r.description}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={item.amount}
                  onChange={(e) =>
                    updateItem(index, "amount", e.target.value)
                  }
                  className="w-28 px-3 py-2 text-sm border rounded-lg bg-transparent text-right"
                  min={0}
                />
                <span className="text-sm text-gray-500">MAD</span>
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(index)}
                    className="text-red-400 hover:text-red-500 text-sm px-2"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Coverage Breakdown
          </h4>
          {result.breakdown.map((b, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {b.item || "Item"}
              </span>
              <span>
                {b.covered.toFixed(2)} / {b.amount.toFixed(2)} MAD (
                {b.amount > 0
                  ? Math.round((b.covered / b.amount) * 100)
                  : 0}
                %)
              </span>
            </div>
          ))}
          <div className="border-t pt-3 mt-3 space-y-1">
            <div className="flex justify-between text-sm font-medium">
              <span>Total</span>
              <span>{result.totalAmount.toFixed(2)} MAD</span>
            </div>
            <div className="flex justify-between text-sm text-green-600">
              <span>Insurance covers</span>
              <span>-{result.coveredAmount.toFixed(2)} MAD</span>
            </div>
            <div className="flex justify-between text-base font-bold mt-2">
              <span>Patient pays</span>
              <span>{result.patientShare.toFixed(2)} MAD</span>
            </div>
          </div>
        </div>

        {onCalculate && (
          <button
            onClick={() => onCalculate(result)}
            className="w-full py-2.5 px-4 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
          >
            Apply to Invoice
          </button>
        )}
      </div>
    </div>
  );
}
