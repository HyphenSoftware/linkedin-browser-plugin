/* eslint-disable camelcase -- Entra token claims are snake_case */
import { readFileSync } from 'fs';
import { join } from 'path';
import { showAccount } from '../../browser-ext/account-view';

const extDir = join(__dirname, '../../browser-ext');

const loadPopup = () => {
    const html = readFileSync(join(extDir, 'popup.html'), 'utf8');
    const css = readFileSync(join(extDir, 'styles.css'), 'utf8');
    document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>|<\/html>[\s\S]*$/g, '');
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
};

const isVisible = (element: Element | null): boolean => {
    if (!element || element === document.documentElement) {
        return true;
    }
    return getComputedStyle(element).display !== 'none' && isVisible(element.parentElement);
};

const byId = (id: string) => document.getElementById(id);

const API_ONLY = ['debugCheckButton', 'liToSubcontractor', 'liToContact', 'subcontractorStatus', 'contactStatus'];
const ALWAYS = ['liToJsonButton', 'liToJsonDownloadButton', 'apiSelect'];

describe('popup account view', () => {
    beforeEach(loadPopup);

    it('starts signed out, before the background worker has answered', () => {
        API_ONLY.forEach((id) => expect(isVisible(byId(id))).toBe(false));
        ALWAYS.forEach((id) => expect(isVisible(byId(id))).toBe(true));
    });

    it('hides everything that needs the API while nobody is signed in', () => {
        showAccount(document, null);

        expect(byId('accountStatus')?.textContent).toBe('Not signed in');
        expect(isVisible(byId('signInButton'))).toBe(true);
        expect(isVisible(byId('signOutButton'))).toBe(false);
        API_ONLY.forEach((id) => expect(isVisible(byId(id))).toBe(false));
        ALWAYS.forEach((id) => expect(isVisible(byId(id))).toBe(true));
    });

    it('shows the API controls and the account once signed in', () => {
        showAccount(document, { name: 'Jane Doe', preferred_username: 'jane@hyphen.group' });

        expect(byId('accountStatus')?.textContent).toBe('Signed in as Jane Doe');
        expect(isVisible(byId('signInButton'))).toBe(false);
        expect(isVisible(document.querySelector('.signedOutOnly'))).toBe(false);
        expect(isVisible(byId('signOutButton'))).toBe(true);
        [...API_ONLY, ...ALWAYS].forEach((id) => expect(isVisible(byId(id))).toBe(true));
    });

    it('falls back to the username when the token has no name', () => {
        showAccount(document, { preferred_username: 'jane@hyphen.group' });

        expect(byId('accountStatus')?.textContent).toBe('Signed in as jane@hyphen.group');
    });

    it('hides the API controls again after signing out', () => {
        showAccount(document, { name: 'Jane Doe' });
        showAccount(document, null);

        API_ONLY.forEach((id) => expect(isVisible(byId(id))).toBe(false));
    });
});
