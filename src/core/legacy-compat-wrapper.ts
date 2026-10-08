/**
 * Legacy Compatibility Wrapper
 *
 * Provides backward compatibility with the old LinkedinToResumeJson constructor function API.
 * This wrapper makes the new LinkedInExtractor class work exactly like the old API
 * so existing browser extension and bookmarklet code continues to work without changes.
 *
 * @deprecated This wrapper exists for backward compatibility only. New code should use LinkedInExtractor directly.
 */

import { LinkedInExtractor, ExtractorOptions } from './linkedin-extractor';

// Not the old dialog's id, so a dialog left in an open tab by an older version is never reused
const MODAL_HOST_ID = 'liToResumeJson_exportDialog';

const MODAL_STYLES = `
    :host {
        all: initial;
    }
    .backdrop {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        box-sizing: border-box;
        background: rgba(0, 0, 0, 0.6);
        color: #000000;
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        font-size: 14px;
    }
    .dialog {
        width: min(880px, 100%);
        max-height: 100%;
        display: flex;
        flex-direction: column;
        background: #ffffff;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
    }
    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 20px;
        border-bottom: 1px solid #dcdcd9;
    }
    .heading {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .eyebrow {
        font-size: 11px;
        line-height: 1;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #565652;
    }
    h2 {
        margin: 0;
        font-size: 22px;
        line-height: 1;
        font-weight: 400;
        letter-spacing: -0.005em;
    }
    .actions {
        display: flex;
        gap: 8px;
    }
    button {
        height: 40px;
        border: 1px solid #000000;
        border-radius: 2px;
        font: inherit;
        font-weight: 500;
        cursor: pointer;
    }
    .copy {
        min-width: 88px;
        padding: 0 18px;
        background: #000000;
        color: #ffffff;
    }
    .copy:hover {
        background: #3a3a37;
    }
    .close {
        width: 40px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-color: #bfbfba;
        background: #ffffff;
        color: #000000;
    }
    .close:hover {
        background: #f6f6f5;
    }
    button:focus-visible,
    textarea:focus-visible {
        outline: 2px solid #000000;
        outline-offset: 2px;
    }
    .body {
        display: flex;
        min-height: 0;
        padding: 20px;
    }
    textarea {
        flex-grow: 1;
        height: 60vh;
        min-height: 240px;
        box-sizing: border-box;
        padding: 14px;
        border: 1px solid #dcdcd9;
        border-radius: 0;
        background: #f6f6f5;
        color: #000000;
        font-family: ui-monospace, Menlo, Consolas, monospace;
        font-size: 12px;
        line-height: 1.5;
        resize: vertical;
    }
`;

/**
 * Legacy API wrapper class that mimics the old LinkedinToResumeJson constructor function
 */
export class LinkedinToResumeJsonCompat {
    private extractor: LinkedInExtractor;

    public profileId: string;

    public profileUrnId: string | null = null;

    public profileParseSummary: any = null;

    public lastScannedLocale: string | null = null;

    public preferLocale: string | null = null;

    public scannedPageUrl: string = '';

    public parseSuccess: boolean = false;

    public getFullSkills: boolean;

    public preferApi: boolean;

    public debug: boolean;

    public debugConsole: Console;

    public internals?: any;

    constructor(OPT_debug?: boolean, OPT_preferApi?: boolean, OPT_getFullSkills?: boolean) {
        // Convert old-style arguments to new options object
        const options: ExtractorOptions = {
            debug: typeof OPT_debug === 'boolean' ? OPT_debug : false,
            preferApi: typeof OPT_preferApi === 'boolean' ? OPT_preferApi : true,
            getFullSkills: typeof OPT_getFullSkills === 'boolean' ? OPT_getFullSkills : true
        };

        this.extractor = new LinkedInExtractor(options);

        // Copy properties for compatibility
        this.debug = options.debug ?? false;
        this.preferApi = options.preferApi ?? true;
        this.getFullSkills = options.getFullSkills ?? true;

        // Get profileId from extractor
        this.profileId = (this.extractor as any).profileId || '';

        // Set up debug console
        this.debugConsole = (this.extractor as any).debugConsole;

        if (this.debug) {
            console.warn('LinkedinToResumeJson - DEBUG mode is ON (using new LinkedInExtractor under the hood)');
        }
    }

    /**
     * Parse profile and download as JSON file
     */
    async parseAndDownload(version: 'legacy' | 'stable' = 'stable'): Promise<void> {
        try {
            const result = await this.extractor.extractProfile();

            if (result.success) {
                this.parseSuccess = true;
                this.profileParseSummary = result.summary;
                this.lastScannedLocale = result.locale;
                this.profileUrnId = result.profileUrnId || null;

                // Download using the extractor's method
                this.extractor.downloadProfile(version);
            } else {
                this.parseSuccess = false;
                throw new Error(result.error || 'Profile extraction failed');
            }
        } catch (error) {
            this.parseSuccess = false;
            console.error('Error in parseAndDownload:', error);
            throw error;
        }
    }

