"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Tenant info available to client components. */
export interface ClientTenantInfo {
  clinicId: string;
  clinicName: string;
  subdomain: string;
  clinicType: string;
  clinicTier: string;
}

const TenantContext = createContext<ClientTenantInfo | null>(null);

/**
 * Hook to access the current tenant in client components.
 * Returns null when on the root domain (no subdomain).
 */
export function useTenant(): ClientTenantInfo | null {
  return useContext(TenantContext);
}

/**
 * Provider that passes tenant info from server to client components.
 * Wrap this around your layout children.
 */
export function TenantProvider({
  tenant,
  children,
}: {
  tenant: ClientTenantInfo | null;
  children: ReactNode;
}) {
  return (
    <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>
  );
}
