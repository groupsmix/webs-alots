/**
 * Multi-tenant WhatsApp Business Account (WABA) Routing
 *
 * Adapté du pattern whatsapp-receptionist (multi-tenant WABA routing).
 * Résout la clinique (tenant) à partir du numéro WABA dans les webhooks
 * WhatsApp entrants.
 *
 * Chaque clinique a son propre numéro WhatsApp Business associé via
 * le champ `whatsapp_phone_number_id` dans la table `clinics`.
 *
 * Ce module fournit:
 * 1. Résolution de clinique à partir du phone_number_id Meta
 * 2. Cache en mémoire pour éviter des requêtes DB répétées
 * 3. Validation du numéro WABA
 * 4. Résolution du patient à partir du numéro de téléphone
 */

import { logger } from "@/lib/logger";

// ── Types ──

export interface WABARoutingResult {
  clinicId: string;
  clinicName: string;
  clinicPhone: string | null;
  clinicAddress: string | null;
  whatsappPhoneNumberId: string;
}

export interface WABARoutingClient {
  from(table: string): {
    select(cols: string): {
      eq(
        col: string,
        val: unknown,
      ): {
        single(): Promise<{ data: Record<string, unknown> | null; error: unknown }>;
        maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: unknown }>;
        eq(
          col2: string,
          val2: unknown,
        ): {
          single(): Promise<{ data: Record<string, unknown> | null; error: unknown }>;
          maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: unknown }>;
          limit(n: number): {
            single(): Promise<{ data: Record<string, unknown> | null; error: unknown }>;
          };
        };
      };
    };
  };
}

// ── Cache en mémoire ──

interface CachedRoute {
  result: WABARoutingResult;
  cachedAt: number;
}

const routeCache = new Map<string, CachedRoute>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedRoute(wabaPhoneNumberId: string): WABARoutingResult | null {
  const cached = routeCache.get(wabaPhoneNumberId);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
    routeCache.delete(wabaPhoneNumberId);
    return null;
  }
  return cached.result;
}

function setCachedRoute(wabaPhoneNumberId: string, result: WABARoutingResult): void {
  // Limiter la taille du cache
  if (routeCache.size > 500) {
    const oldestKey = routeCache.keys().next().value;
    if (typeof oldestKey === "string") {
      routeCache.delete(oldestKey);
    }
  }
  routeCache.set(wabaPhoneNumberId, { result, cachedAt: Date.now() });
}

/**
 * Invalider le cache pour un WABA phone number ID spécifique.
 * Utile quand les paramètres de la clinique changent.
 */
export function invalidateWABACache(wabaPhoneNumberId?: string): void {
  if (wabaPhoneNumberId) {
    routeCache.delete(wabaPhoneNumberId);
  } else {
    routeCache.clear();
  }
}

// ── Résolution de clinique ──

/**
 * Résoudre la clinique (tenant) à partir du WABA phone_number_id.
 * Utilise un cache en mémoire avec TTL de 5 minutes.
 *
 * @returns La clinique correspondante ou null si non trouvée
 */
export async function resolveClinicFromWABA(
  supabase: WABARoutingClient,
  wabaPhoneNumberId: string,
): Promise<WABARoutingResult | null> {
  if (!wabaPhoneNumberId) {
    logger.warn("WABA phone_number_id vide", {
      context: "whatsapp/waba-routing",
    });
    return null;
  }

  // Vérifier le cache
  const cached = getCachedRoute(wabaPhoneNumberId);
  if (cached) return cached;

  // Requête DB
  const { data: clinic, error } = await supabase
    .from("clinics")
    .select("id, name, owner_phone, address, whatsapp_phone_number_id")
    .eq("whatsapp_phone_number_id", wabaPhoneNumberId)
    .single();

  if (error || !clinic) {
    logger.warn("Clinique non trouvée pour le WABA phone_number_id", {
      context: "whatsapp/waba-routing",
      wabaPhoneNumberId,
    });
    return null;
  }

  const result: WABARoutingResult = {
    clinicId: clinic.id as string,
    clinicName: (clinic.name as string) || "Clinique",
    clinicPhone: (clinic.owner_phone as string) || null,
    clinicAddress: (clinic.address as string) || null,
    whatsappPhoneNumberId: wabaPhoneNumberId,
  };

  setCachedRoute(wabaPhoneNumberId, result);
  return result;
}

// ── Résolution du patient ──

/**
 * Résoudre le patient à partir de son numéro de téléphone WhatsApp
 * dans le contexte d'une clinique spécifique.
 *
 * Vérifie aussi le statut de consentement WhatsApp du patient.
 */

// ── Vérification du consentement WhatsApp ──

// ── Validation du numéro WhatsApp marocain ──

/**
 * Valider qu'un numéro de téléphone est un numéro marocain valide.
 * Formats acceptés: +212XXXXXXXXX, 212XXXXXXXXX, 0XXXXXXXXX
 */
export function isValidMoroccanPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  return /^(\+?212|0)[5-7]\d{8}$/.test(cleaned);
}

/**
 * Normaliser un numéro marocain au format international +212XXXXXXXXX
 */
export function normalizeMoroccanPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-().]/g, "");

  if (cleaned.startsWith("+212")) return cleaned;
  if (cleaned.startsWith("212")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+212${cleaned.slice(1)}`;

  return cleaned;
}
