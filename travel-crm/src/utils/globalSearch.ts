import { isMainAgencyAgent } from './agentPlan';
import {
    filterStaffForAgentSession,
    filterSubAgentsForAgentSession,
    isBookingFromConfirmedLead,
    isSubAgencyAgentSession,
    recordVisibleToSession,
    type SessionScopeOpts,
} from './databaseSync';
import { getStoredPermissions, hasPermission } from './permissions';
import { formatTrackingId } from './trackingId';

export type GlobalSearchHighlightType =
    | 'lead'
    | 'staff'
    | 'subAgent'
    | 'agent'
    | 'booking'
    | 'quotation';

export type GlobalSearchResult = {
    id: string;
    rowId: string;
    tableLabel: string;
    title: string;
    subtitle: string;
    displayId?: string;
    path: string;
    highlightType: GlobalSearchHighlightType;
};

const MAX_RESULTS = 12;

const buildHaystack = (fields: Array<string | null | undefined>) =>
    fields
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

const resolveSearchDisplayId = (
    trackingValue?: string | null,
    fallbackId?: string | null
): string | undefined => {
    const tracking = formatTrackingId(trackingValue);
    if (tracking && tracking !== '-') return tracking;
    const fallback = String(fallbackId || '').trim();
    return fallback || undefined;
};

const matchesQuery = (haystack: string, query: string) => haystack.includes(query);

const pushResult = (
    results: GlobalSearchResult[],
    result: GlobalSearchResult
) => {
    if (results.length >= MAX_RESULTS) return;
    if (results.some((row) => row.id === result.id)) return;
    results.push(result);
};

export const buildSearchNavigationPath = (result: GlobalSearchResult): string => {
    const ts = Date.now();
    const id = encodeURIComponent(result.rowId);

    switch (result.highlightType) {
        case 'lead':
            return `/leads?highlightLeadId=${id}&focusTs=${ts}`;
        case 'staff':
            return `/my-team?tab=staff&highlightStaffId=${id}&focusTs=${ts}`;
        case 'subAgent':
            return `/my-team?tab=sub-agents&highlightAgentId=${id}&focusTs=${ts}`;
        case 'agent':
            return `/my-team?tab=agents&highlightAgentId=${id}&focusTs=${ts}`;
        case 'booking':
            return `/bookings?highlightBookingId=${id}&focusTs=${ts}`;
        case 'quotation':
            return `/quotations?highlightQuoteId=${id}&focusTs=${ts}`;
        default:
            return result.path;
    }
};

