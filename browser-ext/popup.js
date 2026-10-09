// @ts-nocheck
// eslint-disable-next-line import/extensions
import { showAccount as renderAccount } from './account-view.js';
// eslint-disable-next-line import/extensions
import { checkForUpdate, showUpdate } from './update-check.js';
// eslint-disable-next-line import/extensions
import { formatDate } from './format-date.js';

/**
 * =============================
 * =        Constants          =
 * =============================
 */

/**
 * @typedef {Object} LinkedinToResumeJson
 * @property {string} preferLocale - The preferred locale for the resume
 * @property {function(string): Promise<Object>} extractForApi - Function to parse the profile into a JSON Resume
 * @property {function(): Promise<{url: string, urn: string | null, name: string | null}>} getIdentityForApi - Function to get what the lookup matches on
 * @property {function(): void} parseAndDownload - Function to parse and download data
 * @property {function(string): void} parseAndShowOutput - Function to parse and show output
 * @property {function(): string} getViewersLocalLang - Function to get viewer's local language
 */

const extensionId = chrome.runtime.id;

/** @type {HTMLSelectElement} */
const API_SELECT = document.querySelector('.apiSelect');

/**
 * Get the name of the currently selected environment from the selector
 * @returns {string | null}
 */
const getSelectedEnvironment = () => {
    const { value } = API_SELECT;
    if (!value || value === 'none') {
        return null;
    }
    return value;
};

/**
 * Toggle enabled state of popup
 * @param {boolean} isEnabled
 */
const toggleEnabled = (isEnabled) => {
    document.querySelectorAll('.toggle').forEach((elem) => {
        elem.classList.remove(isEnabled ? 'disabled' : 'enabled');
        elem.classList.add(isEnabled ? 'enabled' : 'disabled');
    });
};

/**
 * Show a spinner in place of the button's label while its action runs
 * @param {HTMLElement} button
 * @param {boolean} isBusy
 */
const setBusy = (button, isBusy) => {
    if (isBusy) {
        button.setAttribute('aria-busy', 'true');
    } else {
        button.removeAttribute('aria-busy');
    }
};

const clearImportBusy = () => document.querySelectorAll('.entityActions .button').forEach((button) => setBusy(button, false));

/**
 * Load list of environments to be displayed as options
 * @param {{name: string}[]} environments
 */
const loadEnvironments = (environments) => {
    API_SELECT.innerHTML = '';
    environments.forEach((environment) => {
        if (environment && environment.name) {
            const option = document.createElement('option');
            option.value = environment.name;
            option.innerText = environment.name;
            API_SELECT.appendChild(option);
        }
    });
    toggleEnabled(environments.length > 0);
};

const fetchEnvironments = () => fetch(chrome.runtime.getURL('./environments.json')).then((response) => response.json());

/** @param {{name?: string, preferred_username?: string} | null} account */
const showAccount = (account) => renderAccount(document, account);

const sendToBackground = (message) => chrome.runtime.sendMessage({ environment: getSelectedEnvironment(), ...message });

/**
 * Show who is signed in to the selected environment
 * @returns {Promise<object | null>} the account, or null when nobody is signed in
 */
const refreshAccount = async () => {
    if (!getSelectedEnvironment()) {
        showAccount(null);
        return null;
    }
    const response = await sendToBackground({ type: 'account' });
    const account = response?.account || null;
    showAccount(account);
    return account;
};

/**
 * Configure an entity's action buttons from its precheck status. The chosen action is stored on
 * each button's `dataset.mode` ('create' | 'update' | 'auto') and read by the click handler.
 *  - not found     -> primary "Create {label}"     (mode=create)
 *  - perfect match -> primary "Update {label}"     (mode=update)
 *  - possible match-> primary "Update {label}" (mode=update) + secondary "Create new {label}" (mode=create)
 * @param {string} primaryId
 * @param {string} altId
 * @param {{exists?: boolean, possibleMatch?: boolean}} entityStatus
 * @param {string} label - display label, e.g. "subcontractor"
 */
const applyEntityButton = (primaryId, altId, entityStatus, label) => {
    const primary = document.getElementById(primaryId);
    const alt = document.getElementById(altId);
    if (alt) {
        alt.classList.add('hidden');
    }
    if (!primary) {
        return;
    }

    if (entityStatus && entityStatus.exists) {
        primary.dataset.mode = 'update';
        primary.textContent = `Update ${label}`;
        primary.title = `The ${label} exists, update it`;
    } else if (entityStatus && entityStatus.possibleMatch) {
        primary.dataset.mode = 'update';
        primary.textContent = `Update ${label}`;
        primary.title = `Possible match by name, update the existing ${label}`;
        if (alt) {
            alt.classList.remove('hidden');
            alt.dataset.mode = 'create';
            alt.textContent = 'Create new';
            alt.title = `Not the same person? Create a new ${label} instead`;
            alt.disabled = false;
        }
    } else {
        primary.dataset.mode = 'create';
        primary.textContent = `Create ${label}`;
        primary.title = `No ${label} found, create a new one`;
    }
    primary.disabled = false;
};

