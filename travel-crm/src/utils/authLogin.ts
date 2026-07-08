import { isAgentSubscriptionExpired } from './agentPlan';
import { findSessionUser, resolveMainAgencyAgentId, SESSION_USER_ID_KEY } from './databaseSync';

export { SESSION_USER_ID_KEY };

export const normalizeLoginEmail = (value: string | null | undefined): string =>
    String(value || '').trim().toLowerCase();

export const normalizeLoginPassword = (value: string | null | undefined): string =>
    String(value || '').trim();

export const agentLoginEmail = (agent: any): string =>
    normalizeLoginEmail(agent?.staffLoginId || agent?.email || '');

export const passwordsMatch = (stored: unknown, entered: string): boolean =>
    normalizeLoginPassword(String(stored ?? '')) === normalizeLoginPassword(entered);

export const PLAN_EXPIRED_LOGIN_MESSAGE =
    'Your plan is expired. Please renew it or purchase a plan to continue use of CRM.';

export const ACCOUNT_DISABLED_LOGIN_MESSAGE =
    'Your account has been disabled. Please contact your administrator.';

export const AGENCY_DISABLED_LOGIN_MESSAGE =
    'Your agency account has been disabled. Please contact support.';

export const LOGIN_BLOCK_REASON_KEY = 'login_block_reason';

/** Stable CRM record id for the logged-in user (STF-xxx, AGT-xxx, or settings id). */
export const getStoredSessionUserId = (): string => {
    if (typeof localStorage === 'undefined') return '';
    return String(localStorage.getItem(SESSION_USER_ID_KEY) || '').trim();
};

export const setStoredSessionUserId = (id: string) => {
    if (typeof localStorage === 'undefined' || !id) return;
    localStorage.setItem(SESSION_USER_ID_KEY, id);
};

export const clearStoredSessionUserId = () => {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(SESSION_USER_ID_KEY);
};

export const getSessionScopeFromStorage = () => ({
    userRole: typeof localStorage !== 'undefined' ? localStorage.getItem('userRole') : null,
    userEmail: typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : null,
    sessionAgentId: typeof localStorage !== 'undefined' ? localStorage.getItem('agentId') : null,
    sessionUserId: getStoredSessionUserId() || null,
});

const agentsDbShape = (agents: any[]) => ({ travelAgents: { data: agents } });

/** Block portal login when the billing main agency subscription has expired. */
export const getPlanExpiryLoginBlockReason = (
    agents: any[] = [],
    sessionAgentId?: string | null
): string | null => {
    const billingAgentId = resolveMainAgencyAgentId(sessionAgentId, agentsDbShape(agents));
    if (!billingAgentId) return null;

    const billingAgent = agents.find((agent) => agent.id === billingAgentId);
    if (isAgentSubscriptionExpired(billingAgent)) {
        return PLAN_EXPIRED_LOGIN_MESSAGE;
    }

    return null;
};

export const isAgentPortalLoginAllowed = (agent: any): boolean => {
    const status = String(agent?.status || 'approved').toLowerCase();
    return status !== 'disabled' && status !== 'rejected';
};

const isStaffPortalLoginAllowed = (member: any): boolean =>
    String(member?.status || 'active').toLowerCase() === 'active';

const findMainAgencyRecord = (db: any, agentId?: string | null) => {
    const agents = db?.travelAgents?.data || [];
    const mainAgentId = resolveMainAgencyAgentId(agentId, db);
    return mainAgentId ? agents.find((agent: any) => agent.id === mainAgentId) || null : null;
};

/** Block active sessions when the user or owning agency has been disabled. */
export const getDisabledSessionBlockReason = (
    db: any,
    opts: {
        userRole?: string | null;
        userEmail?: string | null;
        sessionAgentId?: string | null;
        sessionUserId?: string | null;
    }
): string | null => {
    if (opts.userRole === 'admin') return null;

    const sessionUser = findSessionUser(db, {
        userRole: opts.userRole,
        userEmail: opts.userEmail,
        sessionAgentId: opts.sessionAgentId,
        sessionUserId: opts.sessionUserId || getStoredSessionUserId(),
    });

    if (sessionUser?.type === 'mainAgent') {
        return isAgentPortalLoginAllowed(sessionUser.record)
            ? null
            : ACCOUNT_DISABLED_LOGIN_MESSAGE;
    }

    if (sessionUser?.type === 'subAgent') {
        if (!isAgentPortalLoginAllowed(sessionUser.record)) {
            return ACCOUNT_DISABLED_LOGIN_MESSAGE;
        }
        const mainAgent = findMainAgencyRecord(db, sessionUser.record.id);
        if (mainAgent && !isAgentPortalLoginAllowed(mainAgent)) {
            return AGENCY_DISABLED_LOGIN_MESSAGE;
        }
        return null;
    }

    if (sessionUser?.type === 'staff') {
        if (!isStaffPortalLoginAllowed(sessionUser.record)) {
            return ACCOUNT_DISABLED_LOGIN_MESSAGE;
        }
        const mainAgent = findMainAgencyRecord(db, sessionUser.record.agentId);
        if (mainAgent && !isAgentPortalLoginAllowed(mainAgent)) {
            return AGENCY_DISABLED_LOGIN_MESSAGE;
        }
        return null;
    }

    if (opts.userRole === 'agent' && opts.sessionAgentId) {
        const agents = db?.travelAgents?.data || [];
        const agent = agents.find((record: any) => record.id === opts.sessionAgentId);
        if (agent && !isAgentPortalLoginAllowed(agent)) {
            return ACCOUNT_DISABLED_LOGIN_MESSAGE;
        }
    }

    return null;
};

