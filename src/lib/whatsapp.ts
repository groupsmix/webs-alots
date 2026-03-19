const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

interface WhatsAppMessagePayload {
  to: string;
  templateName: string;
  languageCode?: string;
  parameters?: string[];
}

export async function sendWhatsAppMessage({
  to,
  templateName,
  languageCode = "en",
  parameters = [],
}: WhatsAppMessagePayload) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.warn("WhatsApp API credentials not configured");
    return null;
  }

  const response = await fetch(
    `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components:
            parameters.length > 0
              ? [
                  {
                    type: "body",
                    parameters: parameters.map((p) => ({
                      type: "text",
                      text: p,
                    })),
                  },
                ]
              : undefined,
        },
      }),
    },
  );

  return response.json();
}

export async function sendTextMessage(to: string, body: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.warn("WhatsApp API credentials not configured");
    return null;
  }

  const response = await fetch(
    `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    },
  );

  return response.json();
}
