"use client";

import {
  Video,
  FlaskConical,
  Pill,
  MessageSquare,
  UserCircle,
  Shield,
  BarChart3,
  Languages,
  FileText,
  Package,
  ThumbsUp,
  Phone,
  Search,
  Star,
  Download,
  DollarSign,
  TrendingUp,
  Crown,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

type Category =
  | "Clinical"
  | "Marketing"
  | "Patient Experience"
  | "Finance"
  | "Analytics"
  | "Localization"
  | "Operations"
  | "Communication";

type SortOption = "popular" | "price-asc" | "price-desc" | "newest";
type PriceFilter = "all" | "free" | "under-200" | "under-500";

interface AddOn {
  id: string;
  name: string;
  description: string;
  price: number;
  category: Category;
  icon: LucideIcon;
  installs: number;
  rating: number;
}

const ADD_ONS: AddOn[] = [
  {
    id: "telehealth-video",
    name: "Telehealth Video",
    description: "Video consultations for remote patients.",
    price: 500,
    category: "Clinical",
    icon: Video,
    installs: 18,
    rating: 4.8,
  },
  {
    id: "lab-integration",
    name: "Lab Integration",
    description: "Connect to lab systems for results.",
    price: 300,
    category: "Clinical",
    icon: FlaskConical,
    installs: 14,
    rating: 4.5,
  },
  {
    id: "pharmacy-ordering",
    name: "Pharmacy Ordering",
    description: "Prescription to pharmacy workflow.",
    price: 400,
    category: "Clinical",
    icon: Pill,
    installs: 11,
    rating: 4.3,
  },
  {
    id: "sms-campaigns",
    name: "SMS Campaigns",
    description: "Bulk SMS marketing to patients.",
    price: 200,
    category: "Marketing",
    icon: MessageSquare,
    installs: 9,
    rating: 4.2,
  },
  {
    id: "patient-portal",
    name: "Patient Portal",
    description: "Self-service portal for patients.",
    price: 350,
    category: "Patient Experience",
    icon: UserCircle,
    installs: 16,
    rating: 4.6,
  },
  {
    id: "insurance-processor",
    name: "Insurance Processor",
    description: "CNSS/CNOPS claim automation.",
    price: 600,
    category: "Finance",
    icon: Shield,
    installs: 7,
    rating: 4.4,
  },
  {
    id: "analytics-pro",
    name: "Analytics Pro",
    description: "Advanced clinic analytics and reports.",
    price: 250,
    category: "Analytics",
    icon: BarChart3,
    installs: 12,
    rating: 4.5,
  },
  {
    id: "multi-language",
    name: "Multi-Language",
    description: "Arabic/English/Darija support.",
    price: 150,
    category: "Localization",
    icon: Languages,
    installs: 20,
    rating: 4.7,
  },
  {
    id: "e-prescriptions",
    name: "E-Prescriptions",
    description: "Digital prescription generation.",
    price: 300,
    category: "Clinical",
    icon: FileText,
    installs: 13,
    rating: 4.4,
  },
  {
    id: "inventory-manager",
    name: "Inventory Manager",
    description: "Track medical supplies and stock.",
    price: 200,
    category: "Operations",
    icon: Package,
    installs: 8,
    rating: 4.1,
  },
  {
    id: "patient-feedback",
    name: "Patient Feedback",
    description: "Automated satisfaction surveys.",
    price: 100,
    category: "Patient Experience",
    icon: ThumbsUp,
    installs: 10,
    rating: 4.3,
  },
  {
    id: "whatsapp-business",
    name: "WhatsApp Business",
    description: "Advanced WhatsApp automation.",
    price: 350,
    category: "Communication",
    icon: Phone,
    installs: 15,
    rating: 4.6,
  },
];

const CATEGORIES = [
  "All",
  "Clinical",
  "Finance",
  "Marketing",
  "Patient Experience",
  "Operations",
] as const;

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "popular", label: "Popular" },
  { value: "price-asc", label: "Price (low-high)" },
  { value: "price-desc", label: "Price (high-low)" },
  { value: "newest", label: "Newest" },
];

const PRICE_FILTERS: { value: PriceFilter; label: string }[] = [
  { value: "all", label: "All Prices" },
  { value: "free", label: "Free" },
  { value: "under-200", label: "Under 200 MAD" },
  { value: "under-500", label: "Under 500 MAD" },
];

