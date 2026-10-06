import { describe, it, expect } from 'vitest';
import { margin, outstanding } from '../packages/analytics/finance';
import { commands } from '../packages/domain/commands';
describe('Money integrity', () => {
  it('keeps decimal precision', () =>
    expect(outstanding('0.30', '0', ['0.10', '0.20'])).toBe('0.00'));
  it('does not fabricate real margins with incomplete costs', () =>
    expect(margin('1000', '100', false)).toBeNull());
  it('handles zero revenue without division errors', () =>
    expect(margin('0', '100', true)).toBeNull());
  it('calculates negative and positive complete margins', () => {
    expect(margin('1000', '1200', true)).toBe('-20');
    expect(margin('1000', '300', true)).toBe('70');
  });
  it('rejects invalid payments and tenant spoofing', () => {
    expect(commands.safeParse({ action: 'record_payment', amount: -10 }).success).toBe(false);
    const r = commands.parse({
      action: 'create_lead',
      company: 'Test',
      contact: 'Contact',
      email: 'test@example.com',
      need: 'Test study',
      source: 'Referral',
      next_action: 'Discovery',
      tenant_id: 'spoof',
    });
    expect(r).not.toHaveProperty('tenant_id');
  });
});
