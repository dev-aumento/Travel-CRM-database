import { findTravelAgentForSession } from './agentPlan';
import { PLATFORM_NAME } from '../constants/platform';
import {
    isDemoSeedLead,
    isDemoSeedBooking,
    isDemoSeedQuotation,
} from './seedData';
import {
    buildBookingPaymentPatch,
    getUnifiedBudgetForLead,
    getUnifiedBudgetForQuote,
} from './pricingConsistency';
import { trackingIdsMatch } from './trackingId';
import { parseDurationNights } from './pricing';
import { quoteBelongsToLead } from './quoteActivities';

export type AgencyBranding = {
    name: string;
    logo: string;
    logoUrl: string;
    settings: any | null;
    mainAgent: any | null;
};

const normalizeAgencyEmail = (value?: string | null) =>
    String(value || '').trim().toLowerCase();

export type SessionUserType = 'admin' | 'mainAgent' | 'subAgent' | 'staff';

export type SessionUser = {
    type: SessionUserType;
    record: any;
};

export type SessionScopeOpts = {
    userRole: string | null | undefined;
    userEmail: string | null | undefined;
    sessionAgentId: string | null | undefined;
    sessionUserId?: string | null;
};

const agentPortalEmail = (agent: any): string =>
    normalizeAgencyEmail(agent?.staffLoginId || agent?.email || '');

export const SESSION_USER_ID_KEY = 'sessionUserId';

const getStoredSessionUserId = (): string => {
    if (typeof localStorage === 'undefined') return '';
    return String(localStorage.getItem(SESSION_USER_ID_KEY) || '').trim();
};

/** Resolve the logged-in user record (main agent, sub-agent, staff, or admin settings). */
const normalizeLoginId = (value: unknown): string =>
    String(value ?? '').trim().toLowerCase();

const findStaffMemberForSession = (
    staff: any[],
    opts: { loginId?: string; sessionUserId?: string; sessionAgentId?: string },
    db: any
): any | null => {
    const loginId = normalizeLoginId(opts.loginId);
    const sessionUserId = String(opts.sessionUserId || '').trim();
    const sessionAgentId = String(opts.sessionAgentId || '').trim();

    if (sessionUserId) {
        const byId = staff.find((member: any) => member.id === sessionUserId);
        if (byId) return byId;
    }

    if (loginId) {
        const byLoginId = staff.find(
            (member: any) => normalizeLoginId(member.employeeId) === loginId
        );
        if (byLoginId) return byLoginId;
    }

    if (loginId && sessionAgentId) {
        const agencyId = resolveMainAgencyAgentId(sessionAgentId, db);
        const scoped = staff.filter((member: any) => {
            const memberAgencyId = resolveMainAgencyAgentId(member?.agentId, db);
            return agencyId && memberAgencyId === agencyId;
        });
        const byAgencyLogin = scoped.find(
            (member: any) => normalizeLoginId(member.employeeId) === loginId
        );
        if (byAgencyLogin) return byAgencyLogin;
    }

    return null;
};

export const findSessionUser = (
    db: any,
    opts: {
        userRole?: string | null;
        userEmail?: string | null;
        sessionAgentId?: string | null;
        sessionUserId?: string | null;
    }
): SessionUser | null => {
    if (opts.userRole === 'admin') {
        const record = db?.settings?.data?.[0] || null;
        return record ? { type: 'admin', record } : { type: 'admin', record: null };
    }

    const agents = db?.travelAgents?.data || [];
    const staff = db?.staff?.data || [];
    const email = normalizeAgencyEmail(opts.userEmail);
    const sessionId = String(opts.sessionAgentId || '').trim();
    const sessionUserId =
        String(opts.sessionUserId || '').trim() || getStoredSessionUserId();

    if (sessionUserId) {
        const staffMember = staff.find((member: any) => member.id === sessionUserId);
        if (staffMember) {
            return { type: 'staff', record: staffMember };
        }

        const travelAgent = agents.find((agent: any) => agent.id === sessionUserId);
        if (travelAgent) {
            return travelAgent.parentId
                ? { type: 'subAgent', record: travelAgent }
                : { type: 'mainAgent', record: travelAgent };
        }
    }

    if (sessionId) {
        const sessionAgent = agents.find((agent: any) => agent.id === sessionId);
        if (sessionAgent?.parentId) {
            return { type: 'subAgent', record: sessionAgent };
        }
    }

    if (opts.userRole === 'staff') {
        const staffMember = findStaffMemberForSession(
            staff,
            { loginId: opts.userEmail || '', sessionUserId, sessionAgentId: sessionId },
            db
        );
        if (staffMember) {
            return { type: 'staff', record: staffMember };
        }

        const subAgent = agents.find(
            (agent: any) =>
                agent.parentId &&
                ((email &&
                    (normalizeAgencyEmail(agent.email) === email ||
                        normalizeAgencyEmail(agent.staffLoginId) === email)) ||
                    agent.id === sessionId ||
                    agent.id === sessionUserId)
        );
        if (subAgent) {
            return { type: 'subAgent', record: subAgent };
        }
    }

    if (opts.userRole === 'agent') {
        const agent = findTravelAgentForSession(agents, {
            agentId: opts.sessionAgentId,
            userEmail: opts.userEmail,
        });
        if (!agent) return null;
        if (agent.parentId) {
            return { type: 'subAgent', record: agent };
        }
        return { type: 'mainAgent', record: agent };
    }

    return null;
};

/** Display name for the logged-in user (navbar, sidebar badge, profile header). */
export const resolveSessionDisplayName = (
    db: any,
    opts: {
        userRole?: string | null;
        userEmail?: string | null;
        sessionAgentId?: string | null;
        sessionUserId?: string | null;
    }
): string => {
    if (opts.userRole === 'admin') {
        const settings = db?.settings?.data?.[0];
        return settings?.agencyName || PLATFORM_NAME;
    }

    const sessionUser = findSessionUser(db, {
        ...opts,
        sessionUserId: opts.sessionUserId || getStoredSessionUserId(),
    });
    if (sessionUser?.type === 'subAgent') {
        return (
            String(sessionUser.record?.name || '').trim() ||
            String(sessionUser.record?.businessName || '').trim() ||
            'Sub-Agent'
        );
    }
    if (sessionUser?.type === 'staff') {
        return (
            String(sessionUser.record?.name || '').trim() ||
            sessionUser.record?.employeeId ||
            'Staff Member'
        );
    }
    if (sessionUser?.type === 'mainAgent') {
        return (
            String(sessionUser.record?.name || '').trim() ||
            String(sessionUser.record?.businessName || '').trim() ||
            'Agent'
        );
    }

    const email = normalizeAgencyEmail(opts.userEmail);
    if (email) {
        const staffMember = (db?.staff?.data || []).find(
            (member: any) => normalizeAgencyEmail(member.employeeId) === email
        );
        if (staffMember?.name) return staffMember.name;
        if (staffMember?.employeeId) return staffMember.employeeId;

        const subAgent = (db?.travelAgents?.data || []).find(
            (agent: any) =>
                agent.parentId &&
                (normalizeAgencyEmail(agent.email) === email ||
                    normalizeAgencyEmail(agent.staffLoginId) === email)
        );
        if (subAgent?.name) return subAgent.name;
        if (subAgent?.businessName) return subAgent.businessName;
    }

    return opts.userRole === 'staff' ? 'Staff Member' : 'User';
};

/** True for platform admin or the main agency owner — not staff or sub-agents. */
export const isMainAgencyOwnerSession = (
    userRole: string | null | undefined,
    sessionAgentId: string | null | undefined,
    db: any
): boolean => {
    if (userRole === 'admin') return true;
    if (userRole !== 'agent') return false;
    const sessionId = String(sessionAgentId || '').trim();
    if (!sessionId) return false;
    return !isSubAgencyAgentSession(sessionId, db);
};

/** Agent scope + CRM record sync helpers (leads → bookings/customers/database views). */

/** Lead pipeline stages that own a row in the Bookings module */
export const CONFIRMED_LEAD_STATUSES = new Set(['confirmed', 'completed']);

/** Booking row statuses shown in the Bookings module */
export const CONFIRMED_BOOKING_STATUSES = new Set(['confirmed', 'completed']);

export const isConfirmedBookingStatus = (booking: any): boolean =>
    CONFIRMED_BOOKING_STATUSES.has(String(booking?.status || '').toLowerCase());

const PIPELINE_LEAD_STATUSES = ['new', 'contacted', 'itinerary', 'negotiation'];

