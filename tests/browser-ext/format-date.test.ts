import { formatDate } from '../../browser-ext/format-date';

describe('formatDate', () => {
    it.each([
        ['2026-03-12', '12 Mar 2026'],
        ['2026-03-12T12:22:05Z', '12 Mar 2026'],
        ['2026-04-02T09:10:00.000+02:00', '2 Apr 2026']
    ])('formats %s', (value, expected) => {
        expect(formatDate(value)).toBe(expected);
    });

    it('leaves values that are not dates alone', () => {
        expect(formatDate('last week')).toBe('last week');
    });
});
