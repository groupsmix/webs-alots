# Cloudflare WAF Rules for Auth Protection

To protect Oltigo Health from credential stuffing and automated bot attacks, configure the following rules in the Cloudflare Dashboard under **Security > WAF**.

## 1. Rate Limiting Rules

Create a new Rate Limiting rule to prevent brute force attacks on authentication endpoints.

- **Rule Name**: `Auth Brute Force Protection`
- **If incoming requests match**:
  - `(http.request.uri.path contains "/api/auth/callback")` OR
  - `(http.request.uri.path contains "/api/auth/demo-login")` OR
  - `(http.request.uri.path contains "/login")` OR
  - `(http.request.uri.path contains "/password-reset")`
- **Rate Limit Config**:
  - Allow **5 requests**
  - per **1 minute**
  - from the same **IP address**
- **Action**: `Block`
  - _Response_: `429 Too Many Requests`

## 2. Bot Fight Mode / Super Bot Fight Mode

Navigate to **Security > Bots** and configure:

- **Definitely automated**: `Block`
- **Likely automated**: `Managed Challenge`
- **Verified bots**: `Allow`

## 3. Custom WAF Rules (Optional Hardening)

If you have a Pro/Business plan, you can restrict access to `/super-admin/*` routes to specific IP ranges (e.g., VPNs or office networks).

- **Rule Name**: `Super-Admin IP Restriction`
- **If incoming requests match**:
  - `(http.request.uri.path starts_with "/super-admin/")` AND
  - `(not ip.src in { "YOUR_OFFICE_IP_HERE" })`
- **Action**: `Block`
