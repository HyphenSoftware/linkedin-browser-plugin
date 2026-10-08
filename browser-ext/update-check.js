// Only published releases count: drafts and prereleases never show up here.
const LATEST_RELEASE_URL = 'https://api.github.com/repos/HyphenSoftware/linkedin-browser-plugin/releases/latest';
// Unauthenticated GitHub API calls are capped at 60 an hour per IP, shared by everyone in the office.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const CACHE_KEY = 'latestRelease';

/**
 * Compare two `major.minor.patch` versions, ignoring a leading `v`
 * @returns {number} negative when a is older than b, 0 when equal, positive when newer
 */
export const compareVersions = (a, b) => {
    const parse = (version) =>
        String(version)
            .replace(/^v/, '')
            .split('.')
            .map((part) => parseInt(part, 10) || 0);
    const [left, right] = [parse(a), parse(b)];
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
        const diff = (left[i] || 0) - (right[i] || 0);
        if (diff !== 0) {
            return diff;
        }
    }
    return 0;
};

/** @returns {Promise<{version: string, url: string} | null>} */
const getLatestRelease = async (now) => {
    const { [CACHE_KEY]: cached } = await chrome.storage.local.get(CACHE_KEY);
    if (cached && now - cached.checkedAt < CHECK_INTERVAL_MS) {
        return cached.release;
    }
    const response = await fetch(LATEST_RELEASE_URL, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) {
        return null;
    }
    const { tag_name: tagName, html_url: pageUrl, assets = [] } = await response.json();
    const zip = assets.find((asset) => asset.name.endsWith('.zip'));
    const release = { version: tagName.replace(/^v/, ''), url: zip ? zip.browser_download_url : pageUrl };
    await chrome.storage.local.set({ [CACHE_KEY]: { checkedAt: now, release } });
    return release;
};

/**
 * Look up the latest published release on GitHub. Failures are swallowed, since the plugin works
 * fine without knowing about updates.
 * @param {string} currentVersion
 * @returns {Promise<{version: string, url: string} | null>} the release, when it is newer than ours
 */
export const checkForUpdate = async (currentVersion, now = Date.now()) => {
    try {
        const release = await getLatestRelease(now);
        return release && compareVersions(release.version, currentVersion) > 0 ? release : null;
    } catch (error) {
        console.warn('Update check failed', error);
        return null;
    }
};

/**
 * @param {Document} doc
 * @param {{version: string, url: string} | null} update
 */
export const showUpdate = (doc, update) => {
    doc.getElementById('updateBanner').classList.toggle('hidden', !update);
    if (update) {
        doc.getElementById('updateVersion').textContent = update.version;
        doc.getElementById('updateLink').href = update.url;
    }
};
