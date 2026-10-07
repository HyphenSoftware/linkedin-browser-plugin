import { LinkedinToResumeJsonCompat } from '../../src/core/legacy-compat-wrapper';
import { LinkedInExtractor } from '../../src/core/linkedin-extractor';

jest.mock('../../src/core/linkedin-extractor');

const extractor = () => jest.mocked(LinkedInExtractor).mock.instances[0] as jest.Mocked<LinkedInExtractor>;

const createWrapper = () => {
    const wrapper = new LinkedinToResumeJsonCompat();
    wrapper.debugConsole = { log: jest.fn() } as unknown as Console;
    return wrapper;
};

beforeEach(() => jest.clearAllMocks());

describe('extractForApi', () => {
    const result = { success: true, summary: { ok: true }, locale: 'en_US', profileUrnId: 'urn-1', stable: { basics: { name: 'Stable' } }, legacy: { basics: { name: 'Legacy' } } };

    it.each([
        ['stable', 'Stable'],
        ['legacy', 'Legacy']
    ] as const)('returns the %s JSON Resume', async (version, name) => {
        const wrapper = createWrapper();
        extractor().extractProfile.mockResolvedValue(result as never);

        expect(await wrapper.extractForApi(version)).toEqual({ basics: { name } });
        expect(wrapper.parseSuccess).toBe(true);
        expect(wrapper.profileUrnId).toBe('urn-1');
    });

    it('throws when the extraction fails', async () => {
        const wrapper = createWrapper();
        extractor().extractProfile.mockResolvedValue({ success: false, error: 'No profile' } as never);

        await expect(wrapper.extractForApi()).rejects.toThrow('No profile');
        expect(wrapper.parseSuccess).toBe(false);
    });
});

describe('getIdentityForApi', () => {
    it('returns the page URL without query, the URN and the name', async () => {
        window.history.pushState({}, '', '/in/jane-doe/?miniProfileUrn=x');
        const wrapper = createWrapper();
        extractor().resolveIdentity.mockResolvedValue({ urn: 'ACoAAB1', name: 'Jane Doe' });

        expect(await wrapper.getIdentityForApi()).toEqual({ url: 'http://localhost/in/jane-doe/', urn: 'ACoAAB1', name: 'Jane Doe' });
    });
});
