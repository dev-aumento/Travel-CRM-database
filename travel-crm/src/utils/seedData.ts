/** Built-in demo records shipped with initialDB — stripped only when id matches bundled fixtures. */

export const SEED_AGENT_IDS = new Set([
    'AGT-001', 'AGT-002', 'AGT-003', 'AGT-004', 'AGT-005',
]);

/** Minimum numeric suffix for new records — avoids collision with bundled demo IDs. */
export const DEMO_ID_MIN: Record<string, number> = {
    travelAgents: 6,
    leads: 16,
    bookings: 11,
    quotations: 11,
    customers: 11,
    staff: 7,
};

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();

/** Bundled seed agents: id must match AND email must match (real AGT-001 with another email is kept). */
const DEMO_AGENT_FIXTURES = new Map<string, string>([
    ['AGT-001', 'raj@globaltravels.com'],
    ['AGT-002', 'amit@flyhigh.com'],
    ['AGT-003', 'sanjay@desertsafaris.com'],
    ['AGT-004', 'priya@zenholidays.com'],
    ['AGT-005', 'vikram@royaltours.com'],
]);

const DEMO_LEAD_IDS = new Set([
    'LD-001', 'LD-002', 'LD-003', 'LD-004', 'LD-005', 'LD-006', 'LD-007', 'LD-008',
    'LD-009', 'LD-010', 'LD-011', 'LD-012', 'LD-013', 'LD-014', 'LD-015',
]);

const DEMO_BOOKING_IDS = new Set([
    'BK-001', 'BK-002', 'BK-003', 'BK-004', 'BK-005', 'BK-006', 'BK-007', 'BK-008', 'BK-009', 'BK-010',
]);

const DEMO_QUOTATION_IDS = new Set([
    'QT-001', 'QT-002', 'QT-003', 'QT-004', 'QT-005', 'QT-006', 'QT-007', 'QT-008', 'QT-009', 'QT-010',
]);

const DEMO_CUSTOMER_FIXTURES = new Map<string, string>([
    ['CUST-001', 'john@example.com'],
    ['CUST-002', 'emily.chen@example.com'],
    ['CUST-003', 'michael.s@example.com'],
    ['CUST-004', 'sarah.j@example.com'],
    ['CUST-005', 'lisa.ray@example.com'],
    ['CUST-006', 'liam@example.com'],
    ['CUST-007', 'emma@example.com'],
    ['CUST-008', 'ahmed@example.om'],
    ['CUST-009', 'tanaka@example.jp'],
    ['CUST-010', 'chloe.d@example.fr'],
]);

const DEMO_STAFF_FIXTURES = new Map<string, string>([
    ['STF-001', 'E-101'],
    ['STF-002', 'E-102'],
    ['STF-003', 'E-103'],
    ['STF-004', 'E-104'],
    ['STF-005', 'E-105'],
    ['STF-006', 'E-106'],
]);

export const isDemoSeedLead = (lead: any): boolean =>
    Boolean(lead?.id && DEMO_LEAD_IDS.has(String(lead.id)) && !lead?.createdById);

export const isDemoSeedBooking = (booking: any): boolean =>
    Boolean(booking?.id && DEMO_BOOKING_IDS.has(String(booking.id)) && !booking?.leadId);

export const isDemoSeedQuotation = (quote: any): boolean =>
    Boolean(quote?.id && DEMO_QUOTATION_IDS.has(String(quote.id)) && !quote?.leadId);

export const isDemoSeedAgent = (agent: any): boolean => {
    const id = String(agent?.id || '');
    const expectedEmail = DEMO_AGENT_FIXTURES.get(id);
    if (!expectedEmail) return false;
    return normalizeEmail(agent?.email) === expectedEmail;
};

export const isDemoSeedCustomer = (customer: any): boolean => {
    const id = String(customer?.id || '');
    const expectedEmail = DEMO_CUSTOMER_FIXTURES.get(id);
    if (!expectedEmail) return false;
    return normalizeEmail(customer?.email) === expectedEmail;
};

export const isDemoSeedStaff = (staff: any): boolean => {
    const id = String(staff?.id || '');
    const expectedEmployeeId = DEMO_STAFF_FIXTURES.get(id);
    if (!expectedEmployeeId) return false;
    return String(staff?.employeeId || '') === expectedEmployeeId;
};

const filterTable = (table: any, predicate: (row: any) => boolean) => {
    if (!table?.data?.length) return table;
    const data = table.data.filter((row: any) => !predicate(row));
    if (data.length === table.data.length) return table;
    return { ...table, data };
};

/** Remove bundled demo CRM rows that match known seed fixtures. */
export const stripDemoSeedData = (db: any): any => {
    if (!db) return db;

    let next = db;
    const strip = (key: string, predicate: (row: any) => boolean) => {
        const filtered = filterTable(next[key], predicate);
        if (filtered !== next[key]) next = { ...next, [key]: filtered };
    };

    strip('leads', isDemoSeedLead);
    strip('bookings', isDemoSeedBooking);
    strip('quotations', isDemoSeedQuotation);
    strip('travelAgents', isDemoSeedAgent);
    strip('staff', isDemoSeedStaff);
    strip('customers', isDemoSeedCustomer);

    return next;
};

/** Drop leads assigned to agent IDs that do not exist (leftover demo rows after ID reuse). */
export const stripOrphanAgentLeads = (db: any): any => {
    if (!db?.leads?.data?.length) return db;

    const agentIds = new Set(
        (db.travelAgents?.data || []).map((a: any) => String(a.id || '')).filter(Boolean)
    );
    const staffIds = new Set(
        (db.staff?.data || [])
            .flatMap((s: any) => [s.employeeId, s.agentId, s.createdByAgentId])
            .map((id: any) => String(id || ''))
            .filter(Boolean)
    );

    const data = db.leads.data.filter((lead: any) => {
        const agentId = String(lead?.agentId || '').trim();
        if (!agentId) return true;
        if (agentIds.has(agentId)) return true;
        if (staffIds.has(agentId)) return true;
        return false;
    });

    if (data.length === db.leads.data.length) return db;
    return { ...db, leads: { ...db.leads, data } };
};

export const sanitizeWorkspaceData = (db: any): any =>
    stripDemoSeedData(stripOrphanAgentLeads(db));