/** Quotations linked to a lead (strict match — never merges same-name leads). */
export const getQuotationsForLead = (db: any, lead: any): any[] => {
    if (!lead) return [];
    const quotations = db?.quotations?.data || [];
    const allLeads = db?.leads?.data || [];
    return quotations.filter((q: any) => quoteBelongsToLead(q, lead, allLeads));
};

/** Resolved confirmed package quote for a lead, if valid. */
export const getConfirmedQuoteForLead = (db: any, lead: any): any | null => {
    const quoteId = String(lead?.confirmedQuoteId || '').trim();
    if (!quoteId) return null;
    const quote = (db?.quotations?.data || []).find((q: any) => q.id === quoteId);
    if (!quote) return null;
    if (lead.id && quote.leadId && quote.leadId !== lead.id) return null;
    if (!quote.leadId && quote.customer !== lead.name) return null;
    return quote;
};

/** True when the lead has a selected quotation package to confirm against. */
export const canConfirmLead = (db: any, lead: any): boolean =>
    Boolean(getConfirmedQuoteForLead(db, lead));

/** Best pipeline column when a lead cannot stay confirmed (no valid selected quote). */
export const inferLeadPipelineStatus = (db: any, lead: any): string => {
    const quotes = getQuotationsForLead(db, lead);
    if (quotes.length === 0) {
        const current = String(lead?.status || '').toLowerCase();
        return PIPELINE_LEAD_STATUSES.includes(current) ? current : 'new';
    }
    const quoteStatuses = quotes.map((q: any) => String(q.status || '').toLowerCase());
    const priority = ['negotiation', 'itinerary', 'contacted', 'new', 'draft'];
    for (const status of priority) {
        if (quoteStatuses.includes(status)) return status;
    }
    return 'itinerary';
};

/** Resolve booking row for a lead — never merges same-name leads by customer alone. */
export const findBookingForLead = (
    lead: any,
    bookings: any[],
    confirmedQuoteId?: string
): any | undefined => {
    if (!lead || !Array.isArray(bookings)) return undefined;

    const quoteId = confirmedQuoteId || lead.confirmedQuoteId;

    if (lead.bookingId) {
        const byBookingId = bookings.find((b: any) => b.id === lead.bookingId);
        if (byBookingId) return byBookingId;
    }
    if (lead.id) {
        const byLeadId = bookings.find((b: any) => b.leadId === lead.id);
        if (byLeadId) return byLeadId;
    }
    if (quoteId) {
        const byQuote = bookings.find((b: any) => b.quoteId === quoteId);
        if (byQuote) return byQuote;
    }
    const tripId = lead.tripId || lead.trackingId;
    if (tripId) {
        const byTrip = bookings.find(
            (b: any) => trackingIdsMatch(b.trackingId, tripId) || trackingIdsMatch(b.tripId, tripId)
        );
        if (byTrip) return byTrip;
    }
    const nameMatches = bookings.filter((b: any) => b.customer === lead.name);
    return nameMatches.length === 1 ? nameMatches[0] : undefined;
};

/** All booking rows tied to a lead (used when deleting a lead). */
export const findLinkedBookingsForLead = (lead: any, db: any): any[] => {
    if (!lead) return [];
    const bookings = db?.bookings?.data || [];
    const linked = bookings.filter(
        (b: any) =>
            (lead.bookingId && b.id === lead.bookingId) ||
            (lead.id && b.leadId === lead.id) ||
            (lead.confirmedQuoteId && b.quoteId === lead.confirmedQuoteId) ||
            (lead.tripId &&
                (trackingIdsMatch(b.trackingId, lead.tripId) || trackingIdsMatch(b.tripId, lead.tripId))) ||
            (lead.trackingId &&
                (trackingIdsMatch(b.trackingId, lead.trackingId) ||
                    trackingIdsMatch(b.tripId, lead.trackingId)))
    );
    if (linked.length > 0) return linked;
    const byName = bookings.filter((b: any) => lead.name && b.customer === lead.name);
    return byName.length === 1 ? byName : [];
};

/** All quotation rows tied to a lead (used when deleting a lead). */
export const findLinkedQuotationsForLead = (lead: any, db: any): any[] => {
    if (!lead) return [];
    return getQuotationsForLead(db, lead);
};

/** Lead statuses that belong in the Deleted kanban column. */
export const DELETED_LEAD_STATUSES = new Set(['deleted', 'lost']);

export const isDeletedLead = (lead: any): boolean =>
    DELETED_LEAD_STATUSES.has(String(lead?.status || '').toLowerCase());

/** True when the lead has a highlight note or follow-up note history. */
export const hasLeadHighlightOrFollowUp = (lead: any): boolean => {
    if (String(lead?.leadNote || '').trim()) return true;
    const history = lead?.leadNoteHistory;
    return Array.isArray(history) && history.length > 0;
};

/** Pipeline column for display — without quotations, New until a highlight/follow-up exists. */
export const resolveLeadKanbanColumn = (db: any, lead: any): string => {
    if (isDeletedLead(lead)) return 'deleted';
    if (getQuotationsForLead(db, lead).length === 0) {
        return hasLeadHighlightOrFollowUp(lead) ? 'contacted' : 'new';
    }
    return lead?.status || 'new';
};

export const leadMatchesKanbanColumn = (lead: any, columnId: string, db?: any): boolean => {
    if (db) {
        return resolveLeadKanbanColumn(db, lead) === columnId;
    }
    if (columnId === 'deleted') return isDeletedLead(lead);
    return lead?.status === columnId;
};

export const findLeadForBooking = (booking: any, leads: any[]): any | undefined => {
    if (!booking || !Array.isArray(leads)) return undefined;

    if (booking.leadId) {
        const byLeadId = leads.find((l: any) => l.id === booking.leadId);
        if (byLeadId) return byLeadId;
    }
    if (booking.id) {
        const byBookingId = leads.find((l: any) => l.bookingId === booking.id);
        if (byBookingId) return byBookingId;
    }
    if (booking.quoteId) {
        const byQuote = leads.find((l: any) => l.confirmedQuoteId === booking.quoteId);
        if (byQuote) return byQuote;
    }
    const tripId = booking.trackingId || booking.tripId;
    if (tripId) {
        const byTrip = leads.find(
            (l: any) => l.trackingId === tripId || l.tripId === tripId
        );
        if (byTrip) return byTrip;
    }
    const nameMatches = leads.filter((l: any) => l.name === booking.customer);
    return nameMatches.length === 1 ? nameMatches[0] : undefined;
};

export const isConfirmedLead = (lead: any): boolean =>
    CONFIRMED_LEAD_STATUSES.has(String(lead?.status || '').toLowerCase());

/** Booking status dropdown — same values/labels as the Leads pipeline panels. */
export const BOOKING_PIPELINE_STATUS_OPTIONS = [
    { value: 'new', label: 'New Leads' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'itinerary', label: 'Itinerary Sent' },
    { value: 'negotiation', label: 'In Discussion' },
    { value: 'confirmed', label: 'Booking Confirmed' },
    { value: 'completed', label: 'Trip Completed' },
    { value: 'canceled', label: 'Canceled' },
] as const;

/** Map legacy/alias statuses onto the leads pipeline column ids. */
export const normalizePipelineStatus = (status?: string): string => {
    const s = String(status || '').toLowerCase();
    if (!s || s === 'pending') return 'itinerary';
    if (s === 'cancelled') return 'canceled';
    return s;
};

export const getPipelineStatusLabel = (status?: string): string => {
    const normalized = normalizePipelineStatus(status);
    return (
        BOOKING_PIPELINE_STATUS_OPTIONS.find((option) => option.value === normalized)?.label ||
        normalized
    );
};

/** Booking row status aligned with lead pipeline (confirmed leads → booking confirmed). */
export const getBookingPipelineStatus = (lead: any): string => {
    const status = normalizePipelineStatus(lead?.status);
    if (status === 'completed') return 'completed';
    if (status === 'canceled') return 'canceled';
    if (CONFIRMED_LEAD_STATUSES.has(status)) return 'confirmed';
    return status;
};

export const getBookingDisplayStatus = (booking: any, lead?: any): string => {
    if (lead && isConfirmedLead(lead)) {
        return getBookingPipelineStatus(lead);
    }
    return normalizePipelineStatus(booking?.status || 'confirmed');
};

