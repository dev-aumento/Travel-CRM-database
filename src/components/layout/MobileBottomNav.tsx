import React, { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, FileText, DollarSign } from 'lucide-react';
import { useDatabase } from '../../context/DatabaseContext';
import { getStoredSessionUserId } from '../../utils/authLogin';
import { findSessionUser, isSubAgencyAgentSession } from '../../utils/databaseSync';
import { type PermissionKey, canAccessRoute } from '../../utils/permissions';
import { canAccessRouteOnPlan, usePlanFeatures } from '../../utils/planFeatures';

interface MobileBottomNavProps {
    userRole: 'admin' | 'agent' | 'staff';
    userPermissions?: PermissionKey[];
}

const ITEMS = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Leads', path: '/leads', icon: Users },
    { name: 'Quotations', path: '/quotations', icon: FileText },
    { name: 'Finance', path: '/finance', icon: DollarSign },
] as const;

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ userRole, userPermissions }) => {
    const { db } = useDatabase();
    const { features: planFeatures } = usePlanFeatures();
    const agentId = localStorage.getItem('agentId');
    const sessionUser = findSessionUser(db, {
        userRole,
        userEmail: localStorage.getItem('userEmail'),
        sessionAgentId: agentId,
        sessionUserId: getStoredSessionUserId(),
    });
    const isSubAgentSession = sessionUser?.type === 'subAgent' || isSubAgencyAgentSession(agentId, db);

    const items = useMemo(
        () =>
            ITEMS.filter((item) => {
                if (item.path === '/') return true;
                if (!canAccessRouteOnPlan(planFeatures, item.path)) return false;
                return canAccessRoute(userRole, userPermissions, item.path, { isSubAgentSession });
            }),
        [planFeatures, userRole, userPermissions, isSubAgentSession]
    );

    if (items.length === 0) return null;

    return (
        <nav
            className="md:hidden print:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 pb-[env(safe-area-inset-bottom)]"
            aria-label="Primary"
        >
            <div className="flex h-16">
                {items.map((item) => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/'}
                            className={({ isActive }) =>
                                `flex flex-1 flex-col items-center justify-center gap-1 min-w-0 px-1 text-[10px] font-bold leading-none ${
                                    isActive ? 'text-crm-600' : 'text-slate-400 dark:text-slate-500'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                                    <span className="truncate max-w-full">{item.name}</span>
                                </>
                            )}
                        </NavLink>
                    );
                })}
            </div>
        </nav>
    );
};

export default MobileBottomNav;
