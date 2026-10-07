/* eslint-disable camelcase -- OAuth 2.0 parameter names are snake_case */
import { createHash, webcrypto } from 'crypto';
import { TextDecoder, TextEncoder } from 'util';
import { base64Url, createPkce, decodeJwtPayload, getAccessToken, getAccount, signOut } from '../../browser-ext/auth';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
Object.assign(globalThis, { TextEncoder, TextDecoder });

const env = {
    name: 'DEV',
    apiBaseUrl: 'https://api.test',
    tenantId: 'tenant-1',
    clientId: 'client-1',
    scope: 'api://tenant-1/linkedin-importer-dev/LinkedIn.Import'
};

const toBase64Url = (value: string) => Buffer.from(value).toString('base64url');
const idToken = (claims: object) => `header.${toBase64Url(JSON.stringify(claims))}.signature`;

let session: Record<string, any>;
const fetchMock = jest.mocked(fetch);
const launchWebAuthFlow = chrome.identity.launchWebAuthFlow as unknown as jest.Mock;

const tokenResponse = (body: object, ok = true) => ({ ok, json: async () => body }) as Response;

/** Answers the authorize request like Entra would, echoing the state. */
const redirectWithCode = (code = 'code-1') =>
    launchWebAuthFlow.mockImplementation(async ({ url }: { url: string }) => {
        const state = new URLSearchParams(url.split('?')[1]).get('state');
        return `https://test-extension-id.chromiumapp.org/?code=${code}&state=${state}`;
    });

beforeEach(() => {
    jest.clearAllMocks();
    session = {};
    (chrome.storage.session.get as jest.Mock).mockImplementation(async (key: string) => (key in session ? { [key]: session[key] } : {}));
    (chrome.storage.session.set as jest.Mock).mockImplementation(async (items: object) => {
        Object.assign(session, items);
    });
    (chrome.storage.session.remove as jest.Mock).mockImplementation(async (key: string) => {
        delete session[key];
    });
});

describe('PKCE and JWT helpers', () => {
    it('derives the S256 challenge from the verifier', async () => {
        const { verifier, challenge } = await createPkce();

        expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
    });

    it('encodes base64url without padding', () => {
        expect(base64Url(new Uint8Array([251, 255]))).toBe('-_8');
    });

    it('decodes a UTF-8 payload', () => {
        expect(decodeJwtPayload(idToken({ name: 'Zoë Müller' }))).toEqual({ name: 'Zoë Müller' });
    });
});

describe('getAccessToken', () => {
    it('returns a cached token that is still valid', async () => {
        session['tokens:DEV'] = { accessToken: 'cached', expiresAt: Date.now() + 10 * 60 * 1000 };

        expect(await getAccessToken(env, { interactive: false })).toBe('cached');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refreshes an expired token and keeps the account', async () => {
        session['tokens:DEV'] = { accessToken: 'old', refreshToken: 'refresh-1', expiresAt: Date.now(), account: { name: 'Jane' } };
        fetchMock.mockResolvedValueOnce(tokenResponse({ access_token: 'new', refresh_token: 'refresh-2', expires_in: 3600 }));

        expect(await getAccessToken(env, { interactive: false })).toBe('new');
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token');
        expect(Object.fromEntries(new URLSearchParams(init.body as string))).toEqual({
            client_id: 'client-1',
            scope: `${env.scope} openid profile offline_access`,
            grant_type: 'refresh_token',
            refresh_token: 'refresh-1'
        });
        expect(session['tokens:DEV']).toMatchObject({ accessToken: 'new', refreshToken: 'refresh-2', account: { name: 'Jane' } });
        expect(launchWebAuthFlow).not.toHaveBeenCalled();
    });

    it('signs in silently with PKCE when there is no token', async () => {
        redirectWithCode();
        fetchMock.mockResolvedValueOnce(tokenResponse({ access_token: 'fresh', refresh_token: 'r', expires_in: 3600, id_token: idToken({ name: 'Jane', oid: 'oid-1' }) }));

        expect(await getAccessToken(env, { interactive: false })).toBe('fresh');

        const { url, interactive } = launchWebAuthFlow.mock.calls[0][0];
        expect(interactive).toBe(false);
        expect(url.split('?')[0]).toBe('https://login.microsoftonline.com/tenant-1/oauth2/v2.0/authorize');
        const query = Object.fromEntries(new URLSearchParams(url.split('?')[1]));
        expect(query).toMatchObject({
            client_id: 'client-1',
            response_type: 'code',
            redirect_uri: 'https://test-extension-id.chromiumapp.org/',
            code_challenge_method: 'S256',
            prompt: 'none'
        });
        const body = Object.fromEntries(new URLSearchParams(fetchMock.mock.calls[0][1].body as string));
        expect(body).toMatchObject({ grant_type: 'authorization_code', code: 'code-1', redirect_uri: 'https://test-extension-id.chromiumapp.org/' });
        expect(createHash('sha256').update(body.code_verifier).digest('base64url')).toBe(query.code_challenge);
        expect(await getAccount(env)).toEqual({ name: 'Jane', oid: 'oid-1' });
    });

    it('falls back to the interactive sign-in when allowed', async () => {
        launchWebAuthFlow.mockRejectedValueOnce(new Error('interaction_required'));
        redirectWithCode();
        fetchMock.mockResolvedValueOnce(tokenResponse({ access_token: 'fresh', expires_in: 3600 }));

        expect(await getAccessToken(env, { interactive: true })).toBe('fresh');
        expect(launchWebAuthFlow.mock.calls.map(([options]) => options.interactive)).toEqual([false, true]);
        expect(launchWebAuthFlow.mock.calls[1][0].url).not.toContain('prompt=none');
    });

    it('fails without a prompt when not interactive', async () => {
        launchWebAuthFlow.mockRejectedValue(new Error('interaction_required'));

        await expect(getAccessToken(env, { interactive: false })).rejects.toThrow('interaction_required');
        expect(launchWebAuthFlow).toHaveBeenCalledTimes(1);
    });

    it('rejects a redirect with a foreign state', async () => {
        launchWebAuthFlow.mockResolvedValue('https://test-extension-id.chromiumapp.org/?code=c&state=forged');

        await expect(getAccessToken(env, { interactive: false })).rejects.toThrow('state mismatch');
    });

    it("surfaces Entra's error from the token endpoint", async () => {
        redirectWithCode();
        fetchMock.mockResolvedValueOnce(tokenResponse({ error: 'invalid_grant', error_description: 'AADSTS9002326' }, false));

        await expect(getAccessToken(env, { interactive: false })).rejects.toThrow('invalid_grant: AADSTS9002326');
    });
});

describe('signOut', () => {
    it('forgets the tokens of the environment', async () => {
        session['tokens:DEV'] = { accessToken: 'x', account: { name: 'Jane' } };

        await signOut(env);

        expect(await getAccount(env)).toBeNull();
    });
});
