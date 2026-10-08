// @ts-nocheck
// eslint-disable-next-line import/extensions
import { showAccount as renderAccount } from './account-view.js';
// eslint-disable-next-line import/extensions
import { checkForUpdate, showUpdate } from './update-check.js';

/**
 * =============================
 * =        Constants          =
 * =============================
 */

/** @typedef {'legacy' | 'stable' | 'beta'} SchemaVersion */

/**
 * @typedef {Object} LinkedinToResumeJson
 * @property {string} preferLocale - The preferred locale for the resume
 * @property {function(string): Promise<Object>} extractForApi - Function to parse the profile into a JSON Resume
 * @property {function(): Promise<{url: string, urn: string | null, name: string | null}>} getIdentityForApi - Function to get what the lookup matches on
 * @property {function(): void} parseAndDownload - Function to parse and download data
 * @property {function(string): void} parseAndShowOutput - Function to parse and show output
 * @property {function(): Promise<string[]>} getSupportedLocales - Function to get supported locales
 * @property {function(): string} getViewersLocalLang - Function to get viewer's local language
 */

const extensionId = chrome.runtime.id;

const STORAGE_KEYS = {
    schemaVersion: 'schemaVersion'
};
const SPEC_SELECT = /** @type {HTMLSelectElement} */ (document.getElementById('specSelect'));
/** @type {SchemaVersion[]} */
const SPEC_OPTIONS = ['legacy', 'stable', 'beta'];
/** @type {HTMLSelectElement} */
const LANG_SELECT = document.querySelector('.langSelect');
/** @type {HTMLSelectElement} */
const API_SELECT = document.querySelector('.apiSelect');

/**
 * Get the currently selected lang locale in the selector
 */
const getSelectedLang = () => {
    return LANG_SELECT.value;
};

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
 * Toggle loader while doing API requests
 * @param {boolean} isEnabled
 */
const showLoader = (isEnabled) => {
    document.querySelectorAll('.loader').forEach((elem) => {
        if (isEnabled) {
            elem.classList.remove('hidden');
        } else {
            elem.classList.add('hidden');
        }
    });
};

/**
 * Load list of language strings to be displayed as options
 * @param {string[]} langs
 */
const loadLangs = (langs) => {
    LANG_SELECT.innerHTML = '';
    langs.forEach((lang) => {
        const option = document.createElement('option');
        option.value = lang;
        option.innerText = lang;
        LANG_SELECT.appendChild(option);
    });
    toggleEnabled(langs.length > 0);
};

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
 * Set the desired export lang on the exporter instance
 * - Use `null` to unset
 * @param {string | null} lang
 */
const setLang = (lang) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (langValue) => {
                window.liToJrInstance.preferLocale = langValue;
            },
            args: [lang]
        });
    });
};

/** @param {SchemaVersion} version */
const setSpecVersion = (version) => {
    chrome.storage.sync.set({
        [STORAGE_KEYS.schemaVersion]: version
    });
};

/**
 * Get user's preference for JSONResume Spec Version
 * @returns {Promise<SchemaVersion>}
 */
const getSpecVersion = () => {
    // Fallback value will be what is already selected in dropdown
    const fallbackVersion = /** @type {SchemaVersion} */ (SPEC_SELECT.value);
    return new Promise((res) => {
        try {
            chrome.storage.sync.get([STORAGE_KEYS.schemaVersion], (result) => {
                const storedSetting = result[STORAGE_KEYS.schemaVersion] || '';
                if (SPEC_OPTIONS.includes(storedSetting)) {
                    res(storedSetting);
                } else {
                    res(fallbackVersion);
                }
            });
        } catch (err) {
            console.error(err);
            res(fallbackVersion);
        }
    });
};

/**
 * Update the UI to show profile status
 * @param {{subcontractor: object, contact: object, error?: string} | 'loading'} status
 */
// Button background by match state: green = exists, amber = possible name match, red = not found.
const BUTTON_COLOR_EXISTS = '#4CAF50';
const BUTTON_COLOR_POSSIBLE = '#FF9800';
const BUTTON_COLOR_NOT_FOUND = '#f44336';
const BUTTON_COLOR_NEUTRAL = '#607d8b'; // secondary action (e.g. "Create new" on a possible match)

