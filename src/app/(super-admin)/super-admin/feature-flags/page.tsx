import { listSuperAdminFeatureFlags } from "@/lib/super-admin-feature-flags";
import FeatureFlagsClient from "./_feature-flags-client";

export default async function FeatureFlagsPage() {
  const { flags, kvAvailable } = await listSuperAdminFeatureFlags();

  return <FeatureFlagsClient initialFlags={flags} kvAvailable={kvAvailable} />;
}