/** True when a booking row is backed by at least one quotation (direct quoteId or linked lead). */
export const bookingHasLinkedQuotation = (
    booking: any,
    db: any,
    leadIndex?: LeadLookupIndex
): boolean => {
    const quotations = db?.quotations?.data || [];
    const quoteId = String(booking?.quoteId || '').trim();
    if (quoteId && quotations.some((q: any) => q.id === quoteId)) {
        return true;
    }

    const lead = leadIndex
        ? findLeadForBookingIndexed(booking, leadIndex)
        : findLeadForBooking(booking, db?.leads?.data || []);

    if (!lead) return false;
    return getQuotationsForLead(db, lead).length > 0;
};

/** Bookings list: confirmed/completed rows, or rows tied to a confirmed/completed lead — only when a quotation exists. */
export const isBookingFromConfirmedLead = (booking: any, db: any): boolean => {
    if (!bookingHasLinkedQuotation(booking, db)) return false;
    if (isConfirmedBookingStatus(booking)) return true;
    const lead = findLeadForBooking(booking, db?.leads?.data || []);
    return lead ? isConfirmedLead(lead) : false;
};

export type LeadLookupIndex = {
    byLeadId: Map<string, any>;
    byBookingId: Map<string, any>;
    byQuoteId: Map<string, any>;
    byTrackingId: Map<string, any>;
    byUniqueCustomer: Map<string, any>;
    confirmedLeadIds: Set<string>;
};

/** O(leads) index for fast booking ↔ lead joins on large datasets. */
export const buildLeadLookupIndex = (leads: any[]): LeadLookupIndex => {
    const byLeadId = new Map<string, any>();
    const byBookingId = new Map<string, any>();
    const byQuoteId = new Map<string, any>();
    const byTrackingId = new Map<string, any>();
    const customerCounts = new Map<string, number>();
    const confirmedLeadIds = new Set<string>();

    for (const lead of leads || []) {
        if (!lead) continue;
        if (lead.id) {
            byLeadId.set(lead.id, lead);
            if (isConfirmedLead(lead)) confirmedLeadIds.add(lead.id);
        }
        if (lead.bookingId) byBookingId.set(lead.bookingId, lead);
        if (lead.confirmedQuoteId) byQuoteId.set(lead.confirmedQuoteId, lead);
        const tripId = lead.trackingId || lead.tripId;
        if (tripId) byTrackingId.set(tripId, lead);
        if (lead.name) {
            customerCounts.set(lead.name, (customerCounts.get(lead.name) || 0) + 1);
        }
    }

    const byUniqueCustomer = new Map<string, any>();
    for (const lead of leads || []) {
        if (lead?.name && customerCounts.get(lead.name) === 1) {
            byUniqueCustomer.set(lead.name, lead);
        }
    }

    return {
        byLeadId,
        byBookingId,
        byQuoteId,
        byTrackingId,
        byUniqueCustomer,
        confirmedLeadIds,
    };
};

export const findLeadForBookingIndexed = (
    booking: any,
    index: LeadLookupIndex
): any | undefined => {
    if (!booking) return undefined;
    if (booking.leadId) {
        const byLead = index.byLeadId.get(booking.leadId);
        if (byLead) return byLead;
    }
    if (booking.id) {
        const byBooking = index.byBookingId.get(booking.id);
        if (byBooking) return byBooking;
    }
    if (booking.quoteId) {
        const byQuote = index.byQuoteId.get(booking.quoteId);
        if (byQuote) return byQuote;
    }
    const tripId = booking.trackingId || booking.tripId;
    if (tripId) {
        const byTrip = index.byTrackingId.get(tripId);
        if (byTrip) return byTrip;
    }
    if (booking.customer) {
        return index.byUniqueCustomer.get(booking.customer);
    }
    return undefined;
};

export const isBookingFromConfirmedLeadIndexed = (
    booking: any,
    index: LeadLookupIndex,
    db: any
): boolean => {
    if (!bookingHasLinkedQuotation(booking, db, index)) return false;
    if (isConfirmedBookingStatus(booking)) return true;
    const lead = findLeadForBookingIndexed(booking, index);
    return lead ? isConfirmedLead(lead) : false;
};

export const filterBookingsFromConfirmedLeads = (
    bookings: any[],
    index: LeadLookupIndex,
    db: any
): any[] => bookings.filter((booking) => isBookingFromConfirmedLeadIndexed(booking, index, db));

