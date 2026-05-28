/**
 * /.well-known/security.txt — RFC 9116
 *
 * Provides a machine-readable way for security researchers to report
 * vulnerabilities. Required by many security review checklists.
 */
export function GET() {
  const body = [
    "Contact: mailto:security@oltigo.com",
    "Expires: 2027-05-28T00:00:00.000Z",
    "Preferred-Languages: fr, en, ar",
    "Canonical: https://oltigo.com/.well-known/security.txt",
    "Policy: https://github.com/groupsmix/webs-alots/blob/main/SECURITY.md",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
