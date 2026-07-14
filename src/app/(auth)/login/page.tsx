import { getTenant } from "@/lib/tenant";
import { LoginForm } from "./login-form";
import { RootLoginFunnel } from "./root-login-funnel";

/**
 * Login route.
 *
 * On a tenant subdomain (`{clinic}.oltigo.com/login`) this renders the full
 * credentials form. On the root marketing domain (`oltigo.com/login`, no
 * tenant resolved) it renders a slim email funnel that redirects staff to
 * their clinic's login — so they never have to remember their subdomain.
 */
export default async function LoginPage() {
  const tenant = await getTenant();

  if (!tenant) {
    return <RootLoginFunnel />;
  }

  return <LoginForm />;
}
