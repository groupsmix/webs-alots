# CNDP Registration

**C-04: Commission Nationale de contrôle de la protection des Données à caractère Personnel**

## Registration Status

| Item                               | Status                                                         |
| ---------------------------------- | -------------------------------------------------------------- |
| Platform registration              | **PREPARED — Ready to file**                                   |
| Filing date                        | _Submit via https://www.cndp.ma/fr/declaration-prealable.html_ |
| Reference number                   | _TBD (assigned by CNDP after submission)_                      |
| Cross-border transfer notification | Included in declaration below                                  |

## Filing Checklist

- [x] Complete the CNDP registration form (Déclaration Préalable) — prepared below
- [x] Compile list of processing activities (see [dpia.md](./dpia.md))
- [x] Document cross-border data transfers (see [data-flow-map.md](./data-flow-map.md))
- [ ] Submit declaration via CNDP online portal or registered mail
- [ ] Obtain registration receipt
- [ ] Store receipt in this file
- [ ] Display CNDP registration number in privacy policy

## Prepared Declaration (Déclaration Préalable)

### 1. Identité du Responsable du Traitement

| Champ                   | Valeur                                               |
| ----------------------- | ---------------------------------------------------- |
| Dénomination sociale    | Oltigo Health SARL                                   |
| Forme juridique         | SARL                                                 |
| Secteur d'activité      | Santé / Technologies de l'information                |
| Adresse du siège social | _[À compléter — adresse Oltigo Health]_              |
| Ville                   | _[À compléter]_                                      |
| Téléphone               | _[À compléter]_                                      |
| Email                   | _[À compléter — ex. dpo@oltigo.com]_                 |
| Registre du commerce    | _[À compléter — numéro RC]_                          |
| ICE                     | _[À compléter — Identifiant Commun de l'Entreprise]_ |

### 2. Responsable du Traitement / DPO

| Champ         | Valeur                               |
| ------------- | ------------------------------------ |
| Nom et prénom | _[À compléter]_                      |
| Fonction      | Directeur Technique / DPO            |
| Email         | _[À compléter — ex. dpo@oltigo.com]_ |
| Téléphone     | _[À compléter]_                      |

### 3. Finalités du Traitement

La plateforme Oltigo Health effectue les traitements suivants :

| #   | Finalité                                                                         | Base légale                                                 |
| --- | -------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | Gestion des rendez-vous patients (prise, modification, annulation)               | Nécessité contractuelle                                     |
| 2   | Tenue des dossiers médicaux (prescriptions, consultations, documents)            | Obligation légale (conservation dossiers médicaux — 10 ans) |
| 3   | Communication avec les patients (rappels WhatsApp, SMS, email)                   | Consentement explicite                                      |
| 4   | Traitement des paiements (CMI, Stripe)                                           | Nécessité contractuelle                                     |
| 5   | Aide à la décision clinique par IA (prescriptions, interactions médicamenteuses) | Consentement explicite                                      |
| 6   | Journalisation d'audit (actions utilisateurs, accès aux données)                 | Obligation légale (Loi 09-08)                               |
| 7   | Analyse anonymisée de l'utilisation (Plausible Analytics — sans PII)             | Intérêt légitime                                            |
| 8   | Gestion des comptes utilisateurs (inscription, authentification, rôles)          | Nécessité contractuelle                                     |

### 4. Catégories de Personnes Concernées

- Patients des cliniques clientes
- Personnel médical (médecins, réceptionnistes, administrateurs)
- Administrateurs de cliniques

### 5. Catégories de Données Traitées

| Catégorie                        | Données                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Identité**                     | Nom, prénom, email, téléphone, date de naissance, genre                                                            |
| **Données de santé (sensibles)** | Dossiers médicaux, prescriptions, diagnostics, notes de consultation, résultats de laboratoire, documents médicaux |
| **Données financières**          | Montants de paiement, méthode de paiement, références de transaction                                               |
| **Données techniques**           | Adresses IP (anonymisées), journaux d'audit, horodatages                                                           |
| **Données de communication**     | Numéros de téléphone (WhatsApp/SMS), adresses email, contenu des messages de notification                          |

### 6. Destinataires des Données

| Destinataire                  | Données partagées                         | Localisation                | Base du transfert                  |
| ----------------------------- | ----------------------------------------- | --------------------------- | ---------------------------------- |
| Supabase (hébergement BDD)    | Toutes les données                        | UE (Irlande, AWS eu-west-1) | DPA + CCT                          |
| Cloudflare (CDN, Workers, R2) | Traitement des requêtes, documents PHI    | Global (UE prioritaire)     | DPA + CCT                          |
| Stripe                        | Montants de paiement, email client        | US                          | DPA + CCT                          |
| CMI                           | Montants de paiement, IDs commande        | Maroc                       | Contrat marchand                   |
| Meta (WhatsApp Cloud API)     | Numéros de téléphone, modèles de messages | US                          | DPA + CCT + Consentement           |
| Twilio (SMS fallback)         | Numéros de téléphone, codes OTP           | US                          | DPA + CCT + Consentement           |
| Resend (Email)                | Adresses email, contenu notifications     | US                          | DPA + CCT                          |
| OpenAI (IA clinique)          | Contexte clinique dé-identifié            | US                          | DPA + CCT + Consentement explicite |
| Sentry (monitoring erreurs)   | Traces d'erreurs (PHI supprimées)         | US                          | DPA + CCT                          |

### 7. Transferts Transfrontaliers

Des données personnelles sont transférées vers les États-Unis et l'Union Européenne. Les garanties appropriées sont assurées par :

- **Clauses Contractuelles Types (CCT)** conformes à la Décision 2021/914 de la Commission Européenne
- **DPA (Data Processing Agreements)** signés avec chaque sous-traitant
- **Certifications** des sous-traitants : SOC 2 Type II (Supabase, Cloudflare, Stripe), ISO 27001 (Cloudflare), PCI DSS Level 1 (Stripe)
- **Chiffrement** : TLS 1.3 en transit, AES-256-GCM au repos pour les données de santé

### 8. Mesures de Sécurité

| Mesure                     | Implémentation                                                              |
| -------------------------- | --------------------------------------------------------------------------- |
| Chiffrement au repos       | AES-256-GCM pour tous les fichiers PHI (Cloudflare R2)                      |
| Chiffrement en transit     | TLS 1.3 obligatoire                                                         |
| Isolation des locataires   | Row Level Security (PostgreSQL) + filtrage `clinic_id` au niveau applicatif |
| Contrôle d'accès           | RBAC à 5 niveaux (super_admin, clinic_admin, receptionist, doctor, patient) |
| Authentification           | OTP téléphone, headers signés HMAC-SHA256                                   |
| Journalisation d'audit     | Toutes les opérations d'état enregistrées, conservation 2 ans               |
| Protection CSRF            | Vérification de l'en-tête Origin sur les mutations                          |
| Protection contre les bots | Cloudflare Turnstile                                                        |
| Limitation de débit        | Par IP (middleware) + par utilisateur (authentifié)                         |
| Pseudonymisation IA        | Données patient dé-identifiées avant transmission à OpenAI                  |
| Suppression PHI des logs   | Filtres `beforeSend` dans Sentry, logger structuré avec masquage PHI        |

### 9. Durée de Conservation

| Catégorie              | Durée                         | Base légale                                     |
| ---------------------- | ----------------------------- | ----------------------------------------------- |
| Dossiers médicaux      | Durée de la relation + 10 ans | Législation marocaine sur les dossiers médicaux |
| Journaux d'audit       | 2 ans                         | Loi 09-08, conformité                           |
| Données financières    | 10 ans                        | Obligations fiscales                            |
| Comptes supprimés      | Purge après 30 jours de grâce | Droit à l'effacement (Art. 5, Loi 09-08)        |
| Notifications WhatsApp | 90 jours                      | Minimisation des données                        |

### 10. Droits des Personnes Concernées

La plateforme assure les droits suivants :

- **Droit d'accès** : Export des données patient (`/api/patient/export`)
- **Droit de rectification** : Modification du profil par le patient et le personnel
- **Droit à l'effacement** : Suppression de compte avec purge GDPR automatisée (cron quotidien)
- **Droit à la portabilité** : Export JSON/CSV
- **Gestion du consentement** : API de consentement (`/api/consent`) avec table `processing_consents`

---

## How to Submit

1. Visit **https://www.cndp.ma/fr/declaration-prealable.html**
2. Create an account or log in with the Oltigo Health legal representative's credentials
3. Fill in the online form using the information prepared above
4. Attach supporting documents:
   - DPIA (`docs/compliance/dpia.md`)
   - Data flow map (`docs/compliance/data-flow-map.md`)
   - DPA evidence (`docs/vendor-inventory.md` — DPA Tracker section)
5. Pay the filing fee (if applicable)
6. Save the receipt number and update this document

## Contact

- CNDP website: https://www.cndp.ma
- Email: contact@cndp.ma
- Phone: +212 5 37 57 17 00

## Notes

Per Law 09-08, processing of personal data must be declared to the CNDP before
commencement. Healthcare data is classified as "sensitive data" requiring
additional safeguards (Art. 1, Law 09-08).

Healthcare data processing (données de santé) requires a **Déclaration Préalable**
(prior declaration) rather than a simple notification, per Art. 12 of Law 09-08.
The CNDP may request additional information or impose specific conditions.
