'use client';
import { useState, useEffect } from 'react';
import { detectCurrency, CurrencyConfig } from '@/lib/currency';

export function useCurrency(): CurrencyConfig {
  const [config, setConfig] = useState<CurrencyConfig>(detectCurrency());
  useEffect(() => { setConfig(detectCurrency()); }, []);
  return config;
}
