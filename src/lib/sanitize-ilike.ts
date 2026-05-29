/**
 * Sanitize user input before interpolating into PostgREST `.ilike()` or `.or()`
 * filter expressions. Strips characters that have special meaning in PostgREST
 * filter syntax:
 *
 *   %  — SQL LIKE wildcard (matches any sequence)
 *   _  — SQL LIKE wildcard (matches single char)
 *   ,  — PostgREST OR separator inside `.or()` expressions
 *   .  — PostgREST column.operator separator
 *   (  — PostgREST grouping open
 *   )  — PostgREST grouping close
 *   |  — PostgREST logical OR token
 *   *  — PostgREST wildcard in some contexts
 *
 * Without this sanitization an attacker can inject additional filter clauses
 * (e.g. `role.eq.super_admin`) into `.or()` expressions.
 *
 * @see src/app/api/v1/patients/route.ts — original inline implementation (MED-05 / A46.3)
 */
export function sanitizeIlike(input: string): string {
  return input.replace(/[%_,.()|*]/g, "");
}