const CATEGORY_COLORS: Record<string, string> = {
  Clinical: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Finance: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Marketing: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
  "Patient Experience": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  Analytics: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  Localization: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  Operations: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  Communication: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${
            star <= Math.floor(rating)
              ? "fill-yellow-400 text-yellow-400"
              : star - 0.5 <= rating
                ? "fill-yellow-400/50 text-yellow-400"
                : "text-muted-foreground/30"
          }`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function MarketplacePage() {
  const { addToast } = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [sort, setSort] = useState<SortOption>("popular");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let items = ADD_ONS.filter((addon) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q || addon.name.toLowerCase().includes(q) || addon.description.toLowerCase().includes(q);
      const matchCategory = category === "All" || addon.category === category;
      const matchPrice =
        priceFilter === "all" ||
        (priceFilter === "free" && addon.price === 0) ||
        (priceFilter === "under-200" && addon.price < 200) ||
        (priceFilter === "under-500" && addon.price < 500);
      return matchSearch && matchCategory && matchPrice;
    });

    switch (sort) {
      case "popular":
        items = [...items].sort((a, b) => b.installs - a.installs);
        break;
      case "price-asc":
        items = [...items].sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        items = [...items].sort((a, b) => b.price - a.price);
        break;
      case "newest":
        items = [...items].reverse();
        break;
    }

    return items;
  }, [search, category, sort, priceFilter]);

  function toggleInstall(addonId: string) {
    setInstalled((prev) => {
      const next = new Set(prev);
      if (next.has(addonId)) {
        next.delete(addonId);
      } else {
        next.add(addonId);
      }
      return next;
    });
    const addon = ADD_ONS.find((a) => a.id === addonId);
    if (addon) {
      const wasInstalled = installed.has(addonId);
      addToast(
        wasInstalled
          ? `${addon.name} has been uninstalled`
          : `${addon.name} installed successfully`,
        wasInstalled ? "info" : "success",
      );
    }
  }

  function handleConfigure(addonName: string) {
    addToast(`Configuration for ${addonName} coming soon`, "info");
  }

  const kpis = [
    {
      label: "Total Add-ons",
      value: "12",
      icon: Package,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/50",
    },
    {
      label: "Active Installations",
      value: "45",
      icon: Download,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950/50",
    },
    {
      label: "Revenue from Add-ons",
      value: "5,400 MAD/mo",
      icon: DollarSign,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/50",
    },
    {
      label: "Most Popular",
      value: "Telehealth",
      icon: Crown,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/50",
    },
  ];

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Marketplace" }]}
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Discover and install add-on modules for your clinics
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                </div>
                <div className={`rounded-lg p-3 ${kpi.bg}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search add-ons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={category === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center">
        <div className="w-44">
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger>
              <SelectValue
                placeholder="Sort by"
                value={SORT_OPTIONS.find((o) => o.value === sort)?.label}
              />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-48">
          <Select value={priceFilter} onValueChange={(v) => setPriceFilter(v as PriceFilter)}>
            <SelectTrigger>
              <SelectValue
                placeholder="Price range"
                value={PRICE_FILTERS.find((o) => o.value === priceFilter)?.label}
              />
            </SelectTrigger>
            <SelectContent>
              {PRICE_FILTERS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm text-muted-foreground ml-auto">
          {filtered.length} add-on{filtered.length !== 1 ? "s" : ""} found
        </p>
      </div>

      {/* Add-on Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((addon) => {
          const isInstalled = installed.has(addon.id);
          return (
            <Card
              key={addon.id}
              className="group relative overflow-hidden transition-shadow hover:shadow-md"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-muted p-2.5">
                    <addon.icon className="h-5 w-5 text-foreground" />
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      CATEGORY_COLORS[addon.category] ?? ""
                    }`}
                  >
                    {addon.category}
                  </span>
                </div>
                <CardTitle className="text-base mt-3">{addon.name}</CardTitle>
                <p className="text-sm text-muted-foreground leading-relaxed">{addon.description}</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-bold">{addon.price} MAD</span>
                  <span className="text-xs text-muted-foreground">/month</span>
                </div>

                <StarRating rating={addon.rating} />

                <p className="text-xs text-muted-foreground mt-2">
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                  {addon.installs} clinics using
                </p>

                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant={isInstalled ? "outline" : "default"}
                    className="flex-1"
                    onClick={() => toggleInstall(addon.id)}
                  >
                    {isInstalled ? "Installed" : "Install"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleConfigure(addon.name)}>
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No add-ons found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}
    </div>
  );
}
