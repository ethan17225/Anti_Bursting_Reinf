import { describe, expect, it } from 'vitest';
import { calculate } from './calculationEngine';
import { explain } from './formulas';
import { fmt } from './format';
import { VN_HIGHRISE_PRESETS } from './presets';

const input = VN_HIGHRISE_PRESETS[0].input;

describe('formula explanations', () => {
  const r = calculate(input);
  const p = r.piles[0];

  it('quotes the calculated value instead of recomputing it', () => {
    expect(explain('Fc', input, r, p.id).value).toBe(`${fmt(p.Fc)} kN`);
    expect(explain('R', input, r, p.id).value).toBe(`${fmt(p.R)} kN`);
    expect(explain('Tperp', input, r, p.id).value).toBe(`${fmt(p.Tperp)} kN`);
    const worst = r.piles.reduce((a, q) => (q.URcrush > a.URcrush ? q : a));
    expect(explain('crush', input, r, worst.id).value).toBe(fmt(worst.URcrush, 2));
  });

  it('uses the ACI bottle formula only for ACI', () => {
    expect(explain('Tperp', input, r, p.id).lines.join('\n')).not.toContain('ACI');
    const aciInput = { ...input, material: { ...input.material, standard: 'ACI_318_19' as const } };
    const aci = calculate(aciInput);
    const lines = explain('Tperp', aciInput, aci, aci.piles[0].id).lines.join('\n');
    expect(lines).toContain('ACI 318-19 §23.5');
    expect(lines).toContain('0.25·F_c');
  });
});
