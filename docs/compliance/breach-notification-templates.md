# Breach Notification Templates

> **Audit finding:** A190 | **Last updated:** April 2026

Pre-approved templates for mandatory breach notifications. These must be
reviewed by legal counsel before first use.

---

## Applicable Regulations

| Regulation | Applies When | Notification Deadline |
|-----------|-------------|---------------------|
| **Law 09-08 / CNDP** (Morocco) | Always (PHI of Moroccan residents) | "Without delay" (no explicit hour limit; treat as 72h) |
| **GDPR** (EU) | If any EU data subjects affected (EU-resident patients, French/Spanish expats) | 72 hours from awareness |
| **HIPAA** | Only if a US-based covered entity is onboarded (currently N/A) | 60 days |

---

## 1. CNDP Notification (Morocco -- Law 09-08)

**To:** Commission Nationale de controle de la protection des Donnees (`contact@cndp.ma`)
**Subject:** `Notification d'incident de securite des donnees -- Oltigo Health`

```
Monsieur/Madame le President de la CNDP,

Conformement a la Loi 09-08 relative a la protection des personnes physiques
a l'egard du traitement des donnees a caractere personnel, nous avons
l'honneur de vous notifier un incident de securite affectant des donnees
personnelles traitees par notre plateforme.

1. IDENTITE DU RESPONSABLE DU TRAITEMENT
   - Raison sociale : [Oltigo Health / entity name]
   - Adresse : [Address]
   - Contact DPO : security@oltigo.com
   - Numero d'enregistrement CNDP : [TBD -- see docs/compliance/cndp.md]

2. DESCRIPTION DE L'INCIDENT
   - Date de decouverte : [YYYY-MM-DD HH:MM UTC]
   - Date estimee de debut : [YYYY-MM-DD HH:MM UTC]
   - Nature de l'incident : [unauthorized access / data exposure / ransomware / etc.]
   - Description : [Brief factual description]

3. DONNEES CONCERNEES
   - Types de donnees : [PHI, PII, email, phone, medical records, etc.]
   - Nombre de personnes concernees : [exact or estimated count]
   - Categories de personnes : [patients / doctors / clinic staff]

4. CONSEQUENCES PROBABLES
   - [Description of potential impact on data subjects]

5. MESURES PRISES
   - Mesures de containment : [What was done to stop the breach]
   - Mesures correctives : [What is being done to prevent recurrence]
   - Notification aux personnes concernees : [Yes/No, date, method]

6. CONTACT
   - Nom : [Security Officer / DPO name]
   - Email : security@oltigo.com
   - Telephone : [Phone number]

Nous restons a votre disposition pour tout complement d'information.

Veuillez agreer, Monsieur/Madame le President, l'expression de nos
salutations distinguees.

[Signature]
[Name, Title]
[Date]
```

---

## 2. GDPR Supervisory Authority Notification (72-Hour)

**To:** Lead supervisory authority (likely CNIL if French data subjects,
or the DPA of the EU country where most affected subjects reside)

**Subject:** `Personal data breach notification -- Oltigo Health`

```
Dear Data Protection Authority,

Pursuant to Article 33 of the General Data Protection Regulation (EU)
2016/679, we are notifying you of a personal data breach.

1. CONTROLLER DETAILS
   - Organization: [Oltigo Health / entity name]
   - DPO contact: security@oltigo.com
   - EU representative (if applicable): [Name, address]

2. NATURE OF THE BREACH
   - Date/time of breach: [YYYY-MM-DD HH:MM UTC]
   - Date/time of awareness: [YYYY-MM-DD HH:MM UTC]
   - Categories of breach: [Confidentiality / Integrity / Availability]
   - Description: [Factual summary]

3. DATA AND DATA SUBJECTS AFFECTED
   - Categories of data subjects: [patients / healthcare providers]
   - Approximate number of data subjects: [count]
   - Categories of personal data: [health data, contact info, etc.]
   - Approximate number of records: [count]

4. LIKELY CONSEQUENCES
   - [Assessment of risk to rights and freedoms of data subjects]

5. MEASURES TAKEN / PROPOSED
   - Containment: [Actions taken]
   - Remediation: [Planned actions]
   - Communication to data subjects: [Yes/No -- if yes, method and timing]
     (per Article 34, required if high risk to rights and freedoms)

6. REASON FOR DELAY (if notification > 72 hours)
   - [Explanation, if applicable]

7. ADDITIONAL INFORMATION
   - [Any supplementary details]

Respectfully,

[Name, Title]
[Date]
```

---

## 3. Data Subject Notification

**To:** Affected patients / users
**Subject:** `[Oltigo Health] Important security notice / Notification de securite`

```
Bonjour [Name],

We are writing to inform you of a security incident that may have affected
your personal information.

WHAT HAPPENED
[Plain-language description of the incident]

WHAT INFORMATION WAS INVOLVED
[List the specific types of data affected -- e.g., name, email, phone,
appointment history. Be specific.]

WHAT WE ARE DOING
[Steps taken to contain and remediate]

WHAT YOU CAN DO
- Change your password at [link]
- Monitor your accounts for suspicious activity
- Contact us at security@oltigo.com with any questions

We sincerely apologize for this incident and are committed to protecting
your information.

Cordialement,
Oltigo Health Team
security@oltigo.com

---

Version francaise:

Bonjour [Nom],

Nous vous ecrivons pour vous informer d'un incident de securite qui a pu
affecter vos informations personnelles.

CE QUI S'EST PASSE
[Description en langage simple]

QUELLES INFORMATIONS SONT CONCERNEES
[Liste des types de donnees affectees]

CE QUE NOUS FAISONS
[Mesures prises]

CE QUE VOUS POUVEZ FAIRE
- Changez votre mot de passe sur [lien]
- Surveillez vos comptes pour toute activite suspecte
- Contactez-nous a security@oltigo.com

Nous nous excusons sincerement pour cet incident.

Cordialement,
L'equipe Oltigo Health
```

---

## 4. Pre-Notification Checklist

Before sending any notification:

- [ ] Incident confirmed (not a false positive)
- [ ] Scope fully assessed (or best current estimate documented)
- [ ] Legal counsel reviewed notification text
- [ ] Security Officer / DPO approved sending
- [ ] Notification method determined (email, in-app, postal if required)
- [ ] Sent within regulatory deadline
- [ ] Copy archived in incident file

---

## Related Documents

- [CNDP Registration](./cndp.md)
- [Incident Response Runbook](../incident-response.md)
- [Communications Templates](../comms-templates/README.md)
- [SECURITY.md](../../SECURITY.md)