const parseBookingSortDate = (value?: string): number => {
    if (!value) return 0;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const getBookingIdSequence = (booking: any): number => {
    const idStr = String(booking?.id || '');
    const num = parseInt(idStr.split('-').pop() || '', 10);
    return Number.isNaN(num) ? 0 : num;
};

/** Resolve a comparable timestamp for booking list ordering (newest first). */
export const getBookingSortTimestamp = (
    booking: any,
    db: any,
    leadIndex?: LeadLookupIndex
): number => {
    const fromBooking =
        parseBookingSortDate(booking?.createdAt) || parseBookingSortDate(booking?.updatedAt);
    if (fromBooking) return fromBooking;

    const index = leadIndex || buildLeadLookupIndex(db?.leads?.data || []);
    const lead = findLeadForBookingIndexed(booking, index);
    const fromLead =
        parseBookingSortDate(lead?.createdAt) ||
        parseBookingSortDate(lead?.updatedAt) ||
        parseBookingSortDate(lead?.confirmedAt);
    if (fromLead) return fromLead;

    const quotations = db?.quotations?.data || [];
    const quote =
        (booking?.quoteId && quotations.find((q: any) => q.id === booking.quoteId)) ||
        (lead?.confirmedQuoteId &&
            quotations.find((q: any) => q.id === lead.confirmedQuoteId));
    const fromQuote =
        parseBookingSortDate(quote?.createdAt) ||
        parseBookingSortDate(quote?.updatedAt) ||
        parseBookingSortDate(quote?.date);
    if (fromQuote) return fromQuote;

    return getBookingIdSequence(booking);
};

/** Sort bookings with the latest entries first. */
export const sortBookingsNewestFirst = (
    bookings: any[],
    db: any,
    leadIndex?: LeadLookupIndex
): any[] => {
    const index = leadIndex || buildLeadLookupIndex(db?.leads?.data || []);
    const timestamps = new Map<string, number>();
    for (const booking of bookings) {
        if (booking?.id) {
            timestamps.set(booking.id, getBookingSortTimestamp(booking, db, index));
        }
    }
    return [...bookings].sort(
        (a, b) =>
            (timestamps.get(b.id) ?? getBookingSortTimestamp(b, db, index)) -
            (timestamps.get(a.id) ?? getBookingSortTimestamp(a, db, index))
    );
};

/** Resolve the owning agency id stored on a new/edited lead row. */
export const resolveLeadAgentId = (
    userRole: string | null | undefined,
    formAgentId: string,
    currentAgentId: string | null | undefined,
    db?: any,
    userEmail?: string | null
): string => {
    if (userRole === 'staff') {
        const staffMember = (db?.staff?.data || []).find(
            (member: any) =>
                normalizeAgencyEmail(member.employeeId) === normalizeAgencyEmail(userEmail) ||
                member.id === currentAgentId
        );
        if (staffMember?.createdByAgentId) {
            const creator = (db?.travelAgents?.data || []).find(
                (agent: any) => agent.id === staffMember.createdByAgentId
            );
            if (creator?.parentId) {
                return staffMember.createdByAgentId;
            }
        }
        return staffMember?.agentId || currentAgentId || formAgentId || '';
    }
    return formAgentId || currentAgentId || '';
};


/** Ids used to match row.createdById / assignee fields for the active session. */
export const getSessionScopeIds = (db: any, opts: SessionScopeOpts): string[] => {
    const sessionId = String(opts.sessionAgentId || '').trim();
    const email = normalizeAgencyEmail(opts.userEmail);

    if (opts.userRole === 'staff') {
        if (isSubAgencyAgentSession(sessionId, db)) {
            const ids = [...getAgentIdsForScope(db, sessionId)];
            const subAgent = (db?.travelAgents?.data || []).find((a: any) => a.id === sessionId);
            const loginEmail = agentPortalEmail(subAgent);
            if (loginEmail) ids.push(loginEmail);
            return [...new Set(ids.filter(Boolean))];
        }

        const staffMember = (db?.staff?.data || []).find(
            (member: any) =>
                normalizeAgencyEmail(member.employeeId) === email || member.id === sessionId
        );
        const ids = new Set<string>();
        if (email) ids.add(email);
        if (staffMember?.employeeId) ids.add(String(staffMember.employeeId));
        if (staffMember?.id) ids.add(String(staffMember.id));
        return [...ids];
    }

    if (opts.userRole === 'agent') {
        const ids = [...getAgentIdsForScope(db, sessionId)];
        const agent = (db?.travelAgents?.data || []).find((a: any) => a.id === sessionId);
        const loginEmail = agentPortalEmail(agent);
        if (loginEmail) ids.push(loginEmail);
        return [...new Set(ids.filter(Boolean))];
    }

    return [];
};

export const isStaffOwnRecordsOnly = (db: any, opts: SessionScopeOpts): boolean =>
    opts.userRole === 'staff' &&
    !isSubAgencyAgentSession(String(opts.sessionAgentId || '').trim(), db);

const scopeIdMatches = (value: unknown, scopeIds: string[]): boolean => {
    if (value == null || value === '') return false;
    const normalized = String(value).trim().toLowerCase();
    return scopeIds.some((id) => String(id).trim().toLowerCase() === normalized);
};

const findTravelAgentByStoredId = (db: any, storedId: unknown): any | null => {
    if (storedId == null || storedId === '') return null;
    const normalized = String(storedId).trim().toLowerCase();
    return (
        (db?.travelAgents?.data || []).find(
            (agent: any) =>
                String(agent.id || '').trim().toLowerCase() === normalized ||
                normalizeAgencyEmail(agent.email) === normalized ||
                normalizeAgencyEmail(agent.staffLoginId) === normalized ||
                agentPortalEmail(agent) === normalized
        ) || null
    );
};

/** Sub-agent sessions only see records created by them or their staff team. */
export const isSubAgentScopedSession = (db: any, opts: SessionScopeOpts): boolean => {
    const sessionId = String(opts.sessionAgentId || '').trim();
    if (!sessionId) return false;
    if (opts.userRole !== 'staff' && opts.userRole !== 'agent') return false;
    return isSubAgencyAgentSession(sessionId, db);
};

const recordCreatedInSubAgentScope = (
    record: any,
    db: any,
    scopeIds: string[]
): boolean => {
    if (!record?.createdById || !scopeIdMatches(record.createdById, scopeIds)) return false;

    if (record.createdByRole === 'admin' || record.createdByRole === 'agent') return false;

    if (record.createdByRole === 'staff') return true;

    const creatorAgent = findTravelAgentByStoredId(db, record.createdById);
    if (creatorAgent && !creatorAgent.parentId) return false;

    return true;
};

/** Filter leads, quotations, and bookings for the logged-in session. */
export const recordVisibleToSession = (
    table: string,
    row: any,
    db: any,
    opts: SessionScopeOpts
): boolean => {
    if (opts.userRole === 'admin') return true;
    if (table === 'leads' && isDemoSeedLead(row)) return false;
    if (table === 'bookings' && isDemoSeedBooking(row)) return false;
    if (table === 'quotations' && isDemoSeedQuotation(row)) return false;

    const scopeIds = getSessionScopeIds(db, opts);
    if (!scopeIds.length) return false;

    const staffOwnOnly = isStaffOwnRecordsOnly(db, opts);
    const subAgentScoped = isSubAgentScopedSession(db, opts);
    const leads = db?.leads?.data || [];

    const linkedLead =
        table === 'leads'
            ? row
            : table === 'quotations'
              ? leads.find((l: any) => l.id === row.leadId || l.name === row.customer)
              : table === 'bookings'
                ? findLeadForBooking(row, leads)
                : null;

    const matchesCreatorScope = (record: any) =>
        subAgentScoped
            ? recordCreatedInSubAgentScope(record, db, scopeIds)
            : scopeIdMatches(record?.createdById, scopeIds);

    if (linkedLead && matchesCreatorScope(linkedLead)) return true;
    if (matchesCreatorScope(row)) return true;

    if (table === 'bookings' && opts.userRole === 'staff') {
        const agencyId = String(opts.sessionAgentId || '').trim();
        if (agencyId && (row?.agentId === agencyId || linkedLead?.agentId === agencyId)) {
            return true;
        }
    }

    if (staffOwnOnly || subAgentScoped) return false;

    if (row?.agentId && scopeIds.includes(row.agentId)) return true;
    if (linkedLead?.agentId && scopeIds.includes(linkedLead.agentId)) return true;

    return false;
};

export const leadVisibleToUser = (
    lead: any,
    db: any,
    userRole: string | null | undefined,
    userEmail: string | null | undefined,
    currentAgentId: string | null | undefined
): boolean =>
    recordVisibleToSession('leads', lead, db, {
        userRole,
        userEmail,
        sessionAgentId: currentAgentId,
    });

/** Owning main agency id — walks sub-agent/staff assignee back to the parent agent. */
export const resolveMainAgencyAgentId = (
    agentId: string | null | undefined,
    db: any
): string => {
    const id = String(agentId || '').trim();
    if (!id) return '';

    const agent = (db?.travelAgents?.data || []).find((a: any) => a.id === id);
    if (agent?.parentId) return String(agent.parentId);

    const staff = (db?.staff?.data || []).find(
        (s: any) => s.employeeId === id || s.id === id
    );
    if (staff?.agentId) return String(staff.agentId);

    return id;
};

export const findAgencySettingsRecord = (db: any, ownerEmail?: string | null) => {
    const email = normalizeAgencyEmail(ownerEmail);
    if (!email) return null;
    return (
        (db?.settings?.data || []).find(
            (s: any) => normalizeAgencyEmail(s.email) === email
        ) || null
    );
};

export const resolveProfileTableForSession = (
    userRole: string | null | undefined,
    sessionType: SessionUserType | undefined
): 'settings' | 'staff' | 'travelAgents' | null => {
    if (userRole === 'admin') return 'settings';
    if (sessionType === 'staff') return 'staff';
    if (sessionType === 'subAgent' || sessionType === 'mainAgent') return 'travelAgents';
    return null;
};

export const resolveProfileLocationFromRecord = (
    record: any,
    sessionType: SessionUserType | undefined,
    db: any
): string => {
    if (!record) return 'Not Specified';

    const direct =
        String(record.address || '').trim() ||
        String(record.location || '').trim() ||
        String(record.businessAddress || '').trim() ||
        String(record.agencyAddress || '').trim();
    if (direct) return direct;

    if (sessionType === 'mainAgent') {
        const settings = findAgencySettingsRecord(
            db,
            record?.staffLoginId || record?.email
        );
        const fromSettings = String(settings?.agencyAddress || '').trim();
        if (fromSettings) return fromSettings;
    }

    return 'Not Specified';
};

export type ProfileSaveForm = {
    name: string;
    email: string;
    phone: string;
    location: string;
    avatar: string;
};

/** Build one or more profile patches for the logged-in session user. */
export const buildProfileSavePlan = (
    db: any,
    sessionUser: SessionUser | null,
    userRole: string | null | undefined,
    form: ProfileSaveForm
): Array<{ table: string; id: string; patch: Record<string, unknown> }> => {
    if (!sessionUser?.record?.id) return [];

    const recordId = String(sessionUser.record.id);
    const address = form.location.trim();

    if (userRole === 'admin') {
        return [
            {
                table: 'settings',
                id: recordId,
                patch: {
                    agencyName: form.name.trim(),
                    email: form.email.trim(),
                    agencyAddress: address,
                    avatar: form.avatar,
                },
            },
        ];
    }

    const table = resolveProfileTableForSession(userRole, sessionUser.type);
    if (!table) return [];

    const patch: Record<string, unknown> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address,
        location: address,
        avatar: form.avatar,
    };

    if (sessionUser.type === 'mainAgent' || sessionUser.type === 'subAgent') {
        patch.businessAddress = address;
    }

    const updates: Array<{ table: string; id: string; patch: Record<string, unknown> }> = [
        { table, id: recordId, patch },
    ];

    if (sessionUser.type === 'mainAgent') {
        const settings = findAgencySettingsRecord(
            db,
            sessionUser.record?.staffLoginId || sessionUser.record?.email
        );
        if (settings?.id) {
            updates.push({
                table: 'settings',
                id: String(settings.id),
                patch: { agencyAddress: address },
            });
        }
    }

    return updates;
};

