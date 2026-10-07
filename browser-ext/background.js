// eslint-disable-next-line import/extensions
import { getAccessToken, getAccount, getEnvironment, signOut } from './auth.js';

/**
 * === Handle Toggling of Button Action based on domain match ===
 * This is only necessary because we are using  `page_action` instead of `browser_action`
 */
chrome.runtime.onInstalled.addListener(() => {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
        chrome.declarativeContent.onPageChanged.addRules([
            {
                conditions: [
                    new chrome.declarativeContent.PageStateMatcher({
                        pageUrl: {
                            hostContains: 'linkedin.com'
                        }
                    })
                ],
                actions: [new chrome.declarativeContent.ShowAction()]
            }
        ]);
    });
});

// Extension API calls reset the worker's 30 s idle timer, so this keeps it alive during a long import
const KEEP_ALIVE_INTERVAL_MS = 25 * 1000;

/**
 * @returns {Promise<{status: number, body: any} | {error: string}>}
 */
export async function callApi(environmentName, path, body, { interactive }) {
    try {
        const env = await getEnvironment(environmentName);
        const token = await getAccessToken(env, { interactive });
        const response = await fetch(`${env.apiBaseUrl}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body)
        });
        return { status: response.status, body: await response.json() };
    } catch (error) {
        return { error: `Network error: ${error.message}` };
    }
}

const showInTab = (tabId, message) =>
    chrome.scripting.executeScript({ target: { tabId }, func: (text) => alert(text), args: [message] }).catch((error) => console.error('Could not show the import result', error));

export async function runImport({ environment, tabId, entity, mode, resume }) {
    const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo(), KEEP_ALIVE_INTERVAL_MS);
    let result;
    try {
        result = await callApi(environment, '/api/linkedin/profiles/import', { entity, mode, resume }, { interactive: true });
    } finally {
        clearInterval(keepAlive);
    }
    const message = result.error || result.body?.message || `Import failed (HTTP ${result.status})`;
    await showInTab(tabId, message);
    // The popup may be closed by now; then nobody receives this
    chrome.runtime.sendMessage({ key: 'importResult', value: result }).catch(() => {});
    return result;
}

async function accountFor(environment) {
    return { account: await getAccount(await getEnvironment(environment)) };
}

const handlers = {
    account: (message) => accountFor(message.environment),
    signIn: async (message) => {
        await getAccessToken(await getEnvironment(message.environment), { interactive: true });
        return accountFor(message.environment);
    },
    signOut: async (message) => {
        await signOut(await getEnvironment(message.environment));
        return { account: null };
    },
    lookup: (message) => callApi(message.environment, '/api/linkedin/profiles/lookup', message.identity, { interactive: false }),
    import: async (message) => {
        runImport(message);
        return { accepted: true };
    }
};

export async function handleMessage(message) {
    const handler = Object.prototype.hasOwnProperty.call(handlers, message.type) ? handlers[message.type] : null;
    return handler ? handler(message) : { error: `Unknown message type ${message.type}` };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !message?.type) {
        return false;
    }
    handleMessage(message)
        .then(sendResponse)
        .catch((error) => sendResponse({ error: error.message }));
    return true;
});
