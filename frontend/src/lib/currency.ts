export type CurrencyConfig = {
  symbol: string;
  code: 'NGN' | 'USD';
  isNigeria: boolean;
  plans: {
    SMS: { price: string; monthlyPrice: string };
    SMS_VOICE: { price: string; monthlyPrice: string };
    SMS_VOICE_AI: { price: string; monthlyPrice: string };
  };
  formatAmount: (amount: number) => string;
  perMessage: string;
  perMinute: string;
  perWhatsApp: string;
  perMessageEst: string;
};

export function detectCurrency(): CurrencyConfig {
  let isNigeria = false;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    isNigeria = tz === 'Africa/Lagos' || tz === 'Africa/Abuja';
  } catch {}

  if (isNigeria) {
    return {
      symbol: '₦',
      code: 'NGN',
      isNigeria: true,
      plans: {
        SMS:          { price: '₦5,000', monthlyPrice: '₦5,000/month' },
        SMS_VOICE:    { price: '₦10,000', monthlyPrice: '₦10,000/month' },
        SMS_VOICE_AI: { price: '₦18,000', monthlyPrice: '₦18,000/month' },
      },
      formatAmount: (v) => v >= 1000 ? `₦${(v / 1000).toFixed(1)}k` : `₦${v}`,
      perMessage: '₦25 – ₦45',
      perMinute: '₦15',
      perWhatsApp: '₦5 – ₦65',
      perMessageEst: '₦60',
    };
  }

  return {
    symbol: '$',
    code: 'USD',
    isNigeria: false,
    plans: {
      SMS:          { price: '$19', monthlyPrice: '$19/month' },
      SMS_VOICE:    { price: '$49', monthlyPrice: '$49/month' },
      SMS_VOICE_AI: { price: '$99', monthlyPrice: '$99/month' },
    },
    formatAmount: (v) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`,
    perMessage: '$0.01 – $0.03',
    perMinute: '$0.01',
    perWhatsApp: '$0.01 – $0.05',
    perMessageEst: '$0.04',
  };
}
