/**
 * ImpersonationBanner — renders a persistent red banner when a
 * super_admin is actively impersonating another user.
 *
 * Reads the `impersonator_id` cookie set by
 * `POST /api/super-admin/users/:id/impersonate`.
 * The button ends the shared impersonation session via `DELETE /api/impersonate`,
 * which clears both the clinic impersonation cookies and this marker cookie.
 * Renders nothing when the cookie is absent.
 */
import { cookies } from "next/headers";
import { EndImpersonationButton } from "@/components/admin/end-impersonation-button";

export async function ImpersonationBanner() {
  const cookieStore = await cookies();
  const impersonatorId = cookieStore.get("impersonator_id")?.value;

  if (!impersonatorId) return null;

  return (
    <div className="relative z-50 flex items-center justify-center gap-4 bg-red-600 px-4 py-2 text-center text-sm font-medium text-white">
      <span>⚠️ Mode impersonation actif — Session se termine dans 15 min.</span>
      <EndImpersonationButton />
    </div>
  );
}