/** Resolve the main agency travel-agent record for the active session. */
export const resolveMainAgencyAgent = (
    db: any,
    opts: { sessionAgentId?: string | null; userEmail?: string | null }
): any | null => {
    const agents = db?.travelAgents?.data || [];
    const sessionAgent = findTravelAgentForSession(agents, opts);

    if (sessionAgent?.parentId) {
        return agents.find((a: any) => a.id === sessionAgent.parentId) || sessionAgent;
    }
    if (sessionAgent) return sessionAgent;

    const email = normalizeAgencyEmail(opts.userEmail);
    if (email) {
        const staffMember = (db?.staff?.data || []).find(
            (member: any) => normalizeAgencyEmail(member.employeeId) === email
        );
        if (staffMember?.agentId) {
            const agencyId = resolveMainAgencyAgentId(staffMember.agentId, db);
            return agencyId ? agents.find((a: any) => a.id === agencyId) || null : null;
        }
    }

    const agencyId = resolveMainAgencyAgentId(opts.sessionAgentId, db);
    return agencyId ? agents.find((a: any) => a.id === agencyId) || null : null;
};

/** Agency name/logo for sidebar and documents. */
export const resolveAgencyBranding = (
    db: any,
    opts: {
        userRole?: string | null;
        userEmail?: string | null;
        sessionAgentId?: string | null;
    }
): AgencyBranding => {
    const fallbackName = 'Travel Agency CRM';
    const settingsList = db?.settings?.data || [];

    if (opts.userRole === 'admin') {
        const settings =
            findAgencySettingsRecord(db, opts.userEmail) || settingsList[0] || null;
        const name = settings?.agencyName || PLATFORM_NAME;
        return {
            name,
            logo: name.charAt(0).toUpperCase() || 'L',
            logoUrl: settings?.logoUrl || '',
            settings,
            mainAgent: null,
        };
    }

    const mainAgent = resolveMainAgencyAgent(db, {
        sessionAgentId: opts.sessionAgentId,
        userEmail: opts.userEmail,
    });

    const ownerEmail = mainAgent?.staffLoginId || mainAgent?.email || '';
    const settings = findAgencySettingsRecord(db, ownerEmail);
    const name =
        settings?.agencyName ||
        mainAgent?.businessName ||
        mainAgent?.name ||
        fallbackName;

    return {
        name,
        logo: name.charAt(0).toUpperCase() || 'T',
        logoUrl: settings?.logoUrl || mainAgent?.avatar || '',
        settings,
        mainAgent,
    };
};

export const PENDING_AGENT_ONBOARDING_KEY = 'pendingAgentOnboarding';

/** True only for brand-new main-agency signups that still need agency setup. */
export const agentRequiresOnboarding = (opts: {
    userRole: string | null | undefined;
    agentId?: string | null;
    userEmail?: string | null;
    db: any;
}): boolean => {
    if (opts.userRole !== 'agent') return false;

    const sessionAgent = findTravelAgentForSession(opts.db?.travelAgents?.data || [], {
        agentId: opts.agentId,
        userEmail: opts.userEmail,
    });

    if (isSubAgencyAgentSession(opts.agentId || sessionAgent?.id, opts.db)) return false;

    const mainAgent = resolveMainAgencyAgent(opts.db, {
        sessionAgentId: opts.agentId,
        userEmail: opts.userEmail,
    });
    const agencySettings = findAgencySettingsRecord(
        opts.db,
        mainAgent?.staffLoginId || mainAgent?.email
    );
    if (agencySettings) return false;

    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(PENDING_AGENT_ONBOARDING_KEY) === 'true';
};

export const isSubAgencyAgentSession = (
    sessionAgentId: string | null | undefined,
    db: any
): boolean => {
    const sessionId = String(sessionAgentId || '').trim();
    if (!sessionId) return false;
    const agent = (db?.travelAgents?.data || []).find((a: any) => a.id === sessionId);
    if (!agent) return false;
    if (agent.parentId) return true;
    const agencyId = resolveMainAgencyAgentId(sessionId, db);
    return !!agencyId && sessionId !== agencyId;
};

/** Agency Profile (/settings) — main agency owner or platform admin only. */
export const canManageAgencyProfile = (
    userRole: string | null | undefined,
    sessionAgentId: string | null | undefined,
    db: any
): boolean => {
    if (userRole === 'admin') return true;
    if (userRole !== 'agent') return false;
    const sessionId = String(sessionAgentId || '').trim();
    if (!sessionId) return false;
    return !isSubAgencyAgentSession(sessionId, db);
};

/** All travel-agent ids that belong to a main agency (owner + sub-agents). */
export const getAgencyTeamAgentIds = (
    db: any,
    agencyId: string | null | undefined
): Set<string> => {
    const rootId = String(agencyId || '').trim();
    const ids = new Set<string>();
    if (!rootId) return ids;

    ids.add(rootId);
    (db?.travelAgents?.data || []).forEach((agent: any) => {
        if (String(agent?.parentId || '') === rootId && agent?.id) {
            ids.add(String(agent.id));
        }
    });
    return ids;
};

/** Travel-agent id that should own newly created staff (main or sub-agent session). */
export const resolveStaffCreatorAgentId = (
    sessionAgentId: string | null | undefined,
    db: any
): string => {
    const sessionId = String(sessionAgentId || '').trim();
    if (!sessionId) return '';

    const travelAgent = (db?.travelAgents?.data || []).find((a: any) => a.id === sessionId);
    if (travelAgent?.id) return String(travelAgent.id);

    return '';
};

/** Staff visible in team management for the logged-in agent session. */
export const filterStaffForAgentSession = (
    staff: any[],
    sessionAgentId: string | null | undefined,
    db: any
): any[] => {
    const sessionId = String(sessionAgentId || '').trim();
    if (!sessionId) return [];

    const agencyId = resolveMainAgencyAgentId(sessionId, db);
    const teamIds = getAgencyTeamAgentIds(db, agencyId);

    if (isSubAgencyAgentSession(sessionId, db)) {
        return staff.filter((member) => {
            const creatorId = String(member?.createdByAgentId || '');
            if (creatorId === sessionId) return true;
            if (String(member?.agentId || '') === sessionId) return true;
            return false;
        });
    }

    return staff.filter((member) => {
        const agentId = String(member?.agentId || '');
        const creatorId = String(member?.createdByAgentId || '');
        if (agentId && teamIds.has(agentId)) return true;
        if (creatorId && teamIds.has(creatorId)) return true;
        return false;
    });
};

/** Whether the logged-in agent may edit or delete this staff member. */
export const canSessionManageStaffMember = (
    member: any,
    sessionAgentId: string | null | undefined,
    db: any
): boolean => {
    const sessionId = String(sessionAgentId || '').trim();
    if (!sessionId || !member) return false;

    const creatorId = String(member.createdByAgentId || '').trim();
    if (creatorId) return creatorId === sessionId;

    // Legacy rows created before createdByAgentId — treat as main-agency-owned staff
    if (!isSubAgencyAgentSession(sessionId, db)) {
        const agencyId = resolveMainAgencyAgentId(sessionId, db);
        return agencyId === sessionId && String(member.agentId || '') === agencyId;
    }

    return false;
};

/** Sub-agents visible to the logged-in agent session (main agent only). */
export const filterSubAgentsForAgentSession = (
    agents: any[],
    sessionAgentId: string | null | undefined,
    db: any
): any[] => {
    const sessionId = String(sessionAgentId || '').trim();
    if (!sessionId || isSubAgencyAgentSession(sessionId, db)) return [];

    const agencyId = resolveMainAgencyAgentId(sessionId, db);
    if (!agencyId) return [];

    return agents.filter(
        (agent) => String(agent?.parentId || '').trim() === String(agencyId).trim()
    );
};

/** Total staff accounts under a main agency (main agent + all sub-agents). */
export const countAgencyStaff = (
    db: any,
    sessionAgentId: string | null | undefined
): number => {
    const agencyId = resolveMainAgencyAgentId(sessionAgentId, db);
    if (!agencyId) return 0;

    const agencyTeamAgentIds = new Set<string>([agencyId]);
    (db?.travelAgents?.data || []).forEach((agent: any) => {
        if (agent.parentId === agencyId) agencyTeamAgentIds.add(agent.id);
    });

    return (db?.staff?.data || []).filter((member: any) => {
        if (String(member.agentId || '') === agencyId) return true;
        const creatorId = String(member.createdByAgentId || '');
        return creatorId !== '' && agencyTeamAgentIds.has(creatorId);
    }).length;
};

/** Total sub-agents under a main agency (display only — no plan cap). */
export const countAgencySubAgents = (
    db: any,
    sessionAgentId: string | null | undefined
): number => {
    const agencyId = resolveMainAgencyAgentId(sessionAgentId, db);
    if (!agencyId) return 0;
    return (db?.travelAgents?.data || []).filter(
        (agent: any) => agent.parentId === agencyId
    ).length;
};

