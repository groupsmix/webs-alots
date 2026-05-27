import { z } from "zod";

export const menuCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

export const menuUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export const menuItemCreateSchema = z.object({
  menu_id: z.string().min(1),
  category: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().min(0).finite(),
  photo_url: z.string().url().max(2000).optional(),
  is_available: z.boolean().optional().default(true),
  allergens: z.array(z.string().max(100)).optional().default([]),
  is_halal: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

export const menuItemUpdateSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  price: z.number().min(0).finite().optional(),
  photo_url: z.string().url().max(2000).nullable().optional(),
  is_available: z.boolean().optional(),
  allergens: z.array(z.string().max(100)).optional(),
  is_halal: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export const restaurantTableCreateSchema = z.object({
  name: z.string().min(1).max(200),
  capacity: z.number().int().min(1).max(100),
  zone: z.string().max(200).optional(),
  is_active: z.boolean().optional().default(true),
});

export const restaurantTableUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  capacity: z.number().int().min(1).max(100).optional(),
  zone: z.string().max(200).nullable().optional(),
  is_active: z.boolean().optional(),
});

const orderItemSchema = z.object({
  menu_item_id: z.string().min(1),
  name: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(999),
  unit_price: z.number().min(0).finite(),
  notes: z.string().max(500).optional(),
});

export const restaurantOrderCreateSchema = z.object({
  table_id: z.string().min(1).optional(),
  appointment_id: z.string().min(1).optional(),
  items: z.array(orderItemSchema).min(1),
  notes: z.string().max(2000).optional(),
});

export const restaurantOrderUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum([
    "pending", "confirmed", "preparing", "ready", "served", "paid", "cancelled",
  ]).optional(),
  items: z.array(orderItemSchema).optional(),
  notes: z.string().max(2000).nullable().optional(),
});
