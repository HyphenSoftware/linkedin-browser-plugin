// Jest setup file for browser environment simulation
import '@testing-library/jest-dom';

// Mock Chrome extension APIs
global.chrome = {
    runtime: {
        id: 'test-extension-id',
        getURL: (path: string) => `chrome-extension://test-extension-id/${path}`,
        onMessage: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
            hasListener: jest.fn()
        },
        onInstalled: {
            addListener: jest.fn()
        },
        sendMessage: jest.fn(() => Promise.resolve()),
        getPlatformInfo: jest.fn(() => Promise.resolve({}))
    },
    identity: {
        getRedirectURL: jest.fn(() => 'https://test-extension-id.chromiumapp.org/'),
        launchWebAuthFlow: jest.fn()
    },
    tabs: {
        query: jest.fn(),
        executeScript: jest.fn()
    },
    scripting: {
        executeScript: jest.fn()
    },
    storage: {
        sync: {
            get: jest.fn(),
            set: jest.fn()
        },
        session: {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn()
        },
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    },
    declarativeContent: {
        onPageChanged: {
            removeRules: jest.fn(),
            addRules: jest.fn()
        },
        PageStateMatcher: jest.fn(),
        ShowAction: jest.fn()
    }
} as any;

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock DOM methods that might be used
Object.defineProperty(document, 'cookie', {
    writable: true,
    value: 'JSESSIONID="test-session-id"; other=value'
});

// Mock URL for testing
global.URL = class URL {
    href: string;

    search: string;

    pathname: string;

    origin: string;

    searchParams: URLSearchParams;

    constructor(url: string) {
        this.href = url;
        const urlParts = url.split('?');
        const baseUrl = urlParts[0] || '';
        const queryString = urlParts[1] || '';

        this.search = queryString ? `?${queryString}` : '';
        this.pathname = baseUrl.split('/').slice(3).join('/') || '/';
        this.origin = baseUrl.split('/').slice(0, 3).join('/');
        this.searchParams = new URLSearchParams(queryString);
    }

    toString() {
        return this.href;
    }
} as any;

// Mock console methods to avoid noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};
