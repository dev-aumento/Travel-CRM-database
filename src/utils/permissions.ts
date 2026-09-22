export const USER_PERMISSIONS_KEY = 'userPermissions';

export const PERMISSION_KEYS = [
    'finances',
    'leads',
    'travelAgents',
    'bookings',
    'quotations',
    'studio',
    'terms',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
    finances: 'Finance',
    leads: 'Leads',
    travelAgents: 'Travel Agents',
    bookings: 'Bookings',
    quotations: 'Quotations',
    studio: 'Package Studio',
    terms: 'Terms & Conditions',
};

export const ALL_PERMISSIONS: PermissionKey[] = [...PERMISSION_KEYS];

/** Staff created by a sub-agent always receive these modules only. */
export const SUB_AGENT_STAFF_PERMISSIONS: PermissionKey[] = ['leads', 'quotations', 'bookings'];

export const ROUTE_PERMISSION_MAP: Record<string, PermissionKey | undefined> = {
    '/leads': 'leads',
    '/quotations': 'quotations',
    '/bookings': 'bookings',
    '/finance': 'finances',
    '/my-team': 'travelAgents',
    '/studio': 'studio',
    '/terms': 'terms',
};

/** Agency CRM routes that master admin must not access. */
export const MASTER_ADMIN_EXCLUDED_ROUTES = ['/leads', '/quotations', '/bookings'] as const;

export const isMasterAdminExcludedRoute = (path: string): boolean =>
    (MASTER_ADMIN_EXCLUDED_ROUTES as readonly string[]).includes(path);

export const normalizePermissions = (permissions: unknown): PermissionKey[] => {
    if (!Array.isArray(permissions)) return [];
    return permissions.filter((key): key is PermissionKey =>
        PERMISSION_KEYS.includes(key as PermissionKey)
    );
};

/** Permissions saved on the account — only what was explicitly assigned. */
export const getAssignedPermissions = (permissions: unknown): PermissionKey[] =>
    normalizePermissions(permissions);

/** For edit forms when the field was never set on legacy records. */
export const getFormPermissions = (permissions: unknown): PermissionKey[] => {
    if (!Array.isArray(permissions)) return [...ALL_PERMISSIONS];
    return normalizePermissions(permissions);
};

/** @deprecated Use getAssignedPermissions for login enforcement. */
export const resolveEffectivePermissions = getAssignedPermissions;

export const getStoredPermissions = (): PermissionKey[] => {
    try {
        const raw = localStorage.getItem(USER_PERMISSIONS_KEY);
        if (!raw) return [];
        return getAssignedPermissions(JSON.parse(raw));
    } catch {
        return [];
    }
};

export const setStoredPermissions = (permissions: PermissionKey[]) => {
    localStorage.setItem(USER_PERMISSIONS_KEY, JSON.stringify(permissions));
};

export const clearStoredPermissions = () => {
    localStorage.removeItem(USER_PERMISSIONS_KEY);
};

export const hasPermission = (
    permissions: PermissionKey[] | undefined,
    key: PermissionKey
): boolean => {
    if (!permissions) return true;
    return permissions.includes(key);
};

/** Agency staff (not sub-agents) may only open these modules. */
export const REGULAR_STAFF_ROUTES = new Set(['/leads', '/quotations', '/bookings']);

export const canAccessRoute = (
    userRole: 'admin' | 'agent' | 'staff',
    permissions: PermissionKey[] | undefined,
    path: string,
    options?: { isSubAgentSession?: boolean }
): boolean => {
    if (userRole === 'admin' && isMasterAdminExcludedRoute(path)) return false;
    if (userRole === 'admin' || userRole === 'agent') return true;

    if (userRole === 'staff' && !options?.isSubAgentSession) {
        if (!REGULAR_STAFF_ROUTES.has(path)) return false;
    }

    const required = ROUTE_PERMISSION_MAP[path];
    if (!required) return true;

    const effective = permissions ?? getStoredPermissions();
    return hasPermission(effective, required);
};

export const canAccessTeamRoute = (
    userRole: 'admin' | 'agent' | 'staff',
    permissions: PermissionKey[] | undefined,
    isSubAgentSession: boolean
): boolean => {
    if (userRole === 'admin' || userRole === 'agent') return true;
    if (isSubAgentSession) return true;
    return canAccessRoute(userRole, permissions, '/my-team');
};

export const formatPermissionSummary = (permissions: PermissionKey[]): string => {
    if (permissions.length === 0) return 'No access granted';
    if (permissions.length === ALL_PERMISSIONS.length) return 'All modules';
    return permissions.map((key) => PERMISSION_LABELS[key]).join(', ');
};

export const displayPermissionSummary = (permissions: unknown): string => {
    if (!Array.isArray(permissions)) return 'All modules';
    return formatPermissionSummary(getAssignedPermissions(permissions));
};
