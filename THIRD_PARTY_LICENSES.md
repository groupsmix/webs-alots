# Third-Party Licenses

> **Audit finding:** F-A197 | **Last updated:** May 2026

This file lists the open-source dependencies used in production by Oltigo Health.
Generated from `package.json` and `node_modules/*/package.json`.

## Allowed License Categories

- MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, CC0-1.0, 0BSD, BlueOak-1.0.0
- LGPL (with dynamic linking only) — requires legal review for static bundling
- GPL — **NOT ALLOWED** in production dependencies (copyleft incompatible with UNLICENSED)

## Production Dependencies

| Package                         | Version  | License    |
| ------------------------------- | -------- | ---------- |
| `@aws-sdk/client-s3`            | 3.1037.0 | Apache-2.0 |
| `@aws-sdk/s3-presigned-post`    | 3.1036.0 | Apache-2.0 |
| `@aws-sdk/s3-request-presigner` | 3.1037.0 | Apache-2.0 |
| `@base-ui/react`                | 1.4.1    | MIT        |
| `@sentry/nextjs`                | 10.50.0  | MIT        |
| `@supabase/ssr`                 | 0.10.2   | MIT        |
| `@supabase/supabase-js`         | 2.105.1  | MIT        |
| `class-variance-authority`      | 0.7.1    | Apache-2.0 |
| `clsx`                          | 2.1.1    | MIT        |
| `date-fns`                      | 4.1.0    | MIT        |
| `date-fns-tz`                   | 3.2.0    | MIT        |
| `isomorphic-dompurify`          | 3.3.0    | MIT        |
| `js-cookie`                     | 3.0.7    | MIT        |
| `lucide-react`                  | 1.11.0   | ISC        |
| `next`                          | 16.2.6   | MIT        |
| `qrcode`                        | 1.5.4    | MIT        |
| `react`                         | 19.2.4   | MIT        |
| `react-dom`                     | 19.2.4   | MIT        |
| `recharts`                      | 3.8.1    | MIT        |
| `shadcn`                        | 4.0.8    | MIT        |
| `tailwind-merge`                | 3.5.0    | MIT        |
| `tw-animate-css`                | 1.4.0    | MIT        |
| `zod`                           | 4.3.6    | MIT        |

## License Compliance Notes

- All dependencies above have been reviewed and fall within the allowed license categories.
- No GPL-licensed packages are included in production bundles.
- This file should be regenerated when dependencies are updated (`npm run audit:licenses`).
- For full license text of each package, see `node_modules/<package>/LICENSE`.
