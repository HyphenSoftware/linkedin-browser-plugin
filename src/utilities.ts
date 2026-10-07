export const maxDaysOfMonth: Record<number, number> = {
    1: 31,
    2: 28,
    3: 31,
    4: 30,
    5: 31,
    6: 30,
    7: 31,
    8: 31,
    9: 30,
    10: 31,
    11: 30,
    12: 31
};

/**
 * If less than 10, zero pad left
 */
export function zeroLeftPad(n: number): string {
    if (n < 10) {
        return `0${n}`;
    }

    return n.toString();
}

/**
 * Gets day, 1 if isStart=true else the last day of the month
 */
function getDefaultMonth(isStart: boolean): number {
    return isStart ? 1 : 12;
}

/**
 * Gets day, 1 if isStart=true else the last day of the month
 */
function getDefaultDay(month: number, isStart: boolean): number {
    return isStart ? 1 : maxDaysOfMonth[month] || 31;
}

/**
 * Parses an object with year, month and day and returns a string with the date.
 */
function parseDate(dateObj: LiDate | undefined, isStart: boolean): string {
    const year = dateObj?.year;

    if (year === undefined) {
        return '';
    }

    const month = dateObj?.month ?? getDefaultMonth(isStart);
    const day = dateObj?.day ?? getDefaultDay(month, isStart);

    return `${year}-${zeroLeftPad(month)}-${zeroLeftPad(day)}`;
}

/**
 * Parses an object with year, month and day and returns a string with the date.
 * - If month is not present, should return 1.
 * - If day is not present, should return 1.
 */
export function parseStartDate(dateObj: LiDate | undefined): string {
    return parseDate(dateObj, true);
}

/**
 * Parses an object with year, month and day and returns a string with the date.
 * - If month is not present, should return 12.
 * - If day is not present, should return last month day.
 */
export function parseEndDate(dateObj: LiDate | undefined): string {
    return parseDate(dateObj, false);
}

/**
 * Converts a LI Voyager style date object into a native JS Date object
 */
export function liDateToJSDate(liDateObj: LiDate | undefined): Date {
    // This is a cheat; by passing string + 00:00, we can force Date to not offset (by timezone), and also treat month as NOT zero-indexed, which is how LI uses it
    return new Date(`${parseStartDate(liDateObj)} 00:00`);
}

/**
 * Trigger a file download prompt with given content
 * @see https://davidwalsh.name/javascript-download
 */
export function promptDownload(data: string, fileName: string, type: string = 'text/plain'): void {
    // Create an invisible A element
    const a = document.createElement('a');
    a.style.display = 'none';
    document.body.appendChild(a);

    // Set the HREF to a Blob representation of the data to be downloaded
    a.href = window.URL.createObjectURL(new Blob([data], { type }));

    // Use download attribute to set set desired file name
    a.setAttribute('download', fileName);

    // Trigger download by simulating click
    a.click();

    // Cleanup
    window.URL.revokeObjectURL(a.href);
    document.body.removeChild(a);
}

/**
 * Get a cookie by name
 */
export function getCookie(name: string): string | null {
    const v = document.cookie.match(`(^|;) ?${name}=([^;]*)(;|$)`);
    return v ? v[2] || null : null;
}

/**
 * Get URL response as base64
 */