export const buildGlobalSearchResults = (
    searchQuery: string,
    db: any,
    sessionScope: SessionScopeOpts
): GlobalSearchResult[] => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const { userRole, sessionAgentId } = sessionScope;
    const results: GlobalSearchResult[] = [];

    if (userRole === 'admin') {
        const agents = (db.travelAgents?.data || []).filter(isMainAgencyAgent);
        agents.forEach((agent: any) => {
            const haystack = buildHaystack([
                agent?.name,
                agent?.businessName,
                agent?.email,
                agent?.phone,
                agent?.mobile,
                agent?.plan,
                agent?.id,
            ]);
            if (!matchesQuery(haystack, q)) return;
            pushResult(results, {
                id: `agent-${agent.id}`,
                rowId: agent.id,
                tableLabel: 'Agent',
                title: agent.name || agent.businessName || 'Agent',
                subtitle: `${agent.plan || 'Lite'} Plan${agent.businessName ? ` · ${agent.businessName}` : ''}`,
                path: '/my-team',
                highlightType: 'agent',
            });
        });
        return results;
    }

    const canSearchTeam =
        userRole === 'agent' ||
        isSubAgencyAgentSession(sessionAgentId, db) ||
        (userRole === 'staff' && hasPermission(getStoredPermissions(), 'travelAgents'));

    if (canSearchTeam) {
        const staffRows = filterStaffForAgentSession(
            db.staff?.data || [],
            sessionAgentId,
            db
        );
        staffRows.forEach((member: any) => {
            const haystack = buildHaystack([
                member?.name,
                member?.employeeId,
                member?.id,
                member?.role,
                member?.email,
            ]);
            if (!matchesQuery(haystack, q)) return;
            pushResult(results, {
                id: `staff-${member.id}`,
                rowId: member.id,
                tableLabel: 'Staff',
                title: member.name || member.employeeId || 'Staff',
                subtitle: `${member.role || 'Staff'} · ${member.employeeId || member.id}`,
                path: '/my-team',
                highlightType: 'staff',
            });
        });

        if (userRole === 'agent' && !isSubAgencyAgentSession(sessionAgentId, db)) {
            const subAgents = filterSubAgentsForAgentSession(
                db.travelAgents?.data || [],
                sessionAgentId,
                db
            );
            subAgents.forEach((sub: any) => {
                const haystack = buildHaystack([
                    sub?.name,
                    sub?.businessName,
                    sub?.email,
                    sub?.phone,
                    sub?.mobile,
                    sub?.id,
                ]);
                if (!matchesQuery(haystack, q)) return;
                pushResult(results, {
                    id: `sub-agent-${sub.id}`,
                    rowId: sub.id,
                    tableLabel: 'Sub-Agent',
                    title: sub.name || sub.businessName || 'Sub-Agent',
                    subtitle: sub.businessName || sub.email || sub.id,
                    path: '/my-team',
                    highlightType: 'subAgent',
                });
            });
        }
    }

    const searchableTables: Array<{
        key: string;
        path: string;
        label: string;
        highlightType: GlobalSearchHighlightType;
        getPrimary: (row: any) => string;
        getSecondary: (row: any) => string;
        getDisplayId?: (row: any) => string | undefined;
        getFields: (row: any) => Array<string | null | undefined>;
        filter?: (row: any) => boolean;
    }> = [
        {
            key: 'leads',
            path: '/leads',
            label: 'Lead',
            highlightType: 'lead',
            getPrimary: (row) => row.name,
            getSecondary: (row) => `${row.destination || ''}`.trim() || row.id,
            getDisplayId: (row) => resolveSearchDisplayId(row.trackingId, row.id),
            getFields: (row) => [
                row?.name,
                row?.email,
                row?.phone,
                row?.mobile,
                row?.id,
                row?.trackingId,
                row?.tripId,
                row?.destination,
            ],
        },
        {
            key: 'bookings',
            path: '/bookings',
            label: 'Booking',
            highlightType: 'booking',
            getPrimary: (row) => row.customer,
            getSecondary: (row) => row.package || row.dates || row.id,
            getDisplayId: (row) =>
                resolveSearchDisplayId(row.trackingId || row.tripId, row.id),
            getFields: (row) => [
                row?.customer,
                row?.email,
                row?.phone,
                row?.id,
                row?.trackingId,
                row?.tripId,
                row?.quoteId,
                row?.leadId,
                row?.package,
            ],
            filter: (row) => isBookingFromConfirmedLead(row, db),
        },
        {
            key: 'quotations',
            path: '/quotations',
            label: 'Quotation',
            highlightType: 'quotation',
            getPrimary: (row) => row.customer,
            getSecondary: (row) =>
                `${row.destination || ''}${row.version ? ` · v${row.version}` : ''}`.trim() || row.id,
            getDisplayId: (row) =>
                resolveSearchDisplayId(row.trackingId || row.tripId, row.id),
            getFields: (row) => [
                row?.customer,
                row?.email,
                row?.customerEmail,
                row?.phone,
                row?.id,
                row?.trackingId,
                row?.tripId,
                row?.leadId,
                row?.destination,
                row?.version,
            ],
        },
    ];

    searchableTables.forEach((table) => {
        let rows = (db as any)?.[table.key]?.data || [];
        rows = rows.filter((row: any) =>
            recordVisibleToSession(table.key, row, db, sessionScope)
        );
        if (table.filter) {
            rows = rows.filter(table.filter);
        }

        rows.forEach((row: any) => {
            const haystack = buildHaystack(table.getFields(row));
            if (!matchesQuery(haystack, q)) return;
            pushResult(results, {
                id: `${table.key}-${row.id}`,
                rowId: row.id,
                tableLabel: table.label,
                title: table.getPrimary(row) || row.id || 'Record',
                subtitle: table.getSecondary(row) || row.id || '',
                displayId: table.getDisplayId?.(row) || undefined,
                path: table.path,
                highlightType: table.highlightType,
            });
        });
    });

    return results.slice(0, MAX_RESULTS);
};
