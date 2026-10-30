import { canExpose, DEFAULT_RISK, frequencies, lastDigit, nextStake, validateRisk, wilsonLower } from '../strategy';
describe('digit analysis', () => {
    it('retains trailing zeros using market precision', () => {
        expect(lastDigit(123.4, 2)).toBe(0);
        expect(lastDigit(123.4, 1)).toBe(4);
        expect(frequencies([1.2, 1.23, 1.29], 2)).toEqual([1, 0, 0, 1, 0, 0, 0, 0, 0, 1]);
    });
    it.each([NaN, Infinity, -Infinity])('rejects an invalid quote %s', price => {
        expect(() => lastDigit(price, 2)).toThrow();
    });
    it('rejects unknown precision rather than guessing digits', () => {
        expect(() => lastDigit(1, NaN)).toThrow();
        expect(() => lastDigit(1, 12)).toThrow();
    });
    it('uses a conservative sample bound, not observed frequency', () => {
        expect(wilsonLower(50, 100)).toBeCloseTo(0.40383, 4);
        expect(wilsonLower(500, 1000)).toBeGreaterThan(wilsonLower(50, 100));
        expect(wilsonLower(0, 0)).toBe(0);
    });
});
describe('risk enforcement', () => {
    it('accepts the bounded default session', () => {
        expect(validateRisk(DEFAULT_RISK, 100)).toBeNull();
    });
    it.each([
        { stake: NaN },
        { multiplier: Infinity },
        { stake: 0 },
        { stake: 0.351 },
        { stopLoss: -1 },
        { maxStake: 500 },
        { maxSteps: 1.1 },
        { maxTrades: 0 },
    ])('rejects unsafe settings %j', overrides => {
        expect(validateRisk({ ...DEFAULT_RISK, ...overrides }, 100)).not.toBeNull();
    });
    it('rejects an unverified balance', () => {
        expect(validateRisk(DEFAULT_RISK, NaN)).not.toBeNull();
    });
    it('limits the entire next stake rather than waiting for realized loss', () => {
        expect(canExpose(1, -4, 5, 4)).toBe(true);
        expect(canExpose(1.01, -4, 5, 4)).toBe(false);
    });
    it('enforces cumulative losing-stake exposure even after wins', () => {
        expect(canExpose(1, 5, 5, 4.5)).toBe(false);
    });
    it('bounds recovery and rounds up to currency precision', () => {
        const risk = { ...DEFAULT_RISK, multiplier: 1.5, maxSteps: 2 };
        expect(nextStake(risk, 1)).toBe(0.53);
        expect(nextStake(risk, 2)).toBe(0.79);
        expect(() => nextStake(risk, 3)).toThrow('steps');
        expect(() => nextStake({ ...risk, maxStake: 0.5 }, 1)).toThrow('stake');
    });
});
