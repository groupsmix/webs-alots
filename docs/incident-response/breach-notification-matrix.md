# Incident Response: Breach Notification Matrix
## Finding F-A190

> **Version:** 1.0 | **Owner:** DPO + CISO | **Review:** Quarterly

---

## Regulatory Timelines

| Authority | Trigger | Deadline | Channel | Reference |
|---|---|---|---|---|
| **CNDP (Morocco)** | Breach of personal data likely to risk rights/freedoms | **72 hours** from discovery | CNDP online portal + registered letter | Law 09-08, Art. 24 |
| **GDPR (EU patients)** | Breach involving EU data subjects | **72 hours** to supervisory authority; *without undue delay* to subjects if high risk | Lead SA (CNIL if French patients) | GDPR Art. 33-34 |
| **Patients (direct)** | High-risk breach (medical data exfiltrated, identity theft risk) | **Without undue delay** after assessment | Email + WhatsApp + in-app notification | Law 09-08 + GDPR Art. 34 |
| **Clinic customers** | Breach affects clinic's patient data | **24 hours** internal SLA; **72 hours** formal notice | Encrypted email to clinic admin | SLA contract |
| **Cyber-insurance** | Any confirmed security incident | **24 hours** from declaration of incident | Phone + written notice to broker | Policy schedule |

---

## Decision Tree

```
Incident discovered
      │
      ▼
Is it a PERSONAL DATA BREACH? ──No──► Normal incident response (docs/incident-response.md)
      │Yes
      ▼
Is risk to individuals UNLIKELY? ──Yes──► Document internally; no external notification required
      │No
      ▼
Notify CNDP within 72h (regardless of risk level)
      │
      ▼
Is risk HIGH (medical data, financial, ID theft)?
   │Yes                            │No
   ▼                               ▼
Notify affected individuals    Notify CNDP only
 without undue delay
```

---

## CNDP Notification — Required Content (Law 09-08 Art. 24)

1. Nature of the breach (categories of data, approximate number of records)
2. Name and contact details of the DPO
3. Likely consequences of the breach
4. Measures taken or proposed to address the breach
5. Timeline of events
6. Categories and approximate number of data subjects affected

**Portal:** https://cndp.ma (requires registered organisation account)  
**DPO contact on file:** `dpo@oltigo.com`

---

## Notification Draft Templates

See `docs/comms-templates/` for:
- `cndp-notification.md` — CNDP formal notice in French/Arabic
- `patient-breach-notification.md` — Patient WhatsApp + email template
- `clinic-breach-notification.md` — B2B clinic customer notification
- `press-statement.md` — Media holding statement

---

## Post-Notification Actions

- [ ] File copies of all notifications in `docs/audit/breach-log/`
- [ ] Track CNDP acknowledgement (they reply within 15 days)
- [ ] Update DPA register with breach reference number
- [ ] Schedule post-incident review at D+30
- [ ] Review and update this matrix if timelines changed

---

## Last drill: _Not yet conducted — schedule Q3 2025_
