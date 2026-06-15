import { withChaos } from "@/lib/chaos/chaos-engine";
import { safeFetch } from "@/lib/fetch-wrapper";

export async function createPaymentIntent(amount: number) {
  return withChaos("external_api_timeout", async () => {
    const response = await safeFetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      body: JSON.stringify({ amount, currency: "mad" }),
    });

    return response.json();
  });
}
