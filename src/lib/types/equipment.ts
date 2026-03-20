/**
 * Medical Equipment Store type definitions.
 * Covers equipment inventory, rentals, and maintenance tracking.
 */

// ---------- Equipment Inventory ----------

export type EquipmentCondition = "new" | "good" | "fair" | "needs_repair" | "decommissioned";

export interface EquipmentItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currency: string;
  condition: EquipmentCondition;
  isAvailable: boolean;
  isRentable: boolean;
  rentalPriceDaily?: number;
  rentalPriceWeekly?: number;
  rentalPriceMonthly?: number;
  imageUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Equipment Rentals ----------

export type RentalStatus = "reserved" | "active" | "returned" | "overdue" | "cancelled";
export type RentalPaymentStatus = "pending" | "partial" | "paid" | "refunded";

export interface EquipmentRental {
  id: string;
  equipmentId: string;
  equipmentName: string;
  clientName: string;
  clientPhone?: string;
  clientIdNumber?: string;
  rentalStart: string;
  rentalEnd?: string;
  actualReturn?: string;
  status: RentalStatus;
  conditionOut: string;
  conditionIn?: string;
  depositAmount?: number;
  rentalAmount?: number;
  currency: string;
  paymentStatus: RentalPaymentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Equipment Maintenance ----------

export type MaintenanceType = "routine" | "repair" | "calibration" | "inspection" | "cleaning";
export type MaintenanceStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export interface EquipmentMaintenance {
  id: string;
  equipmentId: string;
  equipmentName: string;
  type: MaintenanceType;
  description?: string;
  performedBy?: string;
  performedAt: string;
  nextDue?: string;
  cost?: number;
  currency: string;
  status: MaintenanceStatus;
  notes?: string;
  createdAt: string;
}

// ---------- Parapharmacy ----------

export interface ParapharmacyCategory {
  id: string;
  name: string;
  nameAr?: string;
  slug: string;
  icon?: string;
  parentId?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ParapharmacyProduct {
  id: string;
  name: string;
  brand?: string;
  category: string;
  subcategory?: string;
  description?: string;
  price: number;
  currency: string;
  ingredients?: string;
  usageInstructions?: string;
  skinType?: string;
  ageGroup?: string;
  imageUrl?: string;
  stockQuantity: number;
  minimumStock: number;
  expiryDate?: string;
  isActive: boolean;
}