/** Combined guard for live sessions: disabled account first, then expired plan. */
export const getSessionAccessBlockReason = (
    db: any,
    opts: {
        userRole?: string | null;
        userEmail?: string | null;
        sessionAgentId?: string | null;
        sessionUserId?: string | null;
    }
): string | null => {
    const disabledReason = getDisabledSessionBlockReason(db, opts);
    if (disabledReason) return disabledReason;

    const agents = db?.travelAgents?.data || [];
    return getPlanExpiryLoginBlockReason(agents, opts.sessionAgentId);
};

export const getDisabledLoginBlockReason = (
    agents: any[] = [],
    email: string,
    password: string
): string | null => {
    const cleanEmail = normalizeLoginEmail(email);
    const cleanPassword = normalizeLoginPassword(password);
    if (!cleanEmail || !cleanPassword) return null;

    const disabledAgent = agents.find((agent: any) => {
        if (isAgentPortalLoginAllowed(agent)) return false;
        if (agentLoginEmail(agent) !== cleanEmail) return false;
        return passwordsMatch(agent?.password, cleanPassword);
    });

    return disabledAgent ? ACCOUNT_DISABLED_LOGIN_MESSAGE : null;
};

export const getDisabledStaffLoginBlockReason = (
    agents: any[] = [],
    staff: any[] = [],
    loginId: string,
    password: string
): string | null => {
    const cleanId = normalizeLoginEmail(loginId);
    const cleanPassword = normalizeLoginPassword(password);
    if (!cleanId || !cleanPassword) return null;

    const disabledStaff = staff.find((member: any) => {
        if (isStaffPortalLoginAllowed(member)) return false;
        return (
            normalizeLoginEmail(member?.employeeId || '') === cleanId &&
            passwordsMatch(member?.password, cleanPassword)
        );
    });
    if (disabledStaff) return ACCOUNT_DISABLED_LOGIN_MESSAGE;

    const disabledSubAgent = agents.find((agent: any) => {
        if (!agent?.parentId || isAgentPortalLoginAllowed(agent)) return false;
        return agentLoginEmail(agent) === cleanId && passwordsMatch(agent?.password, cleanPassword);
    });
    if (disabledSubAgent) return ACCOUNT_DISABLED_LOGIN_MESSAGE;

    const disabledMainAgent = agents.find((agent: any) => {
        if (agent?.parentId || isAgentPortalLoginAllowed(agent)) return false;
        return agentLoginEmail(agent) === cleanId && passwordsMatch(agent?.password, cleanPassword);
    });
    if (disabledMainAgent) return ACCOUNT_DISABLED_LOGIN_MESSAGE;

    return null;
};

export const getAgencyDisabledLoginBlockReason = (
    db: any,
    sessionAgentId?: string | null
): string | null => {
    const mainAgent = findMainAgencyRecord(db, sessionAgentId);
    if (mainAgent && !isAgentPortalLoginAllowed(mainAgent)) {
        return AGENCY_DISABLED_LOGIN_MESSAGE;
    }
    return null;
};

/** Match main agency agents and sub-agents by email (or staff login id) + password. */
export const findTravelAgentByCredentials = (
    agents: any[] = [],
    email: string,
    password: string
): any | undefined => {
    const cleanEmail = normalizeLoginEmail(email);
    const cleanPassword = normalizeLoginPassword(password);
    if (!cleanEmail || !cleanPassword) return undefined;

    return agents.find((agent: any) => {
        if (!isAgentPortalLoginAllowed(agent)) return false;
        if (agentLoginEmail(agent) !== cleanEmail) return false;
        return passwordsMatch(agent?.password, cleanPassword);
    });
};

export const findStaffMemberByCredentials = (
    staff: any[] = [],
    loginId: string,
    password: string
): any | undefined => {
    const cleanId = normalizeLoginEmail(loginId);
    const cleanPassword = normalizeLoginPassword(password);
    if (!cleanId || !cleanPassword) return undefined;

    return staff.find((member: any) => {
        if (String(member?.status || 'active').toLowerCase() !== 'active') return false;
        return (
            normalizeLoginEmail(member?.employeeId || '') === cleanId &&
            passwordsMatch(member?.password, cleanPassword)
        );
    });
};

/** Sub-agents created by a main agency — sign in via Employee Login. */
export const findSubAgentByCredentials = (
    agents: any[] = [],
    loginId: string,
    password: string
): any | undefined => {
    const cleanId = normalizeLoginEmail(loginId);
    const cleanPassword = normalizeLoginPassword(password);
    if (!cleanId || !cleanPassword) return undefined;

    return agents.find((agent: any) => {
        if (!agent?.parentId) return false;
        if (!isAgentPortalLoginAllowed(agent)) return false;
        return agentLoginEmail(agent) === cleanId && passwordsMatch(agent?.password, cleanPassword);
    });
};

/** Main agency owners can also use Employee Login with their email + password. */
export const findMainAgentByCredentials = (
    agents: any[] = [],
    loginId: string,
    password: string
): any | undefined => {
    const cleanId = normalizeLoginEmail(loginId);
    const cleanPassword = normalizeLoginPassword(password);
    if (!cleanId || !cleanPassword) return undefined;

    return agents.find((agent: any) => {
        if (agent?.parentId) return false;
        if (!isAgentPortalLoginAllowed(agent)) return false;
        return agentLoginEmail(agent) === cleanId && passwordsMatch(agent?.password, cleanPassword);
    });
};
