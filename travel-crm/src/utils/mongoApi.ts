const API_BASE = import.meta.env.VITE_API_URL || '/api';

const request = async (path: string, options?: RequestInit) => {
    const res = await fetch(`${API_BASE}${path}`, options);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
    }
    return res.json().catch(() => ({}));
};

export const tableToApiPath = (table: string) => table.replace(/([A-Z])/g, '-$1').toLowerCase();

export const PERSISTABLE_TABLES = new Set([
    'leads',
    'bookings',
    'quotations',
    'customers',
    'destinations',
    'hotels',
    'activities',
    'travelAgents',
    'staff',
    'plans',
    'settings',
    'customPresets',
    'quoteTerms',
]);

export const checkMongoHealth = async (): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
    } catch {
        return false;
    }
};

export const fetchDatabaseFromMongo = async (): Promise<Record<string, unknown> | null> => {
    const res = await fetch(`${API_BASE}/database`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to load database (${res.status})`);
    return res.json();
};

export interface CollectionsResponse {
    collections: Record<string, unknown[]>;
    updatedAt: string | null;
}

export const fetchCollectionsFromMongo = async (): Promise<CollectionsResponse> => {
    return request('/collections') as Promise<CollectionsResponse>;
};

export const saveDatabaseToMongo = async (data: Record<string, unknown>): Promise<void> => {
    await request('/database', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
};

export const upsertCollectionRecord = async (
    table: string,
    record: Record<string, unknown>
): Promise<void> => {
    await request(`/${tableToApiPath(table)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
    });
};

export const patchCollectionRecord = async (
    table: string,
    id: string,
    updates: Record<string, unknown>
): Promise<void> => {
    await request(`/${tableToApiPath(table)}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    });
};

export const deleteCollectionRecord = async (table: string, id: string): Promise<void> => {
    await request(`/${tableToApiPath(table)}/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

export const createLead = (record: Record<string, unknown>) => upsertCollectionRecord('leads', record);
export const updateLead = (id: string, updates: Record<string, unknown>) =>
    patchCollectionRecord('leads', id, updates);
export const deleteLead = (id: string) => deleteCollectionRecord('leads', id);

export const createTravelAgent = (record: Record<string, unknown>) =>
    upsertCollectionRecord('travelAgents', record);
export const updateTravelAgent = (id: string, updates: Record<string, unknown>) =>
    patchCollectionRecord('travelAgents', id, updates);
export const deleteTravelAgent = (id: string) => deleteCollectionRecord('travelAgents', id);
