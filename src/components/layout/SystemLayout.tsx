import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar, { SIDEBAR_COLLAPSED_KEY } from './Sidebar';
import Navbar from './Navbar';
import PlanExpiryAlertBar from './PlanExpiryAlertBar';
import { type PermissionKey } from '../../utils/permissions';

interface SystemLayoutProps {
    onLogout?: () => void;
    userRole: 'admin' | 'agent' | 'staff';
    userPermissions?: PermissionKey[];
}

const readCollapsedPreference = () => {
    try {
        return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
        return false;
    }
};

/** Wide workspace pages where agents/staff get an icon-only sidebar automatically. */
const AUTO_COLLAPSE_ROUTES = ['/leads', '/quotations', '/bookings'];

const SystemLayout: React.FC<SystemLayoutProps> = ({ onLogout, userRole, userPermissions }) => {
    const { pathname } = useLocation();
    const isAutoCollapseRoute =
        userRole !== 'admin' &&
        AUTO_COLLAPSE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(
        () => isAutoCollapseRoute || readCollapsedPreference()
    );

    // Collapse on Leads / Quotations / Bookings; restore the saved preference elsewhere
    React.useEffect(() => {
        setIsSidebarCollapsed(isAutoCollapseRoute || readCollapsedPreference());
    }, [isAutoCollapseRoute]);

    const toggleSidebarCollapsed = React.useCallback(() => {
        setIsSidebarCollapsed((prev) => {
            const next = !prev;
            // Toggling on an auto-collapse page is temporary and doesn't change the saved preference
            if (!isAutoCollapseRoute) {
                try {
                    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
                } catch {
                    /* ignore */
                }
            }
            return next;
        });
    }, [isAutoCollapseRoute]);

    return (
        <div className="h-screen bg-slate-50 dark:bg-slate-950 flex overflow-hidden font-sans">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 xl:hidden animate-in fade-in duration-300"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar
                onLogout={onLogout}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapsed={toggleSidebarCollapsed}
                userRole={userRole}
                userPermissions={userPermissions}
            />

            <div
                className={`flex-1 flex flex-col h-screen min-w-0 transition-all duration-300 ${
                    isSidebarCollapsed
                        ? 'xl:ml-[4.5rem] min-[1441px]:ml-[4.75rem]'
                        : 'xl:ml-56 min-[1441px]:ml-64'
                }`}
            >
                <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} />
                <PlanExpiryAlertBar />
                <main className="flex-1 flex flex-col min-h-0 min-w-0 p-4 md:p-6 overflow-hidden">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default SystemLayout;
