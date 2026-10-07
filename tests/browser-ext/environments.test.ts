import environments from '../../browser-ext/environments.json';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('environments.json', () => {
    it('lists PROD first, so the popup preselects it', () => {
        expect(environments.map((env) => env.name)).toEqual(['PROD', 'DEV']);
    });

    it.each(environments)('has real Entra ids for $name', ({ tenantId, clientId }) => {
        expect(tenantId).toMatch(GUID);
        expect(clientId).toMatch(GUID);
    });
});
