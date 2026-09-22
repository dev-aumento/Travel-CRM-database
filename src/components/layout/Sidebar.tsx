import React, { useMemo, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    FileText,
    CalendarCheck,
    Settings,
    LogOut,
    Zap,
    UserCheck,
    Shield,
    DollarSign,
    Crown,
    ScrollText,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';

import { getStoredSessionUserId } from '../../utils/authLogin';
import { PLATFORM_NAME } from '../../constants/platform';
import { useDatabase } from '../../context/DatabaseContext';
import { canManageAgencyProfile, findSessionUser, isMainAgencyOwnerSession, resolveAgencyBranding } from '../../utils/databaseSync';
import { type PermissionKey, canAccessRoute, canAccessTeamRoute } from '../../utils/permissions';

const SIDEBAR_COLLAPSED_KEY = 'crm_sidebar_collapsed';

interface SidebarProps {
    onLogout?: () => void;
    isOpen: boolean;
    setIsOpen: (val: boolean) => void;
    isCollapsed: boolean;
    onToggleCollapsed: () => void;
    userRole: 'admin' | 'agent' | 'staff';
    userPermissions?: PermissionKey[];
}

const Sidebar: React.FC<SidebarProps> = ({
    onLogout,
    isOpen,
    setIsOpen,
    isCollapsed,
    onToggleCollapsed,
    userRole,
    userPermissions,
}) => {
    const location = useLocation();
    const { db } = useDatabase();
    const [isDesktop, setIsDesktop] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia('(min-width: 1280px)').matches : false
    );

    // Icon-only collapse is desktop-only; mobile/tablet drawer always shows full labels.
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1280px)');
        const update = () => setIsDesktop(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);

    const showCollapsed = isCollapsed && isDesktop;

    const closeMobileDrawer = () => setIsOpen(false);

    // Close mobile/tablet drawer after any route change
    useEffect(() => {
        setIsOpen(false);
    }, [location.pathname, setIsOpen]);

    const sessionAgentId = localStorage.getItem('agentId');
    const sessionUserId = getStoredSessionUserId();
    const sessionScope = {
        userRole,
        userEmail: localStorage.getItem('userEmail'),
        sessionAgentId,
        sessionUserId,
    };
    const isMainAgencyOwner = isMainAgencyOwnerSession(userRole, sessionAgentId, db);
    const sessionUser = findSessionUser(db, sessionScope);
    const isStaffOrSubAgentSession =
        userRole === 'staff' ||
        sessionUser?.type === 'subAgent' ||
        sessionUser?.type === 'staff';

    const agencyBranding = useMemo(() => {
        if (userRole === 'admin') {
            return {
                name: PLATFORM_NAME,
                logo: 'S',
                logoUrl: '',
            };
        }
        const branding = resolveAgencyBranding(db, sessionScope);
        return {
            name: branding.name,
            logo: branding.logo,
            logoUrl: branding.logoUrl,
        };
    }, [db, userRole, sessionAgentId, sessionUserId]);

    const navIconClass = 'w-5 h-5 xl:w-4 xl:h-4 min-[1441px]:w-5 min-[1441px]:h-5';
    const navItems = [
        { name: 'Dashboard', path: '/', icon: <LayoutDashboard className={navIconClass} />, role: 'all' as const },
        {
            name: userRole === 'admin'
                ? 'Subscribed Agents'
                : sessionUser?.type === 'subAgent'
                  ? 'My Team'
                  : 'Travel Agents',
            path: '/my-team',
            icon: <UserCheck className={navIconClass} />,
            role: ['admin', 'agent', 'staff'] as const,
            permission: 'travelAgents' as const,
        },
        { name: 'Leads', path: '/leads', icon: <Users className={navIconClass} />, role: ['agent', 'staff'] as const, permission: 'leads' as const },
        { name: 'Quotations', path: '/quotations', icon: <FileText className={navIconClass} />, role: ['agent', 'staff'] as const, permission: 'quotations' as const },
        { name: 'Bookings', path: '/bookings', icon: <CalendarCheck className={navIconClass} />, role: ['agent', 'staff'] as const, permission: 'bookings' as const },
        { name: 'Finance', path: '/finance', icon: <DollarSign className={navIconClass} />, role: 'all' as const, permission: 'finances' as const },
        { name: userRole === 'admin' ? 'Subscription Plans' : 'Package Studio', path: '/studio', icon: userRole === 'admin' ? <Crown className={navIconClass} /> : <Zap className={navIconClass} />, role: 'all' as const, permission: 'studio' as const },
        { name: 'Terms & Conditions', path: '/terms', icon: <ScrollText className={navIconClass} />, role: ['agent', 'staff'] as const, permission: 'terms' as const },
        { name: 'Plans', path: '/plans', icon: <Crown className={navIconClass} />, role: ['agent'] as const, mainAgencyOnly: true as const },
    ];

    const filteredNavItems = navItems.filter(item => {
        if (item.role !== 'all') {
            if (!Array.isArray(item.role) || !item.role.includes(userRole)) return false;
        }
        if ('mainAgencyOnly' in item && item.mainAgencyOnly && !isMainAgencyOwner) {
            return false;
        }
        if ('permission' in item && item.permission) {
            if (item.path === '/my-team') {
                return canAccessTeamRoute(userRole, userPermissions, sessionUser?.type === 'subAgent');
            }
            return canAccessRoute(userRole, userPermissions, item.path, {
                isSubAgentSession: sessionUser?.type === 'subAgent',
            });
        }
        return true;
    });

    const showAgencyProfile = canManageAgencyProfile(
        userRole,
        localStorage.getItem('agentId'),
        db
    );

    const settingsLabel = userRole === 'admin' ? 'Platform Settings' : 'Agency Profile';

    const linkBase =
        'flex items-center rounded-lg text-sm xl:text-s min-[1441px]:text-sm font-medium transition-all duration-200 group';
    const linkPadding = showCollapsed
        ? 'justify-center px-0 py-2.5 xl:py-2 min-[1441px]:py-2.5'
        : 'gap-3 xl:gap-2 min-[1441px]:gap-3 px-2.5 xl:px-2 min-[1441px]:px-3 py-2.5 xl:py-1.5 min-[1441px]:py-2.5';

    return (
        <aside
            className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 h-screen flex flex-col fixed left-0 top-0 z-50 transition-all duration-300 xl:translate-x-0 ${
                isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
            } ${
                showCollapsed
                    ? 'w-[4.5rem] xl:w-[4.5rem] min-[1441px]:w-[4.75rem]'
                    : 'w-72 xl:w-56 min-[1441px]:w-64'
            }`}
        >
            <div
                className={`shrink-0 h-16 xl:h-14 min-[1441px]:h-20 flex items-center border-b border-slate-100 dark:border-slate-800 overflow-hidden ${
                    showCollapsed ? 'justify-center px-2' : 'px-4 xl:px-3 min-[1441px]:px-6'
                }`}
            >
                <div className={`flex items-center min-w-0 ${showCollapsed ? 'justify-center' : 'gap-2.5 xl:gap-2 min-[1441px]:gap-3'}`}>
                    <div
                        className="w-9 h-9 xl:w-8 xl:h-8 min-[1441px]:w-10 min-[1441px]:h-10 bg-slate-900 dark:bg-slate-700 text-white rounded-xl xl:rounded-lg min-[1441px]:rounded-xl flex items-center justify-center text-lg xl:text-base min-[1441px]:text-xl font-black shadow-lg shadow-slate-200 dark:shadow-slate-900 shrink-0 overflow-hidden"
                        title={agencyBranding.name}
                    >
                        {agencyBranding.logoUrl ? (
                            <img src={agencyBranding.logoUrl} alt={agencyBranding.name} className="w-full h-full object-cover" />
                        ) : (
                            agencyBranding.logo
                        )}
                    </div>
                    {!showCollapsed && (
                        <div className="flex flex-col min-w-0" title={agencyBranding.name}>
                            <span className="text-base xl:text-sm min-[1441px]:text-lg font-black tracking-tighter text-slate-900 dark:text-slate-100 leading-[1.1] line-clamp-2 uppercase">
                                {agencyBranding.name}
                            </span>
                            <div className="flex items-center gap-1 mt-0.5 min-[1441px]:mt-1">
                                <span className="text-[7px] xl:text-[6px] min-[1441px]:text-[7px] font-black uppercase tracking-[0.15em] min-[1441px]:tracking-[0.2em] text-slate-400 whitespace-nowrap">
                                    Powered by
                                </span>
                                <span className="text-[7px] xl:text-[6px] min-[1441px]:text-[7px] font-black uppercase tracking-[0.08em] min-[1441px]:tracking-[0.1em] text-crm-600 truncate">
                                    {PLATFORM_NAME}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div
                className={`flex-1 min-h-0 py-4 xl:py-3 min-[1441px]:py-6 space-y-1 xl:space-y-0.5 min-[1441px]:space-y-1 overflow-y-auto overscroll-contain custom-scrollbar ${
                    showCollapsed ? 'px-2' : 'px-3 xl:px-2.5 min-[1441px]:px-4'
                }`}
            >
                {!isStaffOrSubAgentSession && (
                    <div
                        className={`mb-4 xl:mb-3 min-[1441px]:mb-6 ${
                            showCollapsed
                                ? 'flex justify-center'
                                : 'flex items-center gap-2 xl:gap-1.5 min-[1441px]:gap-2 px-2.5 xl:px-2 min-[1441px]:px-3'
                        }`}
                        title={userRole === 'admin' ? 'Master Admin' : 'Licensed Agent'}
                    >
                        <div
                            className={`p-1.5 xl:p-1 min-[1441px]:p-1.5 rounded-lg xl:rounded-md min-[1441px]:rounded-lg ${
                                userRole === 'admin' ? 'bg-slate-900 text-white' : 'bg-crm-600 text-white'
                            }`}
                        >
                            {userRole === 'admin' ? (
                                <Shield className="w-3.5 h-3.5 xl:w-3 xl:h-3 min-[1441px]:w-3.5 min-[1441px]:h-3.5" />
                            ) : (
                                <UserCheck className="w-3.5 h-3.5 xl:w-3 xl:h-3 min-[1441px]:w-3.5 min-[1441px]:h-3.5" />
                            )}
                        </div>
                        {!showCollapsed && (
                            <span className="text-[10px] xl:text-[9px] min-[1441px]:text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {userRole === 'admin' ? 'Master Admin' : 'Licensed Agent'}
                            </span>
                        )}
                    </div>
                )}

                {!showCollapsed && (
                    <p
                        className={`px-2.5 xl:px-2 min-[1441px]:px-3 text-xs xl:text-[10px] min-[1441px]:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 xl:mb-1.5 min-[1441px]:mb-2 ${
                            isStaffOrSubAgentSession ? 'mt-0' : ''
                        }`}
                    >
                        Main Menu
                    </p>
                )}

                {filteredNavItems.map((item) => {
                    const isActive =
                        location.pathname === item.path ||
                        (item.path !== '/' && location.pathname.startsWith(item.path));

                    return (
                        <NavLink
                            key={item.name}
                            to={item.path}
                            title={item.name}
                            onClick={closeMobileDrawer}
                            className={`${linkBase} ${linkPadding} ${
                                isActive
                                    ? 'bg-crm-50 dark:bg-crm-900/30 text-crm-600 dark:text-crm-400'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                            }`}
                        >
                            <div
                                className={`shrink-0 ${
                                    isActive
                                        ? 'text-crm-500 dark:text-crm-400'
                                        : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                                }`}
                            >
                                {item.icon}
                            </div>
                            {!showCollapsed && <span className="truncate">{item.name}</span>}
                        </NavLink>
                    );
                })}
            </div>

            <div
                className={`shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 ${
                    showCollapsed ? 'p-2' : 'p-3 xl:p-2.5 min-[1441px]:p-4'
                }`}
            >
                {showAgencyProfile && (
                    <NavLink
                        to="/settings"
                        title={settingsLabel}
                        onClick={closeMobileDrawer}
                        className={({ isActive }) =>
                            `${linkBase} ${linkPadding} w-full ${
                                isActive
                                    ? 'bg-crm-50 dark:bg-crm-900/30 text-crm-600 dark:text-crm-400'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                            }`
                        }
                    >
                        <Settings
                            className={`w-5 h-5 xl:w-4 xl:h-4 min-[1441px]:w-5 min-[1441px]:h-5 shrink-0 ${
                                location.pathname === '/settings'
                                    ? 'text-crm-500 dark:text-crm-400'
                                    : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                            }`}
                        />
                        {!showCollapsed && <span className="truncate">{settingsLabel}</span>}
                    </NavLink>
                )}
                <button
                    type="button"
                    title="Logout"
                    onClick={() => {
                        closeMobileDrawer();
                        onLogout?.();
                    }}
                    className={`${linkBase} ${linkPadding} w-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 ${
                        showAgencyProfile ? 'mt-1 xl:mt-0.5 min-[1441px]:mt-1' : ''
                    }`}
                >
                    <LogOut className="w-5 h-5 xl:w-4 xl:h-4 min-[1441px]:w-5 min-[1441px]:h-5 text-red-400 shrink-0" />
                    {!showCollapsed && <span>Logout</span>}
                </button>
            </div>

            {/* Desktop collapse toggle — sits on the sidebar edge */}
            <button
                type="button"
                onClick={onToggleCollapsed}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="hidden xl:flex absolute top-16 xl:top-14 min-[1441px]:top-20 -translate-y-1/2 -right-3 z-[60] w-6 h-6 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 shadow-md hover:text-crm-600 hover:border-crm-300 hover:bg-crm-50 dark:hover:bg-slate-700 transition-all"
            >
                {isCollapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronLeft size={14} strokeWidth={2.5} />}
            </button>
        </aside>
    );
};

export { SIDEBAR_COLLAPSED_KEY };
export default Sidebar;
