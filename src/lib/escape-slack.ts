/**
 * Escape user-controlled strings before interpolating them into Slack
 * `mrkdwn` blocks.
 *
 * A15 fix — without this, an attacker could submit a clinic / doctor /
 * specialty name containing `<!channel>`, `<!here>`, `<@U…>`, or
 * `<https://evil.example|click me>` and have those tokens rendered as
 * pings or formatted links in our internal Slack alert channel.
 *
 * Slack only requires three replacements (officially documented in
 * https://api.slack.com/reference/surfaces/formatting#escaping):
 *   - `&` → `&amp;`
 *   - `<` → `&lt;`
 *   - `>` → `&gt;`
 * Order matters: `&` MUST be replaced first, otherwise we'd double-encode
 * the entities introduced by the other replacements.
 *
 * Other mrkdwn tokens (`*`, `_`, `~`, `` ` ``) only affect visual
 * formatting and are intentionally left intact so legitimate names that
 * happen to contain them still read naturally.
 */
export function escapeSlackMrkdwn(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
