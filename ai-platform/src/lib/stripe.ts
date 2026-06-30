import Stripe from "stripe";

// Lazily-constructed Stripe client. Kept in its own module so both the webhook
// handler and any future checkout/session routes share one instance.
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

// Maps a Stripe price id to one of our internal plan names. Extend as you add
// tiers. Falls back to "pro" for any unrecognised active subscription so a
// paying customer is never accidentally downgraded to free.
export function planForPriceId(priceId: string | undefined): string {
  if (priceId && priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  return "pro";
}
