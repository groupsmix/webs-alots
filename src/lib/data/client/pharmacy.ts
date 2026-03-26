"use client";

import { fetchRows, ensureLookups, _activeUserMap } from "./_core";
import { createClient } from "@/lib/supabase-client";

// ─────────────────────────────────────────────
// Pharmacy: Products / Stock
// ─────────────────────────────────────────────

export interface ProductView {
  id: string;
  name: string;
  genericName?: string;
  category: string;
  description?: string;
  price: number;
  currency: string;
  requiresPrescription: boolean;
  stockQuantity: number;
  minimumStock: number;
  expiryDate: string;
  barcode?: string;
  manufacturer?: string;
  supplierId?: string;
  dosageForm?: string;
  strength?: string;
  active: boolean;
}

export interface ProductRaw {
  id: string;
  clinic_id: string;
  name: string;
  generic_name?: string | null;
  category: string | null;
  description: string | null;
  price: number | null;
  requires_prescription: boolean;
  is_active: boolean;
  dosage_form?: string | null;
  strength?: string | null;
  manufacturer?: string | null;
}

export interface StockRaw {
  id: string;
  product_id: string;
  clinic_id: string;
  quantity: number;
  min_threshold: number;
  expiry_date: string | null;
  batch_number: string | null;
  supplier_id?: string | null;
}

export async function fetchProducts(clinicId: string): Promise<ProductView[]> {
  const [products, stock] = await Promise.all([
    fetchRows<ProductRaw>("products", { eq: [["clinic_id", clinicId]] }),
    fetchRows<StockRaw>("stock", { eq: [["clinic_id", clinicId]] }),
  ]);
  const stockMap = new Map(stock.map((s) => [s.product_id, s]));
  return products.map((p) => {
    const s = stockMap.get(p.id);
    return {
      id: p.id,
      name: p.name,
      genericName: p.generic_name ?? undefined,
      category: p.category ?? "General",
      description: p.description ?? undefined,
      price: p.price ?? 0,
      currency: "MAD",
      requiresPrescription: p.requires_prescription,
      stockQuantity: s?.quantity ?? 0,
      minimumStock: s?.min_threshold ?? 0,
      expiryDate: s?.expiry_date ?? "",
      barcode: s?.batch_number ?? undefined,
      manufacturer: p.manufacturer ?? undefined,
      supplierId: s?.supplier_id ?? undefined,
      dosageForm: p.dosage_form ?? undefined,
      strength: p.strength ?? undefined,
      active: p.is_active ?? true,
    };
  });
}

export function getLowStockProducts(products: ProductView[]): ProductView[] {
  return products.filter((p) => p.stockQuantity <= p.minimumStock && p.active);
}

export function getOutOfStockProducts(products: ProductView[]): ProductView[] {
  return products.filter((p) => p.stockQuantity === 0 && p.active);
}

export function getExpiringProducts(products: ProductView[], days: number = 90): ProductView[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  return products.filter((p) => p.expiryDate && new Date(p.expiryDate) <= cutoff && p.active);
}

export function getStockStatus(product: ProductView): "ok" | "low" | "out" {
  if (product.stockQuantity === 0) return "out";
  if (product.stockQuantity <= product.minimumStock) return "low";
  return "ok";
}

export function getExpiryStatus(expiryDate: string): "red" | "yellow" | "green" {
  if (!expiryDate) return "green";
  const now = new Date();
  const expiry = new Date(expiryDate);
  if (expiry < now) return "red";
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 90) return "yellow";
  return "green";
}

export function searchProductsLocal(products: ProductView[], query: string): ProductView[] {
  const q = query.toLowerCase();
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.genericName?.toLowerCase().includes(q) ?? false) ||
      p.category.toLowerCase().includes(q) ||
      (p.barcode?.includes(q) ?? false) ||
      (p.manufacturer?.toLowerCase().includes(q) ?? false)
  );
}

export function getPointsValue(points: number): number {
  return Math.floor(points / 10);
}

// ─────────────────────────────────────────────
// Pharmacy: Suppliers
// ─────────────────────────────────────────────

export interface SupplierView {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  categories: string[];
  rating: number;
  paymentTerms: string;
  deliveryDays: number;
  active: boolean;
}

interface SupplierRaw {
  id: string;
  clinic_id: string;
  name: string;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  address?: string | null;
  city?: string | null;
  categories?: string[] | null;
  rating?: number | null;
  payment_terms?: string | null;
  delivery_days?: number | null;
  is_active?: boolean;
}

export async function fetchSuppliers(clinicId: string): Promise<SupplierView[]> {
  const rows = await fetchRows<SupplierRaw>("suppliers", {
    eq: [["clinic_id", clinicId]],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    contactPerson: r.contact_person ?? "",
    phone: r.contact_phone ?? "",
    email: r.contact_email ?? "",
    address: r.address ?? "",
    city: r.city ?? "",
    categories: r.categories ?? [],
    rating: r.rating ?? 0,
    paymentTerms: r.payment_terms ?? "N/A",
    deliveryDays: r.delivery_days ?? 0,
    active: r.is_active ?? true,
  }));
}

// ─────────────────────────────────────────────
// Pharmacy: Prescription Requests
// ─────────────────────────────────────────────

export interface PharmacyPrescriptionItemView {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  available: boolean;
  price: number;
  notes?: string;
}

export interface PharmacyPrescriptionView {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  imageUrl: string;
  uploadedAt: string;
  status: string;
  pharmacistNotes?: string;
  items: PharmacyPrescriptionItemView[];
  totalPrice: number;
  currency: string;
  deliveryOption: string;
  deliveryAddress?: string;
  isChronic: boolean;
  refillReminderDate?: string;
  whatsappNotified: boolean;
}

