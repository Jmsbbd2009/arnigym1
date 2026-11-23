export type PaymentProviderName = 'payme' | 'lemon_squeezy';
export type PaymentCheckoutInput = {
  userId: string;
  userEmail: string;
  planKey: 'monthly' | 'yearly';
  amountUzs: number;
  amountUsd: number;
  lemonVariantId: string;
};
export type PaymentCheckout = { provider: PaymentProviderName; checkoutUrl: string };
export interface PaymentProviderAdapter {
  readonly name: PaymentProviderName;
  createCheckout(input: PaymentCheckoutInput): Promise<PaymentCheckout>;
}
