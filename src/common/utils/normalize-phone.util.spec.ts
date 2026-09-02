import { normalizePhoneForSend } from './normalize-phone.util';

describe('normalizePhoneForSend', () => {
  it('passes through an already-E.164 number unchanged', () => {
    expect(normalizePhoneForSend('+14155238886', 'US')).toBe('+14155238886');
    // The "+" prefix wins even against a mismatched default country.
    expect(normalizePhoneForSend('+2348137999425', 'US')).toBe('+2348137999425');
  });

  it('normalizes a local Nigerian number to E.164', () => {
    expect(normalizePhoneForSend('08137999425', 'NG')).toBe('+2348137999425');
    // Spaces / punctuation are tolerated.
    expect(normalizePhoneForSend(' 0813 799 9425 ', 'NG')).toBe('+2348137999425');
  });

  it('normalizes a local US number to E.164', () => {
    expect(normalizePhoneForSend('(415) 523-8886', 'US')).toBe('+14155238886');
  });

  it('defaults to NG when no country is given', () => {
    expect(normalizePhoneForSend('08137999425')).toBe('+2348137999425');
  });

  it('returns null for garbage input', () => {
    expect(normalizePhoneForSend('not a phone')).toBeNull();
    expect(normalizePhoneForSend('12345')).toBeNull();
    expect(normalizePhoneForSend('abcdefghij', 'US')).toBeNull();
  });

  it('returns null for empty / whitespace / nullish input', () => {
    expect(normalizePhoneForSend('')).toBeNull();
    expect(normalizePhoneForSend('   ')).toBeNull();
    expect(normalizePhoneForSend(null)).toBeNull();
    expect(normalizePhoneForSend(undefined)).toBeNull();
  });
});
