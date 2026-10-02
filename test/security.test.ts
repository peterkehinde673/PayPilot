import { describe, expect, it } from 'vitest';
import { normalizeUserRequest, SECURITY_HEADERS } from '../server/security';

describe('security helpers', () => {
  it('normalizes valid user requests', () => {
    expect(normalizeUserRequest('  find a laptop  ')).toBe('find a laptop');
  });

  it('rejects empty and oversized user requests', () => {
    expect(normalizeUserRequest('   ')).toBeNull();
    expect(normalizeUserRequest('x'.repeat(1001))).toBeNull();
  });

  it('defines browser hardening headers', () => {
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
    expect(SECURITY_HEADERS['Referrer-Policy']).toBe('no-referrer');
  });
});