interface PrescriptionRequestRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  image_url: string;
  status: string;
  notes: string | null;
  pharmacist_notes?: string | null;
  items?: PharmacyPrescriptionItemView[] | null;
  total_price?: number | null;
  delivery_requested: boolean;
  delivery_address?: string | null;
  is_chronic?: boolean;
  refill_reminder_date?: string | null;
  whatsapp_notified?: boolean;
  created_at: string;
}

export async function fetchPrescriptionRequests(clinicId: string): Promise<PharmacyPrescriptionView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<PrescriptionRequestRaw>("prescription_requests", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  return rows.map((r) => {
    const patient = _activeUserMap?.get(r.patient_id);
    return {
      id: r.id,
      patientId: r.patient_id,
      patientName: patient?.name ?? "Patient",
      patientPhone: patient?.phone ?? "",
      imageUrl: r.image_url,
      uploadedAt: r.created_at ?? "",
      status: r.status,
      pharmacistNotes: r.pharmacist_notes ?? r.notes ?? undefined,
      items: r.items ?? [],
      totalPrice: r.total_price ?? 0,
      currency: "MAD",
      deliveryOption: r.delivery_requested ? "delivery" : "pickup",
      deliveryAddress: r.delivery_address ?? undefined,
      isChronic: r.is_chronic ?? false,
      refillReminderDate: r.refill_reminder_date ?? undefined,
      whatsappNotified: r.whatsapp_notified ?? false,
    };
  });
}

// ─────────────────────────────────────────────
// Pharmacy: Loyalty
// ─────────────────────────────────────────────

export interface LoyaltyMemberView {
  id: string;
  patientId: string;
  patientName: string;
  phone: string;
  email: string;
  totalPoints: number;
  availablePoints: number;
  redeemedPoints: number;
  joinedAt: string;
  dateOfBirth: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  referralCode: string;
  referredBy?: string;
  totalPurchases: number;
  birthdayRewardClaimed: boolean;
  birthdayRewardYear?: number;
}

interface LoyaltyPointsRaw {
  id: string;
  patient_id: string;
  clinic_id: string;
  points: number;
  available_points?: number | null;
  redeemed_points?: number | null;
  total_purchases?: number | null;
  referral_code?: string | null;
  referred_by?: string | null;
  date_of_birth?: string | null;
  birthday_reward_claimed?: boolean;
  birthday_reward_year?: number | null;
  updated_at: string;
  created_at?: string | null;
}

function computeLoyaltyTier(points: number): "bronze" | "silver" | "gold" | "platinum" {
  if (points >= 5000) return "platinum";
  if (points >= 3000) return "gold";
  if (points >= 1000) return "silver";
  return "bronze";
}

export async function fetchLoyaltyMembers(clinicId: string): Promise<LoyaltyMemberView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<LoyaltyPointsRaw>("loyalty_points", {
    eq: [["clinic_id", clinicId]],
  });
  return rows.map((r) => {
    const patient = _activeUserMap?.get(r.patient_id);
    const totalPts = r.points ?? 0;
    const redeemed = r.redeemed_points ?? 0;
    const available = r.available_points ?? (totalPts - redeemed);
    return {
      id: r.id,
      patientId: r.patient_id,
      patientName: patient?.name ?? "Member",
      phone: patient?.phone ?? "",
      email: patient?.email ?? "",
      totalPoints: totalPts,
      availablePoints: available,
      redeemedPoints: redeemed,
      joinedAt: r.created_at ?? r.updated_at ?? "",
      dateOfBirth: r.date_of_birth ?? "",
      tier: computeLoyaltyTier(totalPts),
      referralCode: r.referral_code ?? "",
      referredBy: r.referred_by ?? undefined,
      totalPurchases: r.total_purchases ?? totalPts,
      birthdayRewardClaimed: r.birthday_reward_claimed ?? false,
      birthdayRewardYear: r.birthday_reward_year ?? undefined,
    };
  });
}

// ─────────────────────────────────────────────
// Pharmacy: Purchase Orders
// ─────────────────────────────────────────────

export interface PurchaseOrderItemView {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface PurchaseOrderView {
  id: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItemView[];
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  expectedDelivery: string;
  deliveredAt?: string;
  notes?: string;
}

interface PurchaseOrderRaw {
  id: string;
  clinic_id: string;
  supplier_id: string;
  status: string;
  total_amount: number | null;
  notes: string | null;
  items?: PurchaseOrderItemView[] | null;
  ordered_at: string | null;
  expected_delivery?: string | null;
  received_at: string | null;
  created_at: string;
}

export async function fetchPurchaseOrders(clinicId: string): Promise<PurchaseOrderView[]> {
  const supabase = createClient();
  const { data: orders } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (!orders || orders.length === 0) return [];

  // Get supplier names
  const supplierIds = [...new Set((orders as PurchaseOrderRaw[]).map((o) => o.supplier_id))];
  const { data: suppliersData } = await supabase
    .from("suppliers")
    .select("id, name")
    .in("id", supplierIds);
  const supplierMap = new Map(
    ((suppliersData ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]),
  );

  return (orders as PurchaseOrderRaw[]).map((o) => ({
    id: o.id,
    supplierId: o.supplier_id,
    supplierName: supplierMap.get(o.supplier_id) ?? "Supplier",
    items: o.items ?? [],
    totalAmount: o.total_amount ?? 0,
    currency: "MAD",
    status: o.status,
    createdAt: o.ordered_at ?? o.created_at ?? "",
    expectedDelivery: o.expected_delivery ?? o.ordered_at ?? "",
    deliveredAt: o.received_at ?? undefined,
    notes: o.notes ?? undefined,
  }));
}

