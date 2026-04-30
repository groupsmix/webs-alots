# Incident Communications Templates (A187 / A248.4)

Pre-assembled templates for use during security incidents. Fill in `[PLACEHOLDERS]`
and send within the timelines specified in `docs/incident-response.md`.

---

## 1. CNDP (Commission Nationale de controle de la protection des Donnees personnelles)

**Language:** French
**Deadline:** 72 hours from discovery (Law 09-08)

> **Objet:** Notification de violation de donnees a caractere personnel — [NOM_CLINIQUE]
>
> Madame, Monsieur,
>
> Conformement a la Loi 09-08 relative a la protection des personnes physiques a l'egard du traitement des donnees a caractere personnel, nous vous informons d'un incident de securite affectant des donnees de sante.
>
> **Date de decouverte:** [DATE_DECOUVERTE]
> **Nature de l'incident:** [DESCRIPTION: ex. acces non autorise, ransomware, fuite de donnees]
> **Categories de donnees concernees:** [DONNEES: ex. noms, telephones, dossiers medicaux]
> **Nombre approximatif de personnes concernees:** [NOMBRE]
> **Mesures prises:** [MESURES: ex. isolation du systeme, reinitialisation des acces, notification des patients]
> **Contact du DPO:** [NOM_DPO] — [EMAIL_DPO] — [TEL_DPO]
>
> Nous restons a votre disposition pour toute information complementaire.
>
> Cordialement,
> [NOM_RESPONSABLE], [TITRE]
> Oltigo Health pour le compte de [NOM_CLINIQUE]

---

## 2. Patient Notification Email

### French

> **Objet:** Information importante concernant la securite de vos donnees — [NOM_CLINIQUE]
>
> Cher(e) patient(e),
>
> Nous vous contactons pour vous informer d'un incident de securite qui a affecte [NOM_CLINIQUE] le [DATE].
>
> **Ce qui s'est passe:** [DESCRIPTION_SIMPLE]
> **Quelles donnees sont concernees:** [DONNEES_CONCERNEES]
> **Ce que nous avons fait:** [MESURES_PRISES]
> **Ce que vous pouvez faire:** [RECOMMANDATIONS: ex. changez votre mot de passe, surveillez vos comptes]
>
> Pour toute question, contactez-nous au [TELEPHONE] ou a [EMAIL].
>
> Nous nous excusons pour cet incident et restons mobilises pour proteger vos donnees.
>
> [NOM_CLINIQUE]

### Arabic

> **الموضوع:** معلومات هامة حول أمان بياناتكم — [اسم_العيادة]
>
> عزيزي/عزيزتي المريض(ة)،
>
> نتواصل معكم لإبلاغكم بحادث أمني أثر على [اسم_العيادة] بتاريخ [التاريخ].
>
> **ما حدث:** [وصف_بسيط]
> **البيانات المعنية:** [البيانات_المعنية]
> **ما قمنا به:** [الإجراءات_المتخذة]
> **ما يمكنكم فعله:** [التوصيات]
>
> لأي استفسار، اتصلوا بنا على [الهاتف] أو [البريد_الإلكتروني].
>
> [اسم_العيادة]

### English

> **Subject:** Important information about the security of your data — [CLINIC_NAME]
>
> Dear patient,
>
> We are writing to inform you of a security incident that affected [CLINIC_NAME] on [DATE].
>
> **What happened:** [SIMPLE_DESCRIPTION]
> **What data was involved:** [DATA_INVOLVED]
> **What we have done:** [MEASURES_TAKEN]
> **What you can do:** [RECOMMENDATIONS: e.g., change your password, monitor your accounts]
>
> For questions, contact us at [PHONE] or [EMAIL].
>
> [CLINIC_NAME]

---

## 3. Press / Public Statement

> Oltigo Health has identified a security incident affecting [NUMBER] clinics on [DATE].
> We immediately activated our incident response plan, isolated affected systems, and
> engaged third-party forensic investigators. Affected patients are being notified
> directly. The Moroccan data protection authority (CNDP) has been notified in
> accordance with Law 09-08. We are cooperating fully with the investigation.
>
> For updates: [STATUS_PAGE_URL]
> Media contact: [MEDIA_EMAIL]

---

## 4. Internal Slack / War-Room Opener

> :rotating_light: **SECURITY INCIDENT DECLARED** — Severity: [SEV-1/SEV-2/SEV-3]
> **IC:** [INCIDENT_COMMANDER_NAME]
> **Scribe:** [SCRIBE_NAME]
> **Bridge:** [CALL_LINK]
> **Timeline doc:** [TIMELINE_DOC_URL]
>
> **Summary:** [ONE_LINE_SUMMARY]
> **Impact:** [PATIENT_IMPACT_ESTIMATE]
> **Current status:** [INVESTIGATING / CONTAINED / ERADICATED / RECOVERED]
>
> Next check-in: [TIME]

---

## Usage Checklist

- [ ] Determine severity (SEV-1/2/3) per `docs/incident-response.md`
- [ ] Assign Incident Commander and Scribe
- [ ] Open war-room bridge call
- [ ] Fill and send CNDP notification within 72h
- [ ] Fill and send patient notifications (FR + AR + EN as needed)
- [ ] Prepare press statement if patient count > 100 or media interest
- [ ] Post internal Slack opener
- [ ] Invoke legal-hold procedure (see `docs/legal-hold.md`)
