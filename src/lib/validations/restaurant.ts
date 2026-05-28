import { z } from "zod";

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
  status: z
    .enum(["pending", "confirmed", "preparing", "ready", "served", "paid", "cancelled"])
    .optional(),
  items: z.array(orderItemSchema).optional(),
  notes: z.string().max(2000).nullable().optional(),
});