/** Staff and sub-agent slots are always unlimited. */
export const getAgencyPlanLimits = (
    db: any,
    sessionAgentId: string | null | undefined
): { planName: string; staff: number; subAgents: number } => {
    const mainAgent = resolveMainAgencyAgent(db, { sessionAgentId: sessionAgentId || '' });
    const planName = mainAgent?.plan || 'Lite';

    return {
        planName,
        staff: 9999,
        subAgents: 9999,
    };
};

/** Staff slots are unlimited (same as sub-agents). */
export const canAddAgencyStaff = (
    _db: any,
    _sessionAgentId: string | null | undefined
): { allowed: boolean; message?: string } => ({ allowed: true });

export const canAddAgencySubAgent = (
    _db: any,
    _sessionAgentId: string | null | undefined
): { allowed: boolean; message?: string } => ({ allowed: true });

/** Normalize sub-agent rows so they always bill against the main agency. */
export const normalizeSubAgentRecordForAgency = (
    record: Record<string, unknown>,
    db: any,
    sessionAgentId: string | null | undefined
): Record<string, unknown> => {
    const agencyId = resolveMainAgencyAgentId(sessionAgentId, db);
    const parentId = String(record?.parentId ?? '').trim();
    if (!agencyId || !parentId) return record;
    return { ...record, parentId: agencyId };
};

/** Normalize staff rows so agency-wide limits always apply correctly. */
export const normalizeStaffRecordForAgency = (
    record: Record<string, unknown>,
    db: any,
    sessionAgentId: string | null | undefined
): Record<string, unknown> => {
    const agencyId = resolveMainAgencyAgentId(sessionAgentId, db);
    if (!agencyId) return record;

    const sessionCreatorId = resolveStaffCreatorAgentId(sessionAgentId, db);
    const explicitCreator = String(record.createdByAgentId || '').trim();
    const createdByAgentId = explicitCreator || sessionCreatorId || agencyId;

    return {
        ...record,
        agentId: agencyId,
        createdByAgentId,
    };
};

/** Confirmed/completed bookings are editable only by the main agency agent (or admin). */
export const canUserEditConfirmedBooking = (
    userRole: string | null | undefined,
    currentAgentId: string | null | undefined,
    db: any,
    booking: any,
    linkedLead?: any
): boolean => {
    const lead = linkedLead || findLeadForBooking(booking, db?.leads?.data || []);
    const status = getBookingDisplayStatus(booking, lead);
    const isLockedStage = CONFIRMED_LEAD_STATUSES.has(String(status).toLowerCase());

    if (!isLockedStage) return true;
    if (userRole === 'admin') return true;

    const mainAgentId = resolveMainAgencyAgentId(
        lead?.agentId || booking?.agentId || '',
        db
    );
    if (!mainAgentId || !currentAgentId) return false;
    if (userRole === 'staff') return false;

    const sessionAgent = (db?.travelAgents?.data || []).find(
        (a: any) => a.id === currentAgentId
    );
    if (sessionAgent?.parentId) return false;

    return currentAgentId === mainAgentId;
};

export const getAgentIdsForScope = (db: any, currentAgentId: string): string[] => {
    if (!currentAgentId) return [];
    const staffEmployeeIds = filterStaffForAgentSession(
        db?.staff?.data || [],
        currentAgentId,
        db
    )
        .map((s: any) => s.employeeId)
        .filter(Boolean);
    const subAgentIds = isSubAgencyAgentSession(currentAgentId, db)
        ? []
        : (db.travelAgents?.data || [])
              .filter((a: any) => a.parentId === currentAgentId)
              .map((a: any) => a.id);
    return [currentAgentId, ...staffEmployeeIds, ...subAgentIds];
};

export const recordBelongsToAgent = (
    table: string,
    row: any,
    db: any,
    currentAgentId: string
): boolean => {
    const teamIds = [...getAgentIdsForScope(db, currentAgentId)];
    const subAgentScoped = isSubAgencyAgentSession(currentAgentId, db);
    if (subAgentScoped) {
        const subAgent = (db?.travelAgents?.data || []).find((a: any) => a.id === currentAgentId);
        const loginEmail = agentPortalEmail(subAgent);
        if (loginEmail) teamIds.push(loginEmail);
    }
    const scopeIds = [...new Set(teamIds.filter(Boolean))];
    const leads = db.leads?.data || [];

    const matchesTeamCreator = (record: any) => {
        if (!record) return false;
        if (subAgentScoped) {
            return recordCreatedInSubAgentScope(record, db, scopeIds);
        }
        return !!record.createdById && scopeIds.includes(record.createdById);
    };

    if (matchesTeamCreator(row)) return true;

    if (table === 'bookings') {
        const linkedLead = findLeadForBooking(row, leads);
        if (linkedLead && matchesTeamCreator(linkedLead)) return true;
        if (subAgentScoped) return false;
        return linkedLead ? scopeIds.includes(linkedLead.agentId) : false;
    }

    if (table === 'quotations') {
        const linkedLead = leads.find((l: any) =>
            l.id === row.leadId || l.name === row.customer
        );
        if (linkedLead && matchesTeamCreator(linkedLead)) return true;
        if (subAgentScoped) return false;
        if (linkedLead?.agentId && scopeIds.includes(linkedLead.agentId)) return true;
        return false;
    }

    if (table === 'leads') {
        if (subAgentScoped) return false;
        if (scopeIds.includes(row.agentId)) return true;
        return false;
    }

    return false;
};

export const getAgentFieldsFromLead = (lead: any) => ({
    agentId: lead.agentId,
    agentName: lead.agentName,
    leadId: lead.id,
});

const portfolioIdMatches = (value: unknown, filterIds: string[]): boolean => {
    if (value == null || value === '') return false;
    const normalized = String(value).trim().toLowerCase();
    return filterIds.some((id) => String(id).trim().toLowerCase() === normalized);
};

/** True when a staff member or travel agent has created at least one lead. */
export const memberHasLeadActivity = (
    member: any,
    memberType: 'staff' | 'travelAgent',
    leads: any[],
    db: any
): boolean => {
    const ids =
        memberType === 'staff'
            ? [member.employeeId, member.id].filter(Boolean)
            : [member.id, member.email, member.staffLoginId, agentPortalEmail(member)].filter(
                  Boolean
              );

    const hasOwnLead = leads.some((lead: any) => {
        if (portfolioIdMatches(lead?.createdById, ids)) return true;
        if (
            memberType === 'staff' &&
            lead?.createdByName &&
            String(lead.createdByName).trim().toLowerCase() ===
                String(member.name || '').trim().toLowerCase()
        ) {
            return true;
        }
        return false;
    });
    if (hasOwnLead) return true;

    if (memberType === 'travelAgent' && member.parentId) {
        const teamStaffIds = (db?.staff?.data || [])
            .filter((staff: any) => staff.createdByAgentId === member.id)
            .flatMap((staff: any) => [staff.employeeId, staff.id].filter(Boolean));
        return leads.some((lead: any) => portfolioIdMatches(lead?.createdById, teamStaffIds));
    }

    return false;
};

/** Staff with at least one created lead (plus optional always-visible ids). */
export const filterStaffWithLeadActivity = (
    staff: any[],
    sessionAgentId: string | null | undefined,
    db: any,
    leads: any[] = [],
    options?: { includeMemberIds?: string[] }
): any[] => {
    const visible = filterStaffForAgentSession(staff, sessionAgentId, db);
    const includeIds = (options?.includeMemberIds || []).map((id) => String(id).toLowerCase());

    return visible.filter((member) => {
        if (
            includeIds.includes(String(member.employeeId || '').toLowerCase()) ||
            includeIds.includes(String(member.id || '').toLowerCase())
        ) {
            return true;
        }
        return memberHasLeadActivity(member, 'staff', leads, db);
    });
};

/** Sub-agents with lead activity on their own account or their staff team. */
export const filterSubAgentsWithLeadActivity = (
    agents: any[],
    sessionAgentId: string | null | undefined,
    db: any,
    leads: any[] = [],
    options?: { includeMemberIds?: string[] }
): any[] => {
    const visible = filterSubAgentsForAgentSession(agents, sessionAgentId, db);
    const includeIds = (options?.includeMemberIds || []).map((id) => String(id).toLowerCase());

    return visible.filter((agent) => {
        if (includeIds.includes(String(agent.id || '').toLowerCase())) return true;
        return memberHasLeadActivity(agent, 'travelAgent', leads, db);
    });
};