    /**
     * Parse the profile into the JSON Resume the import endpoint expects
     */
    async extractForApi(version: 'legacy' | 'stable' = 'stable'): Promise<any> {
        const result = await this.extractor.extractProfile();
        if (!result.success) {
            this.parseSuccess = false;
            throw new Error(result.error || 'Profile extraction failed');
        }
        this.parseSuccess = true;
        this.profileParseSummary = result.summary;
        this.lastScannedLocale = result.locale;
        this.profileUrnId = result.profileUrnId || null;
        return version === 'legacy' ? result.legacy : result.stable;
    }

    /**
     * Parse profile and show output in modal
     */
    async parseAndShowOutput(version: 'legacy' | 'stable' = 'stable'): Promise<any> {
        try {
            const result = await this.extractor.extractProfile();

            if (result.success) {
                this.parseSuccess = true;
                this.profileParseSummary = result.summary;
                this.lastScannedLocale = result.locale;
                this.profileUrnId = result.profileUrnId || null;

                // Get the appropriate JSON format
                const jsonData = version === 'legacy' ? result.legacy : result.stable;

                // Show the modal with the JSON data
                this.showModal(jsonData);
                return jsonData;
            }
            this.parseSuccess = false;
            throw new Error(result.error || 'Profile extraction failed');
        } catch (error) {
            this.parseSuccess = false;
            console.error('Error in parseAndShowOutput:', error);
            throw error;
        }
    }

    /**
     * Get profile ID from current URL
     */
    getProfileId(): string {
        return (this.extractor as any).getProfileId();
    }

    /**
     * Get viewer's local language
     */
    getViewersLocalLang(): string {
        return (this.extractor as any).getViewersLocalLang();
    }

    /**
     * Get supported locales
     */
    async getSupportedLocales(): Promise<string[]> {
        // Return a static list of supported locales
        // The new implementation doesn't have dynamic locale discovery
        return ['en_US', 'es_ES', 'pt_BR', 'fr_FR', 'de_DE', 'it_IT', 'nl_NL', 'pl_PL', 'ru_RU', 'ja_JP', 'ko_KR', 'zh_CN', 'zh_TW'];
    }

    /**
     * What the lookup endpoint matches on: the durable member URN first, then the URL, then the name
     */
    async getIdentityForApi(): Promise<{ url: string; urn: string | null; name: string | null }> {
        const url = window.location.href.split('?')[0];
        const { urn, name } = await this.extractor.resolveIdentity();
        this.debugConsole.log('Identity for API:', { url, urn, name });
        return { url, urn, name };
    }

    /**
     * Show the output modal with the results
     */
    showModal(jsonResume: any): void {
        const host = document.getElementById(MODAL_HOST_ID) ?? this.createModal();
        host.style.display = 'block';
        const root = host.shadowRoot as ShadowRoot;
        (root.querySelector('textarea') as HTMLTextAreaElement).value = JSON.stringify(jsonResume, null, 2);
        (root.querySelector('.copy') as HTMLButtonElement).textContent = 'Copy';
        (root.querySelector('.close') as HTMLButtonElement).focus();
    }

    /**
     * Close the modal
     */
    closeModal(): void {
        const host = document.getElementById(MODAL_HOST_ID);
        if (host) {
            host.style.display = 'none';
        }
    }

    // A shadow root keeps LinkedIn's CSS out of the dialog and ours out of the page
    private createModal(): HTMLElement {
        const host = document.createElement('div');
        host.id = MODAL_HOST_ID;
        const root = host.attachShadow({ mode: 'open' });
        root.innerHTML = `<style>${MODAL_STYLES}</style>
            <div class="backdrop">
                <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="title">
                    <header>
                        <div class="heading">
                            <span class="eyebrow">LinkedIn Importer</span>
                            <h2 id="title">JSON Resume export</h2>
                        </div>
                        <div class="actions">
                            <button type="button" class="copy">Copy</button>
                            <button type="button" class="close" aria-label="Close" title="Close">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true"><path d="M6 6l12 12"></path><path d="M18 6L6 18"></path></svg>
                            </button>
                        </div>
                    </header>
                    <div class="body">
                        <textarea spellcheck="false" aria-label="JSON Resume"></textarea>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(host);

        const textarea = root.querySelector('textarea') as HTMLTextAreaElement;
        const copyButton = root.querySelector('.copy') as HTMLButtonElement;
        root.querySelector('.backdrop')?.addEventListener('click', (evt) => {
            if (evt.target === evt.currentTarget) {
                this.closeModal();
            }
        });
        root.querySelector('.close')?.addEventListener('click', () => this.closeModal());
        host.addEventListener('keydown', (evt) => {
            if (evt.key === 'Escape') {
                this.closeModal();
            }
        });
        textarea.addEventListener('click', () => textarea.select());
        copyButton.addEventListener('click', async () => {
            textarea.select();
            try {
                await navigator.clipboard.writeText(textarea.value);
            } catch {
                document.execCommand('copy');
            }
            copyButton.textContent = 'Copied';
        });
        return host;
    }

    /**
     * Legacy method to get URL without query string
     */
    private getUrlWithoutQuery(): string {
        return window.location.href.split('?')[0];
    }
}
