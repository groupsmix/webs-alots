"use server";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase-server";

export async function updateLabOrderPdfUrl(orderId: string, pdfUrl: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lab_test_orders")
    .update({ pdf_url: pdfUrl, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) {
    logger.warn("Mutation failed", { context: "data/lab", error });
    return false;
  }
  return true;
}
