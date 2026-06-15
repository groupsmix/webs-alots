/**
 * /.well-known/security.txt — RFC 9116
 *
 * Provides a machine-readable way for security researchers to report
 * vulnerabilities. Required by many security review checklists.
 */
export function GET() {
  const body = [
    "# Oltigo Health Security Contact",
    "# https://securitytxt.org/ (RFC 9116)",
    "",
    "Contact: mailto:security@oltigo.com",
    "Expires: 2027-04-30T23:59:59.000Z",
    "Encryption: https://oltigo.com/.well-known/pgp-key.txt",
    "Preferred-Languages: en, fr, ar",
    "Canonical: https://oltigo.com/.well-known/security.txt",
    "Policy: https://github.com/groupsmix/webs-alots/blob/main/SECURITY.md",
    "",
    "# Scope: see SECURITY.md for in-scope and out-of-scope targets.",
    "# Safe harbor: Oltigo Health will not pursue legal action against",
    "# researchers who report vulnerabilities in good faith following",
    "# our responsible disclosure policy.",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