export async function urlToBase64(url: string, omitDeclaration: boolean = false): Promise<{ dataStr: string; mimeStr: string }> {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const declarationPatt = /^data:([^;]+)[^,]+base64,/i;
            let dataStr = reader.result as string;
            const mimeStr = dataStr.match(declarationPatt)?.[1] || '';
            if (omitDeclaration) {
                dataStr = dataStr.replace(declarationPatt, '');
            }

            resolve({
                dataStr,
                mimeStr
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Set multiple query string params by passing an object
 */
export function setQueryParams(url: string, paramPairs: Record<string, any>): string {
    const urlInstance = new URL(url);
    const existingQueryPairs: Record<string, any> = {};

    // Handle both real URLSearchParams and our mock
    if (urlInstance.searchParams && typeof urlInstance.searchParams.forEach === 'function') {
        urlInstance.searchParams.forEach((val, key) => {
            existingQueryPairs[key] = val;
        });
    }

    const newSearchParams = new URLSearchParams({
        ...existingQueryPairs,
        ...paramPairs
    });

    return `${urlInstance.origin}${urlInstance.pathname}?${newSearchParams.toString()}`;
}

/**
 * Replace a value with a default if it is null or undefined
 */
export function noNullOrUndef<T>(value: T | null | undefined, optDefaultVal?: T): T {
    const defaultVal = optDefaultVal || ('' as T);
    return typeof value === 'undefined' || value === null ? defaultVal : value;
}

/**
 * Copy with `json.parse(json.stringify())`
 */
export function lazyCopy<T extends Record<string, any>>(inputObj: T, removeKeys: Array<keyof T> = []): T {
    const copied = JSON.parse(JSON.stringify(inputObj));
    removeKeys.forEach((k) => delete copied[k]);
    return copied;
}

/**
 * "Remaps" data that is nested under a multilingual wrapper, hoisting it
 * back up to top-level keys (overwriting existing values).
 *
 * WARNING: Modifies object IN PLACE
 * @example
 * ```js
 * const input = {
 *     firstName: 'Алексе́й',
 *     multiLocaleFirstName: {
 *         ru_RU: 'Алексе́й',
 *         en_US: 'Alexey'
 *     }
 * }
 * console.log(remapNestedLocale(input, 'en_US').firstName);
 * // 'Alexey'
 * ```
 */
export function remapNestedLocale(liObject: LiEntity | LiEntity[], desiredLocale: string, deep: boolean = true): void {
    if (Array.isArray(liObject)) {
        liObject.forEach((o) => {
            remapNestedLocale(o, desiredLocale, deep);
        });
    } else {
        Object.keys(liObject).forEach((prop) => {
            const nestedVal = liObject[prop];
            if (!!nestedVal && typeof nestedVal === 'object') {
                // Test for locale wrapped property
                // example: `multiLocaleFirstName`
                if (prop.startsWith('multiLocale')) {
                    const localeMap = nestedVal as Record<string, any>;
                    // eslint-disable-next-line no-prototype-builtins
                    if (localeMap.hasOwnProperty(desiredLocale)) {
                        // Transform multiLocaleFirstName to firstName
                        const nonPrefixedKeyPascalCase = prop.replace(/multiLocale/i, '');
                        const nonPrefixedKeyLowerCamelCase = nonPrefixedKeyPascalCase.charAt(0).toLocaleLowerCase() + nonPrefixedKeyPascalCase.substring(1);
                        // Remap nested value to top level
                        liObject[nonPrefixedKeyLowerCamelCase] = localeMap[desiredLocale];
                    }
                } else if (deep) {
                    remapNestedLocale(liObject[prop] as LiEntity, desiredLocale, deep);
                }
            }
        });
    }
}

/**
 * Retrieve a LI Company Page URL from a company URN
 */
export function companyLiPageFromCompanyUrn(companyUrn: string, db: InternalDb): string {
    if (typeof companyUrn === 'string') {
        // Dash
        const company = db.getElementByUrn(companyUrn);
        if (company && company.url) {
            return company.url;
        }

        // profileView
        const linkableCompanyIdMatch = /urn.+Company:(\d+)/.exec(companyUrn);
        if (linkableCompanyIdMatch) {
            return `https://www.linkedin.com/company/${linkableCompanyIdMatch[1]}`;
        }
    }
    return '';
}

/**
 * Since LI entities can store dates in different ways, but
 * JSONResume only stores in one, this utility method will detect
 * which format LI is using, parse it, and attach to Resume object
 * (e.g. work position entry), with correct date format
 *  - NOTE: This modifies object in-place
 */
export function parseAndAttachResumeDates(resumeObj: GenObj, liEntity: LiEntity): void {
    // Time period can either come as `timePeriod` or `dateRange` prop
    const timePeriod = liEntity.timePeriod || liEntity.dateRange;
    if (timePeriod) {
        const start = timePeriod.startDate || timePeriod.start;
        const end = timePeriod.endDate || timePeriod.end;
        if (end) {
            resumeObj.endDate = parseEndDate(end);
        }
        if (start) {
            resumeObj.startDate = parseStartDate(start);
        }
    }
}

/**
 * Builds a mini-db out of a LinkedIn schema response
 *
 * @param schemaJson - LinkedIn API response object
 * @returns InternalDb - Internal database structure for processing LinkedIn data
 */
export function buildDbFromLiSchema(schemaJson: any): any {
    /**
     * In LI response, `response.data.*elements _can_ contain an array of ordered URNs
     */
    const possibleResponseDirectUrnArrayKeys = ['*elements', 'elements'];
    /** @type {InternalDb['entitiesByUrn']} */
    const entitiesByUrn: Record<string, any> = {};
    /** @type {InternalDb['entities']} */
    const entities: any[] = [];

    // `response.included` often has a sort order that does *not* match the page. If `response.data.*elements` is
    // included, we should try to reorder `included` before passing it through to other parts of the DB, so as to
    // preserve intended sort order as much as possible
    for (let x = 0; x < possibleResponseDirectUrnArrayKeys.length; x++) {
        /** @type {string[] | undefined} */
        const elementsUrnArr = schemaJson.data[possibleResponseDirectUrnArrayKeys[x]];
        if (Array.isArray(elementsUrnArr)) {
            const sorted: any[] = [];
            elementsUrnArr.forEach((urn: string) => {
                const matching = schemaJson.included.find((e: any) => e.entityUrn === urn);
                if (matching) {
                    sorted.push(matching);
                }
            });
            // Put any remaining elements in last
            sorted.push(...schemaJson.included.filter((e: any) => !elementsUrnArr.includes(e.entityUrn)));
            schemaJson.included = sorted;
            break;
        }
    }

    // Copy all `included` entities to internal DB arrays, which might or might not be sorted at this point
    for (let x = 0; x < schemaJson.included.length; x++) {
        /** @type {LiEntity & {key: string}} */
        const currRow = {
            key: schemaJson.included[x].entityUrn,
            ...schemaJson.included[x]
        };
        entitiesByUrn[currRow.entityUrn] = currRow;
        entities.push(currRow);
    }

    /** @type {Partial<InternalDb> & Pick<InternalDb,'entitiesByUrn' | 'entities' | 'tableOfContents'>} */
    const db: any = {
        entitiesByUrn,
        entities,
        tableOfContents: schemaJson.data
    };
    delete (db.tableOfContents as any)['included'];

    /**
     * Get list of element keys (if applicable)
     *  - Certain LI responses will contain a list of keys that correspond to
     * entities via an URN mapping. I think these are in cases where the response
     * is returning a mix of entities, both directly related to the inquiry and
     * tangentially (e.g. `book` entities and `author` entities, return in the
     * same response). In this case, `elements` are those that directly satisfy
     *  the request, and the other items in `included` are those related
     *
     * Order provided by LI in HTTP response is passed through, if exists
     * @returns {string[]}
     */
    db.getElementKeys = function getElementKeys(): string[] {
        for (let x = 0; x < possibleResponseDirectUrnArrayKeys.length; x++) {
            const key = possibleResponseDirectUrnArrayKeys[x];
            const matchingArr = db.tableOfContents[key];
            if (Array.isArray(matchingArr)) {
                return matchingArr;
            }
        }
        return [];
    };

    // Same as above (getElementKeys), but returns elements themselves
    db.getElements = function getElements(): any[] {
        return db.getElementKeys().map((key) => {
            return db.entitiesByUrn[key];
        });
    };

    /**
     * Get all elements that match type.
     * WARNING: Since this gets elements directly by simply iterating through all results, not via ToC, order of entities returned is simply whatever order LI provides them in the response. Not guaranteed to be in order! Use a ToC approach if you need ordered results.
     * @param {string | string[]} typeStr - Type, e.g. `$com.linkedin...`
     * @returns {LiEntity[]}
     */
    db.getElementsByType = function getElementByType(typeStr: string | string[]): any[] {
        const typeStrArr = Array.isArray(typeStr) ? typeStr : [typeStr];
        return db.entities.filter((entity) => typeStrArr.indexOf(entity['$type']) !== -1);
    };

    /**
     * Get an element by URN
     * @param {string} urn - URN identifier
     * @returns {LiEntity | undefined}
     */
    db.getElementByUrn = function getElementByUrn(urn: string): any {
        return db.entitiesByUrn[urn];
    };

    db.getElementsByUrns = function getElementsByUrns(urns: string | string[]): any[] {
        if (typeof urns === 'string') {
            urns = [urns];
        }
        return Array.isArray(urns) ? urns.map((urn) => db.entitiesByUrn[urn]) : [];
    };

    // Only meant for 1:1 lookups; will return first match, if more than one
    // key provided. Usually returns a "view" (kind of a collection)
    db.getValueByKey = function getValueByKey(key: string | string[]): any {
        const keyArr = Array.isArray(key) ? key : [key];
        for (let x = 0; x < keyArr.length; x++) {
            const foundVal = db.entitiesByUrn[db.tableOfContents[keyArr[x]]];
            if (foundVal) {
                return foundVal;
            }
        }
        return undefined;
    };

    // This, opposed to getValuesByKey, allow for multi-depth traversal
    /**
     * @type {InternalDb['getValuesByKey']}
     */
    db.getValuesByKey = function getValuesByKey(key: string | string[], optTocValModifier?: (val: any) => any): any[] {
        /** @type {LiEntity[]} */
        const results: any[] = [];
        const keyArr = Array.isArray(key) ? key : [key];
        for (let x = 0; x < keyArr.length; x++) {
            const tocVal = db.tableOfContents[keyArr[x]];
            if (tocVal) {
                const modifiedVal = optTocValModifier ? optTocValModifier(tocVal) : tocVal;
                if (Array.isArray(modifiedVal)) {
                    results.push(...modifiedVal.map((urn) => db.entitiesByUrn[urn]));
                } else if (typeof modifiedVal === 'string') {
                    const found = db.entitiesByUrn[modifiedVal];
                    if (found) {
                        results.push(found);
                    }
                }
            }
        }
        return results;
    };

    return db;
}
