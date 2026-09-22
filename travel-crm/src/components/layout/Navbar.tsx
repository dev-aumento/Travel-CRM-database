import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, Search, User, CheckCircle2, Clock, Menu, Zap, AlertTriangle, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '../../context/DatabaseContext';
import { useTheme } from '../../context/ThemeContext';
import { findSessionUser, isBookingFromConfirmedLead, isMainAgencyOwnerSession, recordVisibleToSession, resolveMainAgencyAgent, resolveSessionDisplayName } from '../../utils/databaseSync';
import { agentInsightLabel, getAgentInsightCategories, getAgentPlanExpiryAlert, getAgentTrialInfo, isMainAgencyAgent } from '../../utils/agentPlan';
import { getStoredSessionUserId } from '../../utils/authLogin';
import { buildGlobalSearchResults, buildSearchNavigationPath } from '../../utils/globalSearch';

const Navbar = ({ onToggleSidebar, isSidebarOpen }: { onToggleSidebar: () => void, isSidebarOpen: boolean }) => {
    const navigate = useNavigate();
    const { db } = useDatabase();
    const { isDark, toggleTheme } = useTheme();
    const [showNotifs, setShowNotifs] = useState(false);
    
    const [readNotifs, setReadNotifs] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('readNotifs') || '[]');
        } catch {
            return [];
        }
    });

    const currentAgentId = localStorage.getItem('agentId');
    const sessionUserId = getStoredSessionUserId();
    const userRole = localStorage.getItem('userRole');
    const userEmail = localStorage.getItem('userEmail');
    const sessionScope = useMemo(
        () => ({ userRole, userEmail, sessionAgentId: currentAgentId, sessionUserId }),
        [userRole, userEmail, currentAgentId, sessionUserId]
    );
    const notifRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setShowNotifs(false);
            }
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const searchResults = useMemo(
        () => buildGlobalSearchResults(searchQuery, db, sessionScope),
        [searchQuery, db, sessionScope]
    );

    const handleSelectSearchResult = (result: any) => {
        navigate(buildSearchNavigationPath(result));
        setIsSearchFocused(false);
        setSearchQuery('');
    };

    const generatedNotifs = useMemo(() => {
        const getDate = (d: any) => d ? new Date(d).getTime() : 0;

        const formatTime = (d: any) => {
            if (!d) return 'Recently';
            const diff = Math.floor((new Date().getTime() - new Date(d).getTime()) / 60000);
            if (diff < 1) return 'Just now';
            if (diff < 60) return `${diff} min ago`;
            if (diff < 1440) return `${Math.floor(diff/60)} hours ago`;
            return new Date(d).toLocaleDateString();
        };

        if (userRole === 'admin') {
            const agents = (db.travelAgents?.data || []).filter(isMainAgencyAgent);
            const agentNotifs = agents.flatMap((agent: any) => {
                const categories = getAgentInsightCategories(agent);
                const primary = categories.find((category) => category !== 'active') || categories[0] || 'active';
                const timestamp = getDate(agent.planRenewedAt || agent.joinedDate || agent.createdAt);
                const trialInfo = getAgentTrialInfo(agent);

                if (trialInfo?.active) {
                    return [{
                        id: `agent-trial-${agent.id}`,
                        title: `Trial Active: ${agent.name || agent.businessName}`,
                        time: formatTime(agent.joinedDate || agent.createdAt),
                        timestamp,
                        type: 'agent',
                        path: '/my-team',
                    }];
                }

                if (primary === 'active') return [];

                return [{
                    id: `agent-${primary}-${agent.id}`,
                    title: `${agentInsightLabel[primary]}: ${agent.name || agent.businessName}`,
                    time: formatTime(agent.planRenewedAt || agent.joinedDate || agent.createdAt),
                    timestamp,
                    type: 'agent',
                    path: '/my-team',
                }];
            });

            return agentNotifs.sort((a: any, b: any) => b.timestamp - a.timestamp).slice(0, 8);
        }
        
        const filterData = (table: string, data: any[]) => {
            if (userRole === 'admin') return data;
            return data.filter((row) => recordVisibleToSession(table, row, db, sessionScope));
        };

        const leads = filterData('leads', db.leads?.data || []);
        const bookings = filterData(
            'bookings',
            (db.bookings?.data || []).filter((b: any) => isBookingFromConfirmedLead(b, db))
        );
        const quotes = filterData('quotations', db.quotations?.data || []);

        const allItems = [
            ...leads.map((l: any) => ({
                id: `lead-${l.id}`,
                title: `New Lead: ${l.name}`,
                time: formatTime(l.createdAt),
                timestamp: getDate(l.createdAt),
                type: 'lead',
                path: '/leads'
            })),
            ...bookings.map((b: any) => ({
                id: `booking-${b.id}`,
                title: `New Booking: ${b.customer}`,
                time: formatTime(b.createdAt),
                timestamp: getDate(b.createdAt),
                type: 'booking',
                path: '/bookings'
            })),
            ...quotes.map((q: any) => ({
                id: `quote-${q.id}`,
                title: `Quotation: ${q.customer}`,
                time: formatTime(q.createdAt),
                timestamp: getDate(q.createdAt),
                type: 'quote',
                path: '/quotations'
            }))
        ].sort((a: any, b: any) => b.timestamp - a.timestamp).slice(0, 8);

        return allItems;
    }, [db, userRole, currentAgentId]);

    const notifs = useMemo(() => {
        return generatedNotifs.map((n: any) => ({
            ...n,
            read: readNotifs.includes(n.id)
        }));
    }, [generatedNotifs, readNotifs]);

    const handleNotifClick = (n: any) => {
        if (!readNotifs.includes(n.id)) {
            const newRead = [...readNotifs, n.id];
            setReadNotifs(newRead);
            localStorage.setItem('readNotifs', JSON.stringify(newRead));
        }
        setShowNotifs(false);
        navigate(n.path);
    };

    const handleMarkAsRead = (e: React.MouseEvent, n: any) => {
        e.stopPropagation();
        if (!readNotifs.includes(n.id)) {
            const newRead = [...readNotifs, n.id];
            setReadNotifs(newRead);
            localStorage.setItem('readNotifs', JSON.stringify(newRead));
        }
    };

    const handleMarkAllRead = () => {
        const allIds = generatedNotifs.map((n: any) => n.id);
        const newRead = Array.from(new Set([...readNotifs, ...allIds]));
        setReadNotifs(newRead);
        localStorage.setItem('readNotifs', JSON.stringify(newRead));
    };

    const unreadCount = notifs.filter((n: any) => !n.read).length;

    const sessionUser = useMemo(
        () => findSessionUser(db, sessionScope),
        [db, sessionScope]
    );
    const currentUserData = sessionUser?.record;

    const currentUserDisplayName = useMemo(
        () => resolveSessionDisplayName(db, sessionScope),
        [db, sessionScope]
    );

    const agencyAgent = useMemo(
        () =>
            userRole === 'admin'
                ? null
                : resolveMainAgencyAgent(db, {
                      sessionAgentId: currentAgentId,
                      userEmail,
                  }),
        [db, userEmail, currentAgentId, userRole]
    );

    const trialInfo = useMemo(() => {
        if (!isMainAgencyOwnerSession(userRole, currentAgentId, db) || !agencyAgent) return null;
        return getAgentTrialInfo(agencyAgent);
    }, [agencyAgent, currentAgentId, db, userRole]);

    const planExpiryAlert = useMemo(
        () => (agencyAgent ? getAgentPlanExpiryAlert(agencyAgent) : null),
        [agencyAgent]
    );

    return (
        <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40 flex items-center justify-between gap-4 px-4 md:px-8">
            <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                <button 
                    onClick={onToggleSidebar}
                    className="xl:hidden p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                >
                    <Menu size={20} />
                </button>
                <div ref={searchRef} className="relative flex items-center min-w-0 flex-1 max-w-md md:max-w-lg">
                    <div className="flex items-center bg-white dark:bg-slate-800 border border-crm-500 dark:border-crm-500 rounded-xl transition-all duration-300 ease-in-out overflow-hidden w-full px-3 ring-4 ring-crm-500/5 dark:ring-crm-500/10">
                        <button className="p-2 transition-colors shrink-0 rounded-lg text-crm-600">
                            <Search size={20} />
                        </button>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setIsSearchFocused(true)}
                            placeholder={
                                userRole === 'admin'
                                    ? 'Search agents by name, email, business, or plan...'
                                    : 'Search leads, staff, agents, bookings, quotes...'
                            }
                            className="bg-transparent border-none text-sm text-slate-800 dark:text-slate-100 focus:ring-0 focus:outline-none focus-visible:outline-none focus:border-none focus:shadow-none transition-all duration-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 h-10 w-full opacity-100 ml-1 min-w-0"
                        />
                    </div>
                    {isSearchFocused && searchQuery.trim() && (
                        <div className="absolute top-full left-0 mt-2 w-72 md:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 z-50">
                            <div className="p-2 max-h-[60vh] overflow-y-auto">
                                {searchResults.length > 0 ? (
                                    searchResults.map((result: any) => (
                                        <button
                                            key={result.id}
                                            onClick={() => handleSelectSearchResult(result)}
                                            className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors text-left group"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-black uppercase text-slate-400 dark:text-slate-300 group-hover:bg-crm-50 dark:group-hover:bg-crm-900/40 group-hover:text-crm-600 transition-colors">
                                                {result.tableLabel.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-none mb-1">{result.title}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">{result.tableLabel} • {result.subtitle}</p>
                                                {result.displayId && (
                                                    <p className="text-[10px] text-crm-600 dark:text-crm-400 font-semibold mt-0.5">
                                                        ID: {result.displayId}
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-xs text-slate-400">No results found for "{searchQuery}"</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4 shrink-0">
                <button
                    onClick={toggleTheme}
                    className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
                    title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                    aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                >
                    {isDark ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                {userRole !== 'staff' && sessionUser?.type !== 'subAgent' && (
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm bg-white dark:bg-slate-800 dark:border-slate-700">
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                        userRole === 'admin' ? 'bg-slate-900' : 'bg-crm-600'
                    }`} />
                    <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${
                        userRole === 'admin' ? 'text-slate-900' : 'text-crm-600'
                    }`}>
                        {userRole === 'admin' ? 'Master Admin' : 'Agency Portal'}
                    </span>
                </div>
                )}

                {trialInfo && trialInfo.active && (
                    <div 
                        onClick={() => navigate('/plans')}
                        className="flex shrink-0 items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer hover:bg-amber-100 transition-all shadow-sm whitespace-nowrap"
                    >
                        <Zap size={14} className="fill-current" />
                        Trial: {trialInfo.daysLeft} Days Left
                    </div>
                )}

                {planExpiryAlert && (
                    <div
                        onClick={() => navigate(isMainAgencyOwnerSession(userRole, currentAgentId, db) ? '/plans' : '/')}
                        className="flex shrink-0 items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer hover:bg-amber-100 transition-all shadow-sm whitespace-nowrap"
                    >
                        <AlertTriangle size={14} />
                        Plan: {planExpiryAlert.daysLeft} Days Left
                    </div>
                )}

                <div className="hidden md:block h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>

                <button onClick={() => navigate('/profile')} className="flex items-center gap-2 p-1 md:pr-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                    <div className="w-8 h-8 rounded-full bg-crm-100 dark:bg-crm-900/50 text-crm-600 dark:text-crm-400 flex items-center justify-center shrink-0 overflow-hidden">
                        {currentUserData?.avatar ? (
                            <img src={currentUserData.avatar} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User size={16} className="fill-current" />
                        )}
                    </div>
                    <span 
                        className="hidden md:block text-sm font-bold text-slate-700 dark:text-slate-200 max-w-[150px] truncate"
                        title={currentUserDisplayName}
                    >
                        {currentUserDisplayName}
                    </span>
                </button>

                <div ref={notifRef} className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowNotifs(!showNotifs);
                        }}
                        className={`relative p-2.5 transition-colors rounded-full ${showNotifs ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                        )}
                    </button>
                    {showNotifs && (
                        <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                <h3 className="font-bold text-slate-800 dark:text-slate-100">Notifications</h3>
                                {unreadCount > 0 && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleMarkAllRead();
                                        }}
                                        className="text-xs font-bold text-crm-600 hover:text-crm-700 transition-colors"
                                    >
                                        Mark all as read
                                    </button>
                                )}
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {notifs.length > 0 ? notifs.map((n: any) => (
                                    <div
                                        key={n.id}
                                        onClick={() => handleNotifClick(n)}
                                        className={`p-4 border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors group ${!n.read ? 'bg-blue-50/30 dark:bg-blue-900/20' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className={`text-sm ${!n.read ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'}`}>{n.title}</h4>
                                            {!n.read && (
                                                <button 
                                                    onClick={(e) => handleMarkAsRead(e, n)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full text-slate-400 hover:text-crm-600"
                                                    title="Mark as read"
                                                >
                                                    <CheckCircle2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <Clock size={12} /> {n.time}
                                        </div>
                                    </div>
                                )) : (
                                    <div className="p-8 text-center text-slate-400">
                                        <Bell size={24} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-sm font-medium">No new notifications</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Navbar;