/** Travel agents (admin views) that have created at least one lead. */
export const filterTravelAgentsWithLeadActivity = (
    agents: any[],
    leads: any[] = [],
    db: any,
    options?: { includeMemberIds?: string[] }
): any[] => {
    const includeIds = (options?.includeMemberIds || []).map((id) => String(id).toLowerCase());

    return agents.filter((agent) => {
        if (includeIds.includes(String(agent.id || '').toLowerCase())) return true;
        return memberHasLeadActivity(agent, 'travelAgent', leads, db);
    });
};

/** Collect ids/emails that identify an Agent Portfolio filter selection. */
export const resolvePortfolioFilterIds = (agentFilter: string, db: any): string[] => {
    const ids = new Set<string>();
    const add = (value: unknown) => {
        const next = String(value || '').trim();
        if (next) ids.add(next);
    };

    add(agentFilter);

    const travelAgent = (db?.travelAgents?.data || []).find((a: any) => a.id === agentFilter);
    if (travelAgent) {
        add(travelAgent.id);
        add(travelAgent.email);
        add(travelAgent.staffLoginId);
        add(agentPortalEmail(travelAgent));
    }

    const staffMember = (db?.staff?.data || []).find(
        (s: any) => s.employeeId === agentFilter || s.id === agentFilter
    );
    if (staffMember) {
        add(staffMember.employeeId);
        add(staffMember.id);
    }

    return [...ids];
};

const findLinkedLeadForPortfolio = (table: string, row: any, leads: any[]): any | null => {
    if (table === 'leads') return row;
    if (table === 'quotations') {
        return leads.find((l: any) => l.id === row.leadId || l.name === row.customer) || null;
    }
    if (table === 'bookings') {
        return findLeadForBooking(row, leads);
    }
    return null;
};

const getStaffCreatorIdsForAgentFilter = (agentFilter: string, db: any): string[] => {
    const agent = (db?.travelAgents?.data || []).find((a: any) => a.id === agentFilter);
    if (!agent?.parentId) return [];

    return (db?.staff?.data || [])
        .filter((s: any) => s.createdByAgentId === agent.id)
        .flatMap((s: any) => [s.employeeId, s.id].filter(Boolean));
};

const isStaffCreatorId = (createdById: unknown, db: any): boolean => {
    if (!createdById) return false;
    const normalized = String(createdById).trim().toLowerCase();
    return (db?.staff?.data || []).some(
        (s: any) =>
            String(s.employeeId || '').trim().toLowerCase() === normalized ||
            String(s.id || '').trim().toLowerCase() === normalized
    );
};

/** Resolve createdById for new leads/quotes from the active session. */
export const resolveRecordCreatedById = (opts: {
    formAgentId?: string;
    userRole?: string | null;
    userEmail?: string | null;
    sessionAgentId?: string | null;
    db?: any;
}): string => {
    if (opts.formAgentId) return opts.formAgentId;

    if (opts.userRole === 'staff') {
        const email = normalizeAgencyEmail(opts.userEmail);
        if (email) return email;
        const staffMember = (opts.db?.staff?.data || []).find(
            (s: any) =>
                s.id === opts.sessionAgentId ||
                normalizeAgencyEmail(s.employeeId) === email
        );
        return staffMember?.employeeId || opts.sessionAgentId || '';
    }

    if (opts.userRole === 'agent' && opts.db) {
        const agent = (opts.db?.travelAgents?.data || []).find(
            (a: any) => a.id === opts.sessionAgentId
        );
        return agentPortalEmail(agent) || opts.sessionAgentId || '';
    }

    return opts.sessionAgentId || '';
};

/** Map stored lead ownership to the Assign-to-Team-Member select value. */
export const resolveLeadAssigneeFormValue = (lead: any, db: any): string => {
    if (!lead) return '';

    const matchesStoredId = (value: unknown, candidates: string[]): boolean => {
        if (value == null || value === '') return false;
        const normalized = String(value).trim().toLowerCase();
        return candidates.some((candidate) => String(candidate).trim().toLowerCase() === normalized);
    };

    if (lead.createdById) {
        const staffMember = (db?.staff?.data || []).find((member: any) =>
            matchesStoredId(lead.createdById, [member.employeeId, member.id].filter(Boolean))
        );
        if (staffMember) return staffMember.employeeId;

        const travelAgent = (db?.travelAgents?.data || []).find((agent: any) =>
            matchesStoredId(lead.createdById, [
                agent.id,
                agent.email,
                agent.staffLoginId,
                agentPortalEmail(agent),
            ].filter(Boolean))
        );
        if (travelAgent) {
            return travelAgent.parentId ? travelAgent.id : '';
        }
    }

    if (lead.createdByName) {
        const namedStaff = (db?.staff?.data || []).find(
            (member: any) =>
                String(member.name || '').trim().toLowerCase() ===
                String(lead.createdByName).trim().toLowerCase()
        );
        if (namedStaff) return namedStaff.employeeId;

        const namedAgent = (db?.travelAgents?.data || []).find(
            (agent: any) =>
                String(agent.name || '').trim().toLowerCase() ===
                    String(lead.createdByName).trim().toLowerCase() ||
                String(agent.businessName || '').trim().toLowerCase() ===
                    String(lead.createdByName).trim().toLowerCase()
        );
        if (namedAgent) {
            return namedAgent.parentId ? namedAgent.id : '';
        }
    }

    if (lead.agentId) {
        const ownerAgent = (db?.travelAgents?.data || []).find(
            (agent: any) => agent.id === lead.agentId
        );
        if (ownerAgent?.parentId) return ownerAgent.id;
        if (ownerAgent && !ownerAgent.parentId) return '';
    }

    return '';
};

/** Sidebar portfolio filter for leads, quotations, and bookings. */
export const recordMatchesAgentPortfolio = (
    table: string,
    row: any,
    agentFilter: string,
    db: any
): boolean => {
    if (!agentFilter || agentFilter === 'all') return true;

    const filterIds = resolvePortfolioFilterIds(agentFilter, db);
    const leads = db?.leads?.data || [];
    const linkedLead = findLinkedLeadForPortfolio(table, row, leads);

    const matchesRow = (record: any) =>
        portfolioIdMatches(record?.agentId, filterIds) ||
        portfolioIdMatches(record?.createdById, filterIds);

    if (matchesRow(row)) return true;
    if (linkedLead && matchesRow(linkedLead)) return true;

    const staffMember = (db?.staff?.data || []).find(
        (s: any) =>
            portfolioIdMatches(s.employeeId, filterIds) || portfolioIdMatches(s.id, filterIds)
    );
    if (staffMember) {
        const staffIds = [staffMember.employeeId, staffMember.id].filter(Boolean);
        if (portfolioIdMatches(row?.createdById, staffIds)) return true;
        if (portfolioIdMatches(linkedLead?.createdById, staffIds)) return true;
        if (portfolioIdMatches(row?.agentId, staffIds)) return true;
        return false;
    }

    const travelAgent = (db?.travelAgents?.data || []).find((a: any) =>
        portfolioIdMatches(a.id, filterIds)
    );
    if (!travelAgent) return false;

    if (travelAgent.parentId) {
        const teamStaffIds = getStaffCreatorIdsForAgentFilter(agentFilter, db);
        if (portfolioIdMatches(row?.createdById, teamStaffIds)) return true;
        if (portfolioIdMatches(linkedLead?.createdById, teamStaffIds)) return true;
        if (portfolioIdMatches(row?.agentId, filterIds)) return true;
        if (portfolioIdMatches(linkedLead?.agentId, filterIds)) return true;
        return false;
    }

    const createdById = linkedLead?.createdById || row?.createdById;
    if (createdById && isStaffCreatorId(createdById, db)) return false;

    if (portfolioIdMatches(row?.agentId, filterIds)) return true;
    if (portfolioIdMatches(linkedLead?.agentId, filterIds)) return true;
    if (portfolioIdMatches(createdById, filterIds)) return true;

    if (!createdById && portfolioIdMatches(linkedLead?.agentId, filterIds)) return true;
    if (!createdById && !linkedLead && portfolioIdMatches(row?.agentId, filterIds)) return true;

    return false;
};

export const leadMatchesAgentPortfolio = (
    lead: any,
    agentFilter: string,
    db: any
): boolean => recordMatchesAgentPortfolio('leads', lead, agentFilter, db);

/** Sidebar portfolio filter: match quote assignee or linked lead owner. */
export const quoteMatchesAgentPortfolio = (
    quote: any,
    agentFilter: string,
    db: any
): boolean => recordMatchesAgentPortfolio('quotations', quote, agentFilter, db);