const setButtonLoading = (id) => {
    const btn = document.getElementById(id);
    if (btn) {
        btn.title = 'Checking profile status...';
        btn.disabled = true;
    }
};

/**
 * @param {{exists?: boolean, possibleMatch?: boolean} | false | null | undefined | 'loading'} entityStatus
 * @returns {{state: string, text: string}}
 */
const getEntityState = (entityStatus) => {
    if (entityStatus === 'loading') {
        return { state: 'loading', text: 'checking...' };
    }
    if (entityStatus === null || entityStatus === undefined) {
        return { state: '', text: '' };
    }
    if (entityStatus.exists) {
        return { state: 'exists', text: 'exists' };
    }
    if (entityStatus.possibleMatch) {
        return { state: 'possibleMatch', text: 'possible match by name, please verify' };
    }
    return { state: 'notFound', text: 'not found' };
};

/**
 * Show one entity's lookup result in its card
 * @param {string} id - id of the card's status block
 * @param {object | false | null | undefined | 'loading'} entityStatus
 */
const renderEntityStatus = (id, entityStatus) => {
    const container = document.getElementById(id);
    const { state, text } = getEntityState(entityStatus);
    container.querySelector('.marker').className = `marker ${state}`;
    const stateElement = container.querySelector('.entityState');
    stateElement.className = `entityState ${state}`;
    stateElement.textContent = text;

    const details = container.querySelector('.entityDetails');
    details.replaceChildren();
    if (state !== 'exists' && state !== 'possibleMatch') {
        return;
    }
    const facts = [];
    if (entityStatus.lastImported) {
        facts.push(`Last imported ${formatDate(entityStatus.lastImported)}`);
    }
    if (entityStatus.lastContacted) {
        facts.push(`Last contacted ${formatDate(entityStatus.lastContacted)} by ${entityStatus.lastContactedBy?.name || 'unknown'}`);
    }
    facts.forEach((fact) => {
        const line = document.createElement('div');
        line.textContent = fact;
        details.appendChild(line);
    });
    if (entityStatus.multipleProfiles) {
        const warning = document.createElement('div');
        warning.className = 'entityWarning';
        warning.textContent = 'Multiple profiles found for this person';
        details.appendChild(warning);
    }
};

/**
 * Update the UI to show profile status
 * @param {{subcontractor: object, contact: object, error?: string} | 'loading' | null} status
 */
const updateProfileStatus = (status) => {
    console.log('Updating profile status:', status);

    const message = document.getElementById('profileStatus');
    const error = status && status !== 'loading' ? status.error : null;
    message.textContent = error || '';
    message.classList.toggle('hidden', !error);

    if (status === 'loading') {
        setButtonLoading('liToSubcontractor');
        setButtonLoading('liToContact');
        document.getElementById('liToSubcontractorAlt').classList.add('hidden');
        document.getElementById('liToContactAlt').classList.add('hidden');
        renderEntityStatus('subcontractorStatus', 'loading');
        renderEntityStatus('contactStatus', 'loading');
    } else if (!status || status.error) {
        // Unknown state: hide the secondary buttons and leave the defaults (auto mode).
        document.getElementById('liToSubcontractorAlt').classList.add('hidden');
        document.getElementById('liToContactAlt').classList.add('hidden');
        renderEntityStatus('subcontractorStatus', null);
        renderEntityStatus('contactStatus', null);
    } else {
        applyEntityButton('liToSubcontractor', 'liToSubcontractorAlt', status.subcontractor, 'subcontractor');
        applyEntityButton('liToContact', 'liToContactAlt', status.contact, 'contact');
        renderEntityStatus('subcontractorStatus', status.subcontractor);
        renderEntityStatus('contactStatus', status.contact);
    }
};

const isProfilePage = (tab) => !!tab?.url?.includes('linkedin.com/in');

/**
 * Look the open profile up in Airtable and show the result
 */
const checkProfile = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!isProfilePage(tab)) {
        return;
    }
    if (!getSelectedEnvironment()) {
        updateProfileStatus({ subcontractor: false, contact: false });
        return;
    }
    updateProfileStatus('loading');
    const checkButton = document.getElementById('debugCheckButton');
    setBusy(checkButton, true);
    try {
        const [identityResult] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.liToJrInstance.getIdentityForApi()
        });
        const response = await sendToBackground({ type: 'lookup', identity: identityResult.result });
        if (response?.status === 200) {
            updateProfileStatus(response.body);
        } else if (response?.status === 401 || response?.status === 403) {
            updateProfileStatus({ error: 'Sign in to check this profile' });
        } else {
            updateProfileStatus({ error: response?.error || response?.body?.message || `Profile check failed (HTTP ${response?.status})` });
        }
    } finally {
        setBusy(checkButton, false);
    }
    refreshAccount();
};

/**
 * =============================
 * =   Setup Event Listeners   =
 * =============================
 */

chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id === extensionId && message.key === 'importResult') {
        clearImportBusy();
    }
});

document.getElementById('liToJsonButton').addEventListener('click', async (e) => {
    const button = e.currentTarget;
    setBusy(button, true);
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                window.liToJrInstance.preferLocale = window.liToJrInstance.getViewersLocalLang();
                return window.liToJrInstance.parseAndShowOutput('stable');
            }
        });
        window.close();
    } catch (error) {
        console.error(error);
        setBusy(button, false);
    }
});

/**
 * Extract the profile and hand it to the background worker, which imports it and shows the
 * result in the LinkedIn tab, so closing the popup doesn't cancel the import.
 * @param {'subcontractor' | 'contact'} entity
 * @param {'auto' | 'create' | 'update'} mode
 * @param {HTMLElement} button - the clicked button, which shows the spinner until the import is done
 */
const sendImport = async (entity, mode, button) => {
    if (!getSelectedEnvironment()) {
        return;
    }
    setBusy(button, true);
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const [resumeResult] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                window.liToJrInstance.preferLocale = window.liToJrInstance.getViewersLocalLang();
                return window.liToJrInstance.extractForApi('stable');
            }
        });
        await sendToBackground({ type: 'import', tabId: tab.id, entity, mode, resume: resumeResult.result });
    } catch (error) {
        console.error(error);
        setBusy(button, false);
    }
};

document.getElementById('liToSubcontractor').addEventListener('click', (e) => {
    sendImport('subcontractor', e.currentTarget.dataset.mode || 'auto', e.currentTarget);
});
document.getElementById('liToSubcontractorAlt').addEventListener('click', (e) => {
    sendImport('subcontractor', e.currentTarget.dataset.mode || 'create', e.currentTarget);
});

document.getElementById('liToContact').addEventListener('click', (e) => {
    sendImport('contact', e.currentTarget.dataset.mode || 'auto', e.currentTarget);
});
document.getElementById('liToContactAlt').addEventListener('click', (e) => {
    sendImport('contact', e.currentTarget.dataset.mode || 'create', e.currentTarget);
});

document.getElementById('liToJsonDownloadButton').addEventListener('click', async (e) => {
    const button = e.currentTarget;
    setBusy(button, true);
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                window.liToJrInstance.preferLocale = window.liToJrInstance.getViewersLocalLang();
                return window.liToJrInstance.parseAndDownload();
            }
        });
    } catch (error) {
        console.error(error);
    } finally {
        setBusy(button, false);
    }
});

document.getElementById('debugCheckButton').addEventListener('click', () => {
    checkProfile();
});

document.getElementById('signInButton').addEventListener('click', async () => {
    const response = await sendToBackground({ type: 'signIn' });
    const account = response?.account || null;
    showAccount(account);
    if (account) {
        checkProfile();
    }
});

document.getElementById('signOutButton').addEventListener('click', async () => {
    await sendToBackground({ type: 'signOut' });
    showAccount(null);
});

API_SELECT.addEventListener('change', async () => {
    if (await refreshAccount()) {
        checkProfile();
    }
});

/**
 * =============================
 * =           Init            =
 * =============================
 */
document.getElementById('versionDisplay').innerText = chrome.runtime.getManifest().version;

checkForUpdate(chrome.runtime.getManifest().version).then((update) => showUpdate(document, update));
document.getElementById('reloadButton').addEventListener('click', () => chrome.runtime.reload());

/** @returns {Promise<object | null>} the signed-in account of the preselected environment */
const loadEnvironmentsAndAccount = async () => {
    loadEnvironments(await fetchEnvironments());
    return refreshAccount();
};

// Initialize the content script and get the liToJrInstance
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    // Disable buttons if not on LinkedIn
    if (!isProfilePage(tabs[0])) {
        document.getElementById('liToSubcontractor').disabled = true;
        document.getElementById('liToContact').disabled = true;
        document.getElementById('liToJsonButton').disabled = true;
        document.getElementById('liToJsonDownloadButton').disabled = true;
        document.getElementById('debugCheckButton').disabled = true;
        loadEnvironmentsAndAccount();
        return;
    }

    chrome.scripting
        .executeScript({
            target: { tabId: tabs[0].id },
            files: ['main.js']
        })
        .then(() => {
            chrome.scripting
                .executeScript({
                    target: { tabId: tabs[0].id },
                    func: () => {
                        const isDebug = window.location.href.includes('li2jr_debug=true');
                        // Always a new instance: one left in the tab by an older version of the plugin would run its old code
                        window.liToJrInstance = new window.LinkedinToResumeJson(isDebug);
                        return window.liToJrInstance;
                    }
                })
                .then((results) => {
                    // Instance exists in page context; don't use returned object from executeScript
                    // because methods are not preserved through structured cloning.
                    if (results && results[0]) {
                        loadEnvironmentsAndAccount().then((account) => account && checkProfile());
                    }
                });
        });
});
