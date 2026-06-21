import { redirect } from "next/navigation";

// WB-1: the Website Builder now lives at /super-admin/website-builder so the URL
// slug matches the feature name. This stub keeps the old /super-admin/agent-builder
// path working (existing bookmarks/links) by redirecting to the new canonical URL.
// next.config redirects aren't supported by OpenNext on Cloudflare Workers, so we
// redirect from a server component here instead.
export default function AgentBuilderRedirect() {
  redirect("/super-admin/website-builder/");
}