/** Create or update the booking row when a lead package is confirmed. */
export const ensureBookingForConfirmedLead = (
    db: any,
    addRecord: (table: string, record: any) => void,
    updateRecord: (table: string, id: string, patch: any) => void,
    getNextId: (table: string, prefix: string) => string,
    lead: any,
    confirmedQuoteId?: string
) => {
    if (!lead?.id || !isConfirmedLead(lead)) return null;

    const bookings = db?.bookings?.data || [];
    const quoteId = confirmedQuoteId || lead.confirmedQuoteId;
    const quote =
        quoteId && (db?.quotations?.data || []).find((q: any) => q.id === quoteId);

    if (!quote) return null;

    const linked = findBookingForLead(lead, bookings, quoteId);
    const bookingStatus = getBookingPipelineStatus(lead);
    const budgetFormatted = getUnifiedBudgetForLead(
        { ...lead, confirmedQuoteId: quoteId || lead.confirmedQuoteId },
        db
    );
    const bookingPackage = quote?.destination || lead.destination || 'Custom Package';
    const bookingDates = quote?.departureDate
        ? `${new Date(quote.departureDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
          })} onwards`
        : lead.dates || 'Dates TBD';
    const bookingTotal = quote ? getUnifiedBudgetForQuote(quote, db) : budgetFormatted;

    const bookingFields = {
        trackingId: lead.trackingId || lead.tripId || linked?.trackingId || '',
        customer: lead.name,
        package: bookingPackage,
        dates: bookingDates,
        total: bookingTotal,
        travelers: quote?.travelers || lead.travelers || '2 Adults',
        presetId: quote?.presetId || lead.presetId || linked?.presetId || '',
        quoteId: quote?.id || quoteId || linked?.quoteId || '',
        email: lead.email || '',
        phone: lead.phone || '',
        sourceCountry: lead.sourceCountry || linked?.sourceCountry || '',
        sourceAirport: lead.sourceAirport || linked?.sourceAirport || '',
        source: lead.source || linked?.source || '',
        agentId: lead.agentId || linked?.agentId || '',
        agentName: lead.agentName || linked?.agentName || '',
        leadId: lead.id,
        status: bookingStatus,
        paymentStatus: linked?.paymentStatus || 'unpaid',
        paid: linked?.paid ?? 0,
        nextDue: linked?.nextDue || '-',
    };

    if (linked) {
        updateRecord('bookings', linked.id, bookingFields);
        if (lead.bookingId !== linked.id) {
            updateRecord('leads', lead.id, { bookingId: linked.id });
        }
        return { ...linked, ...bookingFields };
    }

    const nextBookingId = getNextId('bookings', 'BK');
    const newBooking = {
        id: nextBookingId,
        createdAt: new Date().toISOString(),
        ...bookingFields,
    };
    addRecord('bookings', newBooking);
    updateRecord('leads', lead.id, { bookingId: nextBookingId });
    return newBooking;
};

/** After a lead is confirmed, create/update booking and align quotation status. */
export const syncConfirmedLeadBookingStatus = (
    db: any,
    updateRecord: (table: string, id: string, patch: any) => void,
    lead: any,
    confirmedQuoteId?: string,
    addRecord?: (table: string, record: any) => void,
    getNextId?: (table: string, prefix: string) => string
) => {
    if (!lead || !isConfirmedLead(lead)) return;

    const quoteId = confirmedQuoteId || lead.confirmedQuoteId;
    const quote = quoteId
        ? (db?.quotations?.data || []).find((q: any) => q.id === quoteId)
        : null;
    if (!quote) return;

    if (addRecord && getNextId) {
        ensureBookingForConfirmedLead(db, addRecord, updateRecord, getNextId, lead, confirmedQuoteId);
    }

    if (quoteId) {
        if (quote) {
            const quotePatch: Record<string, unknown> = {};
            if (quote.status !== 'confirmed') quotePatch.status = 'confirmed';
            if (lead.id && quote.leadId !== lead.id) quotePatch.leadId = lead.id;
            if (Object.keys(quotePatch).length > 0) {
                updateRecord('quotations', quoteId, quotePatch);
            }
        }
    }
};

export type TripCancellationPayload = {
    reason: string;
    contactReminderOn?: string;
    notes?: string;
    canceledAt?: string;
};

export const buildTripCancellationMeta = (payload: TripCancellationPayload) => ({
    cancellationReason: payload.reason,
    cancellationNotes: payload.notes || '',
    contactReminderOn: payload.contactReminderOn || '',
    canceledAt: payload.canceledAt || new Date().toISOString(),
});

/** Build lead schedule fields from a quote's departure date and duration. */
export const buildLeadScheduleFromQuote = (quote: {
    departureDate?: string | null;
    duration?: string | null;
}): { startDate?: string; dates?: string; duration?: string } => {
    const departureDate = String(quote?.departureDate || '').trim();
    if (!departureDate) return {};

    const startDate = new Date(`${departureDate}T12:00:00`);
    if (isNaN(startDate.getTime())) return {};

    const duration = String(quote?.duration || '').trim();
    const nights = parseDurationNights(duration || undefined);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + nights);

    const datesFormatted = `${startDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    return {
        startDate: departureDate,
        dates: datesFormatted,
        ...(duration ? { duration } : {}),
    };
};

export const buildLeadCancellationPatch = (payload: TripCancellationPayload) => ({
    status: 'canceled',
    ...buildTripCancellationMeta(payload),
});

export const buildBookingCancellationPatch = (payload: TripCancellationPayload) => ({
    status: 'canceled',
    ...buildTripCancellationMeta(payload),
});

/** Mark booking finance as refunded and zero out collected amounts when a trip is canceled. */
export const buildBookingCancellationPaymentPatch = (booking: any, db: any) =>
    buildBookingPaymentPatch(booking, db, 'refunded');

export const buildFullBookingCancellationPatch = (
    booking: any,
    db: any,
    payload: TripCancellationPayload
) => ({
    ...buildBookingCancellationPatch(payload),
    ...buildBookingCancellationPaymentPatch(booking, db),
});

export const applyTripCancellation = (
    db: any,
    updateRecord: (table: string, id: string, patch: any) => void,
    opts: {
        leadId?: string;
        bookingId?: string;
        customerName?: string;
        payload: TripCancellationPayload;
    }
) => {
    const meta = buildTripCancellationMeta(opts.payload);
    const leadPatch = buildLeadCancellationPatch(opts.payload);
    const leads = db?.leads?.data || [];
    const bookings = db?.bookings?.data || [];
    const quotations = db?.quotations?.data || [];

    const cancelBooking = (booking: any) => {
        updateRecord(
            'bookings',
            booking.id,
            buildFullBookingCancellationPatch(booking, db, opts.payload)
        );
    };

    let lead =
        (opts.leadId && leads.find((l: any) => l.id === opts.leadId)) ||
        (opts.customerName && leads.find((l: any) => l.name === opts.customerName)) ||
        undefined;

    if (opts.bookingId) {
        const booking = bookings.find((b: any) => b.id === opts.bookingId);
        if (booking) {
            cancelBooking(booking);
            if (!lead) {
                lead = findLeadForBooking(booking, leads);
            }
        }
    }

    if (lead) {
        updateRecord('leads', lead.id, leadPatch);
        const linkedQuotes = quotations.filter(
            (q: any) => q.leadId === lead.id || q.customer === lead.name
        );
        linkedQuotes.forEach((q: any) => {
            updateRecord('quotations', q.id, { status: 'canceled', ...meta });
        });
        const linkedBooking =
            bookings.find((b: any) => b.id === lead.bookingId) ||
            bookings.find((b: any) => b.leadId === lead.id || b.customer === lead.name);
        if (linkedBooking && linkedBooking.id !== opts.bookingId) {
            cancelBooking(linkedBooking);
        }
    }
};

export const ensureCustomerRecord = (
    db: any,
    addRecord: (table: string, record: any) => void,
    getNextId: (table: string, prefix: string) => string,
    lead: { name: string; email?: string; phone?: string }
) => {
    const existing = (db.customers?.data || []).find((c: any) => c.name === lead.name);
    if (existing) return;

    const nextId = getNextId('customers', 'CUST');
    addRecord('customers', {
        id: nextId,
        name: lead.name,
        email: lead.email || '',
        phone: lead.phone || '',
        totalBookings: 0,
        bookings: '0',
    });
};