/**
 * Configure an entity's action buttons from its precheck status. The chosen action is stored on
 * each button's `dataset.mode` ('create' | 'update' | 'auto') and read by the click handler.
 *  - not found     -> primary "Create new {label}" (mode=create)
 *  - perfect match -> primary "Update {label}"      (mode=update)
 *  - possible match-> primary "Update {label}" (mode=update) + secondary "Create new {label}" (mode=create)
 * @param {string} primaryId
 * @param {string} altId
 * @param {{exists?: boolean, possibleMatch?: boolean}} entityStatus
 * @param {string} label - display label, e.g. "Subcontractor"
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
        primary.style.backgroundColor = BUTTON_COLOR_EXISTS;
        primary.textContent = `Update ${label}`;
        primary.title = `${label} exists — update it`;
    } else if (entityStatus && entityStatus.possibleMatch) {
        primary.dataset.mode = 'update';
        primary.style.backgroundColor = BUTTON_COLOR_POSSIBLE;
        primary.textContent = `Update ${label}`;
        primary.title = `Possible match by name — update the existing ${label}`;
        if (alt) {
            alt.classList.remove('hidden');
            alt.dataset.mode = 'create';
            alt.style.backgroundColor = BUTTON_COLOR_NEUTRAL;
            alt.textContent = `Create new ${label}`;
            alt.title = `Not the same person? Create a new ${label} instead`;
            alt.disabled = false;
        }
    } else {
        primary.dataset.mode = 'create';
        primary.style.backgroundColor = BUTTON_COLOR_NOT_FOUND;
        primary.textContent = `Create ${label}`;
        primary.title = `${label} not found — create new`;
    }
    primary.disabled = false;
};

const setButtonLoading = (id) => {
    const btn = document.getElementById(id);
    if (btn) {
        btn.style.backgroundColor = '#808080';
        btn.title = 'Checking profile status...';
        btn.disabled = true;
    }
};

const updateProfileStatus = (status) => {
    console.log('Updating profile status:', status);

    const subAlt = document.getElementById('liToSubcontractorAlt');
    const contactAlt = document.getElementById('liToContactAlt');

    if (status === 'loading') {
        setButtonLoading('liToSubcontractor');
        setButtonLoading('liToContact');
        if (subAlt) subAlt.classList.add('hidden');
        if (contactAlt) contactAlt.classList.add('hidden');
    } else if (!status || status.error) {
        // Unknown state: hide the secondary buttons and leave the defaults (auto mode).
        if (subAlt) subAlt.classList.add('hidden');
        if (contactAlt) contactAlt.classList.add('hidden');
    } else {
        applyEntityButton('liToSubcontractor', 'liToSubcontractorAlt', status.subcontractor, 'Subcontractor');
        applyEntityButton('liToContact', 'liToContactAlt', status.contact, 'Contact');
    }

    // Update status text
    const statusElement = document.getElementById('profileStatus');
    if (!statusElement) {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'profileStatus';
        statusDiv.className = 'fullCenter';
        document.body.insertBefore(statusDiv, document.querySelector('.fullCenter'));
    }

    const statusDiv = document.getElementById('profileStatus');
    if (status === 'loading') {
        statusDiv.innerHTML = '<div class="status-indicator loading">Checking profile status...</div>';
    } else if (status.error) {
        statusDiv.innerHTML = `<div class="status-indicator error">${status.error}</div>`;
    } else {
        const innerHtml = [];

        if (status.subcontractor) {
            innerHtml.push(buildEntityStatusHtml(status.subcontractor, 'subcontractor'));
        }
        if (status.contact) {
            innerHtml.push(buildEntityStatusHtml(status.contact, 'contact'));
        }

        statusDiv.innerHTML = innerHtml.join('');
    }
};

// Build a status-indicator block for one entity (subcontractor/contact),
// handling exists (green), possibleMatch (amber name match) and not-found (red).
const buildEntityStatusHtml = (entityStatus, label) => {
    let statusClass;
    let mainStatus;
    if (entityStatus.exists) {
        statusClass = 'exists';
        mainStatus = `Profile exists as ${label}`;
    } else if (entityStatus.possibleMatch) {
        statusClass = 'possible-match';
        mainStatus = `Possible ${label} match by name — please verify`;
    } else {
        statusClass = 'not-exists';
        mainStatus = `${label.charAt(0).toUpperCase()}${label.slice(1)} not found`;
    }

    let details = '';
    if (entityStatus.exists || entityStatus.possibleMatch) {
        details = `<div class="details">
            ${entityStatus.lastImported ? `Last imported: ${entityStatus.lastImported}` : ''}
            ${entityStatus.lastContacted ? `<br>Last contacted: ${entityStatus.lastContacted} by ${entityStatus.lastContactedBy?.name || 'Unknown'}` : ''}
        </div>`;
    }

    const warning = entityStatus.multipleProfiles ? '<div class="warning">Multiple profiles found for this person</div>' : '';

    return `
        <div class="status-indicator ${statusClass}">
            <div class="main-status">${mainStatus}</div>
            ${details}
            ${warning}
        </div>
    `;
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
    refreshAccount();
};

/**
 * =============================
 * =   Setup Event Listeners   =
 * =============================
 */

chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id === extensionId && message.key === 'locales') {
        /** @type {{supported: string[], user: string}} */
        const { supported, user } = message.value;
        // Make sure user's own locale comes as first option
        if (supported.includes(user)) {
            supported.splice(supported.indexOf(user), 1);
        }
        supported.unshift(user);
        loadLangs(supported);

        fetchEnvironments().then((json) => loadEnvironments(json));
    } else if (sender.id === extensionId && message.key === 'importResult') {
        showLoader(false);
    }
});

document.getElementById('liToJsonButton').addEventListener('click', async () => {
    const versionOption = await getSpecVersion();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting
            .executeScript({
                target: { tabId: tabs[0].id },
                func: (version) => {
                    window.liToJrInstance.preferLocale = window.liToJrInstance.getViewersLocalLang();
                    window.liToJrInstance.parseAndShowOutput(version);
                },
                args: [versionOption]
            })
            .then(() => {
                setTimeout(() => {
                    // Close popup
                    window.close();
                }, 700);
            });
    });
});

/**
 * Extract the profile and hand it to the background worker, which imports it and shows the
 * result in the LinkedIn tab, so closing the popup doesn't cancel the import.
 * @param {'subcontractor' | 'contact'} entity
 * @param {'auto' | 'create' | 'update'} mode
 */
const sendImport = async (entity, mode) => {
    if (!getSelectedEnvironment()) {
        return;
    }
    showLoader(true);
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const [resumeResult] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (lang) => {
                window.liToJrInstance.preferLocale = lang;
                return window.liToJrInstance.extractForApi('stable');
            },
            args: [getSelectedLang()]
        });
        await sendToBackground({ type: 'import', tabId: tab.id, entity, mode, resume: resumeResult.result });
    } catch (error) {
        console.error(error);
        showLoader(false);
    }
};

document.getElementById('liToSubcontractor').addEventListener('click', (e) => {
    sendImport('subcontractor', e.currentTarget.dataset.mode || 'auto');
});
document.getElementById('liToSubcontractorAlt').addEventListener('click', (e) => {
    sendImport('subcontractor', e.currentTarget.dataset.mode || 'create');
});

document.getElementById('liToContact').addEventListener('click', (e) => {
    sendImport('contact', e.currentTarget.dataset.mode || 'auto');
});
document.getElementById('liToContactAlt').addEventListener('click', (e) => {
    sendImport('contact', e.currentTarget.dataset.mode || 'create');
});

document.getElementById('liToJsonDownloadButton').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (lang) => {
                window.liToJrInstance.preferLocale = lang;
                window.liToJrInstance.parseAndDownload();
            },
            args: [getSelectedLang()]
        });
    });
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

LANG_SELECT.addEventListener('change', () => {
    setLang(getSelectedLang());
});

API_SELECT.addEventListener('change', async () => {
    if (await refreshAccount()) {
        checkProfile();
    }
});

SPEC_SELECT.addEventListener('change', () => {
    setSpecVersion(/** @type {SchemaVersion} */ (SPEC_SELECT.value));
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
                        // Reference the globally exposed class
                        window.liToJrInstance = typeof window.liToJrInstance !== 'undefined' ? window.liToJrInstance : new window.LinkedinToResumeJson(isDebug);
                        return window.liToJrInstance;
                    }
                })
                .then((results) => {
                    // Instance exists in page context; don't use returned object from executeScript
                    // because methods are not preserved through structured cloning.
                    if (results && results[0]) {
                        // Now that we have liToJrInstance, we can get the supported locales
                        chrome.scripting
                            .executeScript({
                                target: { tabId: tabs[0].id },
                                func: () => {
                                    return window.liToJrInstance.getSupportedLocales();
                                }
                            })
                            .then((localeResults) => {
                                if (localeResults && localeResults[0] && localeResults[0].result) {
                                    const supported = localeResults[0].result;
                                    chrome.scripting
                                        .executeScript({
                                            target: { tabId: tabs[0].id },
                                            func: () => {
                                                return window.liToJrInstance.getViewersLocalLang();
                                            }
                                        })
                                        .then((userLocaleResults) => {
                                            if (userLocaleResults && userLocaleResults[0] && userLocaleResults[0].result) {
                                                const user = userLocaleResults[0].result;
                                                // Make sure user's own locale comes as first option
                                                if (supported.includes(user)) {
                                                    supported.splice(supported.indexOf(user), 1);
                                                }
                                                supported.unshift(user);
                                            }
                                            loadLangs(supported);
                                        });
                                }
                            });

                        loadEnvironmentsAndAccount().then((account) => account && checkProfile());
                    }
                });
        });
});

getSpecVersion().then((spec) => {
    SPEC_SELECT.value = spec;
});
