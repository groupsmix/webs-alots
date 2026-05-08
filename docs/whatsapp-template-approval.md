# WhatsApp Template Approval — Meta Business API

This guide documents how to submit WhatsApp message templates for approval through the Meta (Facebook) Business API. All templates **must** be approved by Meta before they can be sent via the WhatsApp Business API.

## Prerequisites

1. **Meta Business Account** — [business.facebook.com](https://business.facebook.com)
2. **WhatsApp Business Account (WABA)** linked to your Meta Business Account
3. **Phone Number** registered and verified in the WABA
4. **System User Token** with `whatsapp_business_management` permission

## Template Categories

Meta classifies templates into three categories:

| Category | Description | Approval Speed |
|---|---|---|
| **UTILITY** | Transaction-related (confirmations, reminders, receipts) | Usually fast (minutes to hours) |
| **MARKETING** | Promotions, offers, re-engagement | Slower (hours to days) |
| **AUTHENTICATION** | OTP / verification codes | Fast |

Most clinic templates fall under **UTILITY** (appointment confirmations, reminders, prescriptions, payments).

## Submission Methods

### Method 1: WhatsApp Manager (Recommended for first-time setup)

1. Go to [business.facebook.com/wa/manage/message-templates](https://business.facebook.com/wa/manage/message-templates)
2. Select your WhatsApp Business Account
3. Click **Create Template**
4. Fill in:
   - **Category**: Select `Utility` for transactional messages
   - **Name**: Use the `metaTemplateName` from `whatsapp-templates-darija.ts` (e.g., `booking_confirmation_darija`)
   - **Language**: Select **Arabic** (`ar`) — Meta does not have a "Darija" option, so Arabic is used as the base language
5. Add template body with variables:
   - Use `{{1}}`, `{{2}}`, etc. as positional parameters (Meta format)
   - Map these to the `{{variable_name}}` placeholders in our code
6. Add sample values for each variable (required for review)
7. Submit for review

### Method 2: WhatsApp Business Management API

Submit templates programmatically via the API:

```bash
curl -X POST \
  "https://graph.facebook.com/v21.0/<WABA_ID>/message_templates" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "booking_confirmation_darija",
    "category": "UTILITY",
    "language": "ar",
    "components": [
      {
        "type": "BODY",
        "text": "السلام {{1}} 👋\n\nالموعد ديالك تأكد ✅\n\n🩺 دكتور: {{2}}\n📅 نهار: {{3}}\n🕐 الوقت: {{4}}\n💼 الخدمة: {{5}}\n📍 العنوان: {{6}}\n\nإلا بغيتي تبدل ولا تلغي: {{7}}\n\n{{8}}",
        "example": {
          "body_text": [
            ["كريم", "أحمد بنعلي", "2026-03-20", "09:00", "استشارة عامة", "123 شارع الحسن الثاني، الدار البيضاء", "https://clinic.ma/manage/123", "عيادة الصحة"]
          ]
        }
      }
    ]
  }'
```

## Template-to-API Variable Mapping

Our code uses named `{{variable_name}}` placeholders, but Meta requires positional `{{1}}`, `{{2}}`, etc. Here is the mapping for each Darija template:

### 1. `booking_confirmation_darija` (UTILITY)

| Position | Variable | Example |
|---|---|---|
| `{{1}}` | `patient_name` | كريم |
| `{{2}}` | `doctor_name` | أحمد بنعلي |
| `{{3}}` | `date` | 2026-03-20 |
| `{{4}}` | `time` | 09:00 |
| `{{5}}` | `service_name` | استشارة عامة |
| `{{6}}` | `clinic_address` | 123 شارع الحسن الثاني |
| `{{7}}` | `manage_url` | https://clinic.ma/manage/123 |
| `{{8}}` | `clinic_name` | عيادة الصحة |

### 2. `reminder_24h_darija` (UTILITY)

| Position | Variable | Example |
|---|---|---|
| `{{1}}` | `patient_name` | كريم |
| `{{2}}` | `doctor_name` | أحمد بنعلي |
| `{{3}}` | `time` | 09:00 |
| `{{4}}` | `clinic_name` | عيادة الصحة |
| `{{5}}` | `clinic_address` | 123 شارع الحسن الثاني |

### 3. `cancellation_darija` (UTILITY)

| Position | Variable | Example |
|---|---|---|
| `{{1}}` | `patient_name` | كريم |
| `{{2}}` | `doctor_name` | أحمد بنعلي |
| `{{3}}` | `date` | 2026-03-20 |
| `{{4}}` | `time` | 09:00 |
| `{{5}}` | `clinic_phone` | +212 6 00 00 00 00 |
| `{{6}}` | `clinic_name` | عيادة الصحة |

### 4. `prescription_ready_darija` (UTILITY)

| Position | Variable | Example |
|---|---|---|
| `{{1}}` | `patient_name` | كريم |
| `{{2}}` | `doctor_name` | أحمد بنعلي |
| `{{3}}` | `clinic_name` | عيادة الصحة |
| `{{4}}` | `clinic_address` | 123 شارع الحسن الثاني |

### 5. `payment_received_darija` (UTILITY)

| Position | Variable | Example |
|---|---|---|
| `{{1}}` | `patient_name` | كريم |
| `{{2}}` | `amount` | 200 |
| `{{3}}` | `currency` | MAD |
| `{{4}}` | `payment_method` | بطاقة |
| `{{5}}` | `invoice_id` | INV-001 |
| `{{6}}` | `clinic_name` | عيادة الصحة |

### 6. `welcome_darija` (UTILITY)

| Position | Variable | Example |
|---|---|---|
| `{{1}}` | `patient_name` | كريم |
| `{{2}}` | `clinic_name` | عيادة الصحة |
| `{{3}}` | `clinic_phone` | +212 6 00 00 00 00 |
| `{{4}}` | `clinic_address` | 123 شارع الحسن الثاني |

### 7. `review_request_darija` (MARKETING)

| Position | Variable | Example |
|---|---|---|
| `{{1}}` | `patient_name` | كريم |
| `{{2}}` | `doctor_name` | أحمد بنعلي |
| `{{3}}` | `booking_url` | https://clinic.ma/review |
| `{{4}}` | `clinic_name` | عيادة الصحة |

> **Note**: Review requests are categorized as **MARKETING** and may take longer to approve.

### 8. `rescheduled_darija` (UTILITY)

| Position | Variable | Example |
|---|---|---|
| `{{1}}` | `patient_name` | كريم |
| `{{2}}` | `doctor_name` | أحمد بنعلي |
| `{{3}}` | `date` | 2026-03-25 |
| `{{4}}` | `time` | 10:00 |
| `{{5}}` | `clinic_phone` | +212 6 00 00 00 00 |
| `{{6}}` | `clinic_name` | عيادة الصحة |

### 9. `waiting_room_darija` (UTILITY)

| Position | Variable | Example |
|---|---|---|
| `{{1}}` | `patient_name` | كريم |
| `{{2}}` | `doctor_name` | أحمد بنعلي |
| `{{3}}` | `time` | 15 دقيقة |
| `{{4}}` | `clinic_name` | عيادة الصحة |

### 10. `follow_up_darija` (UTILITY)

| Position | Variable | Example |
|---|---|---|
| `{{1}}` | `patient_name` | كريم |
| `{{2}}` | `doctor_name` | أحمد بنعلي |
| `{{3}}` | `booking_url` | https://clinic.ma/book |
| `{{4}}` | `clinic_name` | عيادة الصحة |

## Approval Tips

1. **Use clear sample content** — provide realistic Moroccan names, addresses, and amounts
2. **Avoid promotional language** in UTILITY templates — keep them transactional
3. **Include opt-out instructions** if sending marketing messages
4. **Don't use URL shorteners** — Meta may reject templates with shortened URLs
5. **Emojis are allowed** — they help engagement and are accepted by Meta
6. **Review times**: UTILITY templates typically take minutes to a few hours; MARKETING templates can take up to 24 hours

## Checking Template Status

### Via API

```bash
curl -X GET \
  "https://graph.facebook.com/v21.0/<WABA_ID>/message_templates?name=booking_confirmation_darija" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Via WhatsApp Manager

Go to [business.facebook.com/wa/manage/message-templates](https://business.facebook.com/wa/manage/message-templates) and check the **Status** column.

Possible statuses:
- **APPROVED** — Ready to use
- **PENDING** — Under review
- **REJECTED** — Fix issues and resubmit

## Handling Rejections

Common rejection reasons:

| Reason | Fix |
|---|---|
| Missing sample values | Add realistic example values for every variable |
| URL in body without URL button | Use a URL button component or remove the URL |
| Promotional content in UTILITY | Change category to MARKETING or remove promotional language |
| Duplicate template name | Use a unique name (our templates use `_darija` suffix) |

## Integration with Codebase

The Darija templates are defined in `src/lib/whatsapp-templates-darija.ts`. Each template has a `metaTemplateName` field that corresponds to the name used when submitting to Meta.

The `sendNotificationWhatsApp()` function in `src/lib/whatsapp.ts` accepts a `locale` parameter. When set to `"darija"`, it automatically uses the Darija template set.

The clinic's preferred locale is stored in the `patient_message_locale` column of the `clinics` table and can be configured in **Admin > Settings > WhatsApp Templates**.

## Bulk Submission Script

To submit all 10 Darija templates at once, you can use the following script pattern:

```bash
# Set your credentials
WABA_ID="your_waba_id"
TOKEN="your_access_token"

# Submit each template
for template in booking_confirmation_darija reminder_24h_darija cancellation_darija \
  prescription_ready_darija payment_received_darija welcome_darija \
  review_request_darija rescheduled_darija waiting_room_darija follow_up_darija; do

  echo "Submitting $template..."
  curl -s -X POST \
    "https://graph.facebook.com/v21.0/$WABA_ID/message_templates" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d @"templates/${template}.json"

  echo ""
  sleep 2  # Rate limit safety
done
```

Create individual JSON files for each template in a `templates/` directory with the appropriate body text and sample values.
