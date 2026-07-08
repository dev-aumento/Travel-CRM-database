import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    Map,
    FileText,
    CalendarCheck,
    Settings,
    LogOut,
    Plane,
    Zap,
    UserCheck,
    Shield,
    DollarSign,
    Crown,
    ScrollText
} from 'lucide-react';

import { getStoredSessionUserId } from '../../utils/authLogin';
import { PLATFORM_NAME } from '../../constants/platform';
import { useDatabase } from '../../context/DatabaseContext';
import { canManageAgencyProfile, findSessionUser, isMainAgencyOwnerSession, resolveAgencyBranding } from '../../utils/databaseSync';
import { type PermissionKey, canAccessRoute, canAccessTeamRoute } from '../../utils/permissions';

interface SidebarProps {
    onLogout?: () => void;
    isOpen: boolean;
    setIsOpen: (val: boolean) => void;
    userRole: 'admin' | 'agent' | 'staff';
    userPermissions?: PermissionKey[];
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout, isOpen, setIsOpen, userRole, userPermissions }) => {
    const location = useLocation();
    const { db } = useDatabase();

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

    const navItems = [
        { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} />, role: 'all' as const },
        { 
            name: userRole === 'admin'
                ? 'Subscribed Agents'
                : sessionUser?.type === 'subAgent'
                  ? 'My Team'
                  : 'Travel Agents', 
            path: '/my-team',
            icon: <UserCheck size={20} />, 
            role: ['admin', 'agent', 'staff'] as const,
            permission: 'travelAgents' as const,
        },
        { name: 'Leads', path: '/leads', icon: <Users size={20} />, role: ['agent', 'staff'] as const, permission: 'leads' as const },
        { name: 'Quotations', path: '/quotations', icon: <FileText size={20} />, role: ['agent', 'staff'] as const, permission: 'quotations' as const },
        { name: 'Bookings', path: '/bookings', icon: <CalendarCheck size={20} />, role: ['agent', 'staff'] as const, permission: 'bookings' as const },
        { name: 'Finance', path: '/finance', icon: <DollarSign size={20} />, role: 'all' as const, permission: 'finances' as const },
        { name: userRole === 'admin' ? 'Subscription Plans' : 'Package Studio', path: '/studio', icon: userRole === 'admin' ? <Crown size={20} /> : <Zap size={20} />, role: 'all' as const, permission: 'studio' as const },
        { name: 'Terms & Conditions', path: '/terms', icon: <ScrollText size={20} />, role: ['agent', 'staff'] as const, permission: 'terms' as const },
        { name: 'Plans', path: '/plans', icon: <Crown size={20} />, role: ['agent'] as const, mainAgencyOnly: true as const },
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

    return (
        <aside className={`w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 h-screen flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
            <div className="h-20 flex items-center px-6 border-b border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 dark:bg-slate-700 text-white rounded-xl flex items-center justify-center text-xl font-black shadow-lg shadow-slate-200 dark:shadow-slate-900 shrink-0 overflow-hidden">
                        {agencyBranding.logoUrl ? (
                            <img src={agencyBranding.logoUrl} alt={agencyBranding.name} className="w-full h-full object-cover" />
                        ) : (
                            agencyBranding.logo
                        )}
                    </div>
                    <div className="flex flex-col min-w-0" title={agencyBranding.name}>
                        <span className="text-lg font-black tracking-tighter text-slate-900 dark:text-slate-100 leading-[1.1] line-clamp-2 uppercase">{agencyBranding.name}</span>
                        <div className="flex items-center gap-1 mt-1">
                            <span className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Powered by</span>
                            <span className="text-[7px] font-black uppercase tracking-[0.1em] text-crm-600 truncate">{PLATFORM_NAME}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
                {!isStaffOrSubAgentSession && (
                    <div className="flex items-center gap-2 px-3 mb-6">
                        <div className={`p-1.5 rounded-lg ${userRole === 'admin' ? 'bg-slate-900 text-white' : 'bg-crm-600 text-white'}`}>
                            {userRole === 'admin' ? <Shield size={14} /> : <UserCheck size={14} />}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {userRole === 'admin' ? 'Master Admin' : 'Licensed Agent'}
                        </span>
                    </div>
                )}

                <p className={`px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ${isStaffOrSubAgentSession ? 'mt-0' : ''}`}>Main Menu</p>

                {filteredNavItems.map((item) => {
                    const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

                    return (
                        <NavLink
                            key={item.name}
                            to={item.path}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all duration-200 group ${isActive
                                ? 'bg-crm-50 dark:bg-crm-900/30 text-crm-600 dark:text-crm-400'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                                }`}
                        >
                            <div className={`${isActive ? 'text-crm-500 dark:text-crm-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
                                {item.icon}
                            </div>
                            {item.name}
                        </NavLink>
                    );
                })}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                {showAgencyProfile && (
                    <NavLink to="/settings" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 w-full rounded-lg font-medium transition-all duration-200 group ${isActive ? 'bg-crm-50 dark:bg-crm-900/30 text-crm-600 dark:text-crm-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'}`}>
                        <Settings size={20} className={location.pathname === '/settings' ? "text-crm-500 dark:text-crm-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"} />
                        {userRole === 'admin' ? 'Platform Settings' : 'Agency Profile'}
                    </NavLink>
                )}
                <button onClick={onLogout} className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-lg font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 ${showAgencyProfile ? 'mt-1' : ''}`}>
                    <LogOut size={20} className="text-red-400" />
                    Logout
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
