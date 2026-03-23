/**
 * Data access layer – barrel exports.
 *
 * IMPORTANT: Import from the specific sub-module for your context:
 *   Server components / server actions → import from "@/lib/data/server"
 *   Client components                  → import from "@/lib/data/client"
 *
 * Do NOT import from "@/lib/data" directly. This barrel file intentionally
 * does not re-export either layer to prevent accidentally importing
 * client-side code in server components (or vice versa).
 */
