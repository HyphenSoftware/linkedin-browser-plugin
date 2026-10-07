/* eslint-disable camelcase -- OAuth 2.0 parameter names are snake_case */
/**
 * Entra sign-in for the service worker: authorization code + PKCE through chrome.identity, tokens
 * per environment in chrome.storage.session (cleared when the browser closes).
 */

const EXPIRY_MARGIN_MS = 60 * 1000;

/**
 * @typedef {Object} Environment
 * @property {string} name
 * @property {string} apiBaseUrl
 * @property {string} tenantId
 * @property {string} clientId
 * @property {string} scope
 */

/** @returns {Promise<Environment[]>} */
export async function loadEnvironments() {
    const response = await fetch(chrome.runtime.getURL('environments.json'));
    return response.json();
}

/** @returns {Promise<Environment>} */
export async function getEnvironment(name) {
    const environment = (await loadEnvironments()).find((env) => env.name === name);
    if (!environment) {
        throw new Error(`Unknown environment ${name}`);
    }
    return environment;
}

export function base64Url(bytes) {
    return btoa(String.fromCharCode(...new Uint8Array(bytes)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

const randomString = () => base64Url(crypto.getRandomValues(new Uint8Array(32)));

export async function createPkce() {
    const verifier = randomString();
    const challenge = base64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    return { verifier, challenge };
}

export function decodeJwtPayload(token) {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = new TextDecoder().decode(Uint8Array.from(atob(payload), (c) => c.charCodeAt(0)));
    return JSON.parse(json);
}

const storageKey = (env) => `tokens:${env.name}`;
const authority = (env) => `https://login.microsoftonline.com/${env.tenantId}/oauth2/v2.0`;
const scopes = (env) => `${env.scope} openid profile offline_access`;

async function readTokens(env) {
    const key = storageKey(env);
    return (await chrome.storage.session.get(key))[key] || null;
}

async function requestTokens(env, params, previous) {
    const response = await fetch(`${authority(env)}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: env.clientId, scope: scopes(env), ...params }).toString()
    });
    const body = await response.json();
    if (!response.ok) {
        throw new Error(`${body.error}: ${body.error_description}`);
    }
    const tokens = {
        accessToken: body.access_token,
        refreshToken: body.refresh_token || previous?.refreshToken,
        expiresAt: Date.now() + body.expires_in * 1000,
        account: body.id_token ? decodeJwtPayload(body.id_token) : previous?.account || null
    };
    await chrome.storage.session.set({ [storageKey(env)]: tokens });
    return tokens;
}

async function authorize(env, interactive) {
    const { verifier, challenge } = await createPkce();
    const state = randomString();
    const redirectUri = chrome.identity.getRedirectURL();
    const query = new URLSearchParams({
        client_id: env.clientId,
        response_type: 'code',
        response_mode: 'query',
        redirect_uri: redirectUri,
        scope: scopes(env),
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        ...(interactive ? {} : { prompt: 'none' })
    });
    const resultUrl = await chrome.identity.launchWebAuthFlow({
        url: `${authority(env)}/authorize?${query}`,
        interactive,
        // Entra's silent sign-in redirects through a few pages before it returns the code
        abortOnLoadForNonInteractive: false,
        timeoutMsForNonInteractive: 10000
    });
    const result = new URLSearchParams(resultUrl.split('?')[1] || '');
    if (result.get('error')) {
        throw new Error(`${result.get('error')}: ${result.get('error_description')}`);
    }
    if (result.get('state') !== state) {
        throw new Error('Sign-in state mismatch');
    }
    return requestTokens(env, { grant_type: 'authorization_code', code: result.get('code'), redirect_uri: redirectUri, code_verifier: verifier });
}

/**
 * A valid access token: cached, refreshed, or from a silent sign-in. Only shows the Microsoft
 * sign-in window when `interactive` is set and nothing silent worked.
 * @param {Environment} env
 */
export async function getAccessToken(env, { interactive }) {
    const cached = await readTokens(env);
    if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
        return cached.accessToken;
    }
    if (cached?.refreshToken) {
        try {
            return (await requestTokens(env, { grant_type: 'refresh_token', refresh_token: cached.refreshToken }, cached)).accessToken;
        } catch (error) {
            console.warn('Token refresh failed', error);
        }
    }
    try {
        return (await authorize(env, false)).accessToken;
    } catch (error) {
        if (!interactive) {
            throw error;
        }
    }
    return (await authorize(env, true)).accessToken;
}

/** The signed-in user's ID token claims, or null. */
export async function getAccount(env) {
    return (await readTokens(env))?.account || null;
}

export async function signOut(env) {
    await chrome.storage.session.remove(storageKey(env));
}
