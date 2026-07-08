import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import PlanExpiryAlertBar from './PlanExpiryAlertBar';
import { type PermissionKey } from '../../utils/permissions';

interface SystemLayoutProps {
    onLogout?: () => void;
    userRole: 'admin' | 'agent' | 'staff';
    userPermissions?: PermissionKey[];
}

const SystemLayout: React.FC<SystemLayoutProps> = ({ onLogout, userRole, userPermissions }) => {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    return (
        <div className="h-screen bg-slate-50 dark:bg-slate-950 flex overflow-hidden font-sans">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar onLogout={onLogout} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} userRole={userRole} userPermissions={userPermissions} />
            
            <div className={`flex-1 flex flex-col h-screen min-w-0 transition-all duration-300 lg:ml-64`}>
                <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} />
                <PlanExpiryAlertBar />
                <main className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default SystemLayout;
