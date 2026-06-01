/**
 * GET /api/drugs/search
 *
 * Auto-complete drug name search using OpenFDA (or Vidal if configured).
 *
 * Query params:
 *   q     — search string (min 2 chars)
 *   limit — max results (1-20, default 10)
 */

import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { searchDrugs } from "@/lib/drugs/client";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(
  async (request: NextRequest) => {
    const { searchParams } = request.nextUrl;
    const q = (searchParams.get("q") ?? "").trim();
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));

    if (q.length < 2) {
      return apiError("Le terme de recherche doit comporter au moins 2 caractères", 400, "QUERY_TOO_SHORT");
    }

    const results = await searchDrugs(q, limit);
    return apiSuccess({ drugs: results, total: results.length });
  },
  ["super_admin", "clinic_admin", "doctor", "receptionist"],
);
