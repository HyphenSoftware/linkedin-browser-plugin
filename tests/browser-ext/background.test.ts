import { getAccessToken, getAccount, getEnvironment, signOut } from '../../browser-ext/auth';
import { callApi, handleMessage, runImport } from '../../browser-ext/background';

jest.mock('../../browser-ext/auth');

const env = { name: 'DEV', apiBaseUrl: 'https://api.test', tenantId: 't', clientId: 'c', scope: 's' };
const fetchMock = jest.mocked(fetch);
const response = (status: number, body: object) => ({ status, json: async () => body }) as Response;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getEnvironment).mockResolvedValue(env);
    jest.mocked(getAccessToken).mockResolvedValue('token-1');
    jest.mocked(chrome.scripting.executeScript).mockResolvedValue([] as never);
});

describe('callApi', () => {
    it('posts JSON with the bearer token', async () => {
        fetchMock.mockResolvedValueOnce(response(200, { ok: true }));

        expect(await callApi('DEV', '/api/x', { a: 1 }, { interactive: false })).toEqual({ status: 200, body: { ok: true } });
        expect(getAccessToken).toHaveBeenCalledWith(env, { interactive: false });
        expect(fetchMock).toHaveBeenCalledWith('https://api.test/api/x', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-1' },
            body: '{"a":1}'
        });
    });

    it('turns failures into a network error', async () => {
        jest.mocked(getAccessToken).mockRejectedValueOnce(new Error('interaction_required'));

        expect(await callApi('DEV', '/api/x', {}, { interactive: false })).toEqual({ error: 'Network error: interaction_required' });
    });
});

describe('handleMessage', () => {
    it('looks a profile up without prompting for sign-in', async () => {
        fetchMock.mockResolvedValueOnce(response(200, { subcontractor: {}, contact: {} }));
        const identity = { url: 'https://www.linkedin.com/in/jane', urn: 'ACoAAB1', name: 'Jane' };

        const result = await handleMessage({ type: 'lookup', environment: 'DEV', identity });

        expect(result).toEqual({ status: 200, body: { subcontractor: {}, contact: {} } });
        expect(getAccessToken).toHaveBeenCalledWith(env, { interactive: false });
        expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/api/linkedin/profiles/lookup');
        expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(identity);
    });

    it('signs in interactively and returns the account', async () => {
        jest.mocked(getAccount).mockResolvedValue({ name: 'Jane' });

        expect(await handleMessage({ type: 'signIn', environment: 'DEV' })).toEqual({ account: { name: 'Jane' } });
        expect(getAccessToken).toHaveBeenCalledWith(env, { interactive: true });
    });

    it('signs out', async () => {
        expect(await handleMessage({ type: 'signOut', environment: 'DEV' })).toEqual({ account: null });
        expect(signOut).toHaveBeenCalledWith(env);
    });

    it('accepts an import at once and finishes it in the background', async () => {
        fetchMock.mockResolvedValueOnce(response(200, { outcome: 'created', message: 'Created new Contact Jane!' }));

        const reply = await handleMessage({ type: 'import', environment: 'DEV', tabId: 7, entity: 'contact', mode: 'auto', resume: { basics: {} } });
        await flush();

        expect(reply).toEqual({ accepted: true });
        expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ entity: 'contact', mode: 'auto', resume: { basics: {} } });
        expect(chrome.scripting.executeScript).toHaveBeenCalledWith(expect.objectContaining({ target: { tabId: 7 }, args: ['Created new Contact Jane!'] }));
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ key: 'importResult', value: { status: 200, body: expect.any(Object) } });
    });

    it('rejects unknown message types', async () => {
        expect(await handleMessage({ type: 'nope' })).toEqual({ error: 'Unknown message type nope' });
    });
});

describe('runImport', () => {
    afterEach(() => jest.useRealTimers());

    it('keeps the worker alive while the import runs', async () => {
        jest.useFakeTimers();
        let answer: (value: Response) => void;
        fetchMock.mockReturnValueOnce(
            new Promise((resolve) => {
                answer = resolve;
            })
        );

        const done = runImport({ environment: 'DEV', tabId: 7, entity: 'subcontractor', mode: 'auto', resume: {} });
        await jest.advanceTimersByTimeAsync(60 * 1000);
        expect(chrome.runtime.getPlatformInfo).toHaveBeenCalledTimes(2);

        answer(response(500, { outcome: 'error', message: 'Error while processing LinkedIn profile (AxiosError)!' }));
        await done;
        await jest.advanceTimersByTimeAsync(60 * 1000);

        expect(chrome.runtime.getPlatformInfo).toHaveBeenCalledTimes(2);
        expect(chrome.scripting.executeScript).toHaveBeenCalledWith(expect.objectContaining({ args: ['Error while processing LinkedIn profile (AxiosError)!'] }));
    });

    it('shows the network error in the tab', async () => {
        fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'));

        await runImport({ environment: 'DEV', tabId: 7, entity: 'contact', mode: 'create', resume: {} });

        expect(chrome.scripting.executeScript).toHaveBeenCalledWith(expect.objectContaining({ args: ['Network error: Failed to fetch'] }));
    });
});

describe('message listener', () => {
    const listener = jest.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0] as any;

    it('ignores other senders', () => {
        expect(listener({ type: 'account' }, { id: 'other-extension' }, jest.fn())).toBe(false);
    });

    it('answers asynchronously', async () => {
        jest.mocked(getAccount).mockResolvedValue(null);
        const sendResponse = jest.fn();

        expect(listener({ type: 'account', environment: 'DEV' }, { id: chrome.runtime.id }, sendResponse)).toBe(true);
        await flush();

        expect(sendResponse).toHaveBeenCalledWith({ account: null });
    });
});
