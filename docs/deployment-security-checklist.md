# Liste de vérification de sécurité — Déploiement Cloudflare Workers

> Adaptée du skill ECC healthcare-phi-compliance.
> À vérifier **avant chaque déploiement** sur Cloudflare Workers.

## Protection des données de santé (PHI)

| #   | Vérification                                                                 | Critique | Statut |
| --- | ---------------------------------------------------------------------------- | -------- | ------ |
| 1   | Pas de PHI dans les messages d'erreur ou les stack traces                    | ✓        | ☐      |
| 2   | Pas de PHI dans `console.log` / `console.error`                              | ✓        | ☐      |
| 3   | Pas de PHI dans les paramètres URL (query strings, path segments)            | ✓        | ☐      |
| 4   | Pas de PHI dans `localStorage` ou `sessionStorage`                           | ✓        | ☐      |
| 5   | Pas de clé `service_role` dans le code client                                | ✓        | ☐      |
| 6   | Utilisation exclusive d'UUIDs opaques dans les logs (pas de noms, CIN, etc.) | ✓        | ☐      |

## Base de données & isolation multi-tenant

| #   | Vérification                                                                                   | Critique | Statut |
| --- | ---------------------------------------------------------------------------------------------- | -------- | ------ |
| 7   | RLS activé sur toutes les tables PHI/PII                                                       | ✓        | ☐      |
| 8   | Toutes les requêtes incluent `.eq('clinic_id', clinicId)`                                      | ✓        | ☐      |
| 9   | `requireTenant()` utilisé dans tous les handlers (pas de clinic_id hardcodé)                   | ✓        | ☐      |
| 10  | Isolation inter-cliniques vérifiée (test : login clinique A, requête clinique B → 0 résultats) | ✓        | ☐      |
| 11  | Webhook handlers résolvent le `clinic_id` depuis le payload                                    | ✓        | ☐      |

## Audit & conformité

| #   | Vérification                                                                         | Critique | Statut |
| --- | ------------------------------------------------------------------------------------ | -------- | ------ |
| 12  | Journal d'audit (`logAuditEvent`) pour toutes les opérations de modification         | ✓        | ☐      |
| 13  | Journal d'audit tamper-proof (insert-only, pas d'UPDATE/DELETE sur `activity_logs`)  | ✓        | ☐      |
| 14  | Overrides CDSS documentés dans `cdss_override_log` avec raison obligatoire           | ✓        | ☐      |
| 15  | Encounters verrouillées après signature (trigger DB `prevent_signed_encounter_edit`) | ✓        | ☐      |

## Sécurité de l'application

| #   | Vérification                                            | Critique | Statut |
| --- | ------------------------------------------------------- | -------- | ------ |
| 16  | Authentification API sur tous les endpoints PHI         | ✓        | ☐      |
| 17  | Protection CSRF (middleware vérifie l'en-tête `Origin`) | ✓        | ☐      |
| 18  | Validation des entrées avec Zod sur tous les endpoints  | ✓        | ☐      |
| 19  | Rate limiting sur les endpoints AI et CDSS              | ✓        | ☐      |
| 20  | Délai d'expiration de session configuré                 |          | ☐      |

## Chiffrement & stockage

| #   | Vérification                                                          | Critique | Statut |
| --- | --------------------------------------------------------------------- | -------- | ------ |
| 21  | Chiffrement AES-256-GCM pour les fichiers patients dans Cloudflare R2 | ✓        | ☐      |
| 22  | IV unique par fichier                                                 | ✓        | ☐      |
| 23  | Validation magic bytes + MIME type sur les uploads                    | ✓        | ☐      |
| 24  | Prévention de path traversal via `buildUploadKey()`                   | ✓        | ☐      |

## Cloudflare Workers spécifique

| #   | Vérification                                                         | Critique | Statut |
| --- | -------------------------------------------------------------------- | -------- | ------ |
| 25  | En-têtes de sécurité configurés (CSP, X-Frame-Options, etc.)         |          | ☐      |
| 26  | Variables d'environnement (secrets) configurées dans Wrangler        | ✓        | ☐      |
| 27  | Pas de secrets dans `wrangler.toml` (utiliser `wrangler secret put`) | ✓        | ☐      |
| 28  | Bundle size < 800 kB (shared JS limit)                               |          | ☐      |

## Vecteurs de fuite PHI courants

Référence rapide des erreurs les plus fréquentes :

```typescript
// ❌ MAUVAIS — fuite de PHI dans l'erreur
throw new Error(`Patient ${patient.name} non trouvé dans ${patient.facility}`);

// ✅ BON — erreur générique, détails loggés côté serveur avec UUID uniquement
logger.error("Patient lookup failed", { recordId: patient.id, clinicId });
throw new Error("Enregistrement non trouvé");

// ❌ MAUVAIS — log de l'objet patient complet
console.log("Processing patient:", patient);

// ✅ BON — log de l'UUID opaque uniquement
logger.info("Processing record", { recordId: patient.id });
```

## Loi marocaine 09-08

Ce système traite des données de santé soumises à la loi marocaine 09-08 relative à la
protection des personnes physiques à l'égard du traitement des données à caractère personnel.
Toutes les mesures ci-dessus doivent être vérifiées pour assurer la conformité.
