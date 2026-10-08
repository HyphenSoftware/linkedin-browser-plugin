/* eslint-disable camelcase -- GitHub API fields are snake_case */
import { readFileSync } from 'fs';
import { join } from 'path';
import { checkForUpdate, compareVersions, showUpdate } from '../../browser-ext/update-check';

const HOUR = 60 * 60 * 1000;
const NOW = 1_000_000_000_000;

let local: Record<string, any>;
const fetchMock = jest.mocked(fetch);

const releaseResponse = (body: object, ok = true) => ({ ok, json: async () => body }) as Response;
const release = (tag: string) => ({
    tag_name: tag,
    html_url: `https://github.com/HyphenSoftware/linkedin-browser-plugin/releases/tag/${tag}`,
    assets: [{ name: `build_${tag.slice(1)}.zip`, browser_download_url: `https://github.com/download/build_${tag.slice(1)}.zip` }]
});

beforeEach(() => {
    jest.clearAllMocks();
    local = {};
    (chrome.storage.local.get as jest.Mock).mockImplementation(async (key: string) => (key in local ? { [key]: local[key] } : {}));
    (chrome.storage.local.set as jest.Mock).mockImplementation(async (items: object) => {
        Object.assign(local, items);
    });
});

describe('compareVersions', () => {
    it.each([
        ['2.1.0', '2.0.0', 1],
        ['2.0.0', '2.0.0', 0],
        ['v2.0.10', '2.0.9', 1],
        ['1.9.9', '2.0.0', -1],
        ['2.1', '2.1.0', 0]
    ])('compares %s with %s', (a, b, sign) => {
        expect(Math.sign(compareVersions(a, b))).toBe(sign);
    });
});

describe('checkForUpdate', () => {
    it('offers the zip of a newer release', async () => {
        fetchMock.mockResolvedValue(releaseResponse(release('v2.1.0')));

        expect(await checkForUpdate('2.0.0', NOW)).toEqual({ version: '2.1.0', url: 'https://github.com/download/build_2.1.0.zip' });
    });

    it('links the release page when it has no zip', async () => {
        fetchMock.mockResolvedValue(releaseResponse({ ...release('v2.1.0'), assets: [] }));

        expect((await checkForUpdate('2.0.0', NOW))?.url).toBe('https://github.com/HyphenSoftware/linkedin-browser-plugin/releases/tag/v2.1.0');
    });

    it.each(['v2.0.0', 'v1.2.2'])('stays quiet when the latest release is %s', async (tag) => {
        fetchMock.mockResolvedValue(releaseResponse(release(tag)));

        expect(await checkForUpdate('2.0.0', NOW)).toBeNull();
    });

    it('stays quiet when GitHub fails', async () => {
        fetchMock.mockResolvedValueOnce(releaseResponse({ message: 'API rate limit exceeded' }, false));
        expect(await checkForUpdate('2.0.0', NOW)).toBeNull();

        fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        expect(await checkForUpdate('2.0.0', NOW)).toBeNull();
    });

    it('asks GitHub at most once an hour', async () => {
        fetchMock.mockResolvedValue(releaseResponse(release('v2.1.0')));

        await checkForUpdate('2.0.0', NOW);
        expect((await checkForUpdate('2.0.0', NOW + HOUR - 1))?.version).toBe('2.1.0');
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await checkForUpdate('2.0.0', NOW + HOUR);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('stops offering the update once it is installed', async () => {
        fetchMock.mockResolvedValue(releaseResponse(release('v2.1.0')));

        await checkForUpdate('2.0.0', NOW);
        expect(await checkForUpdate('2.1.0', NOW)).toBeNull();
    });
});

describe('update banner', () => {
    beforeEach(() => {
        const extDir = join(__dirname, '../../browser-ext');
        document.documentElement.innerHTML = readFileSync(join(extDir, 'popup.html'), 'utf8').replace(/^[\s\S]*?<html[^>]*>|<\/html>[\s\S]*$/g, '');
    });

    const banner = () => document.getElementById('updateBanner');

    it('starts hidden', () => {
        expect(banner()).toHaveClass('hidden');
    });

    it('shows the new version and its download link', () => {
        showUpdate(document, { version: '2.1.0', url: 'https://github.com/download/build_2.1.0.zip' });

        expect(banner()).not.toHaveClass('hidden');
        expect(document.getElementById('updateVersion')).toHaveTextContent('2.1.0');
        expect(document.getElementById('updateLink')).toHaveAttribute('href', 'https://github.com/download/build_2.1.0.zip');
    });

    it('stays hidden without an update', () => {
        showUpdate(document, null);

        expect(banner()).toHaveClass('hidden');
    });
});
