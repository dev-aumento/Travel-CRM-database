import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, User, Building, Mail, Phone, CreditCard, Plus, Edit2, Trash2, Search, X, CheckCircle2, Globe, Landmark, Fingerprint, Clock, ShieldCheck, ShieldAlert, UserPlus, Briefcase, Key, Crown, MapPin, Eye } from 'lucide-react';
import DropdownChevron from '../components/DropdownChevron';
import { useDatabase } from '../context/DatabaseContext';
import {
    buildApprovalPlanFields,
    findTravelAgentForSession,
    getAgentPlanExpiryDisplay,
    getAgentSubscriptionStatus,
    isMainAgencyAgent,
    matchesAgentSubscriptionFilter,
    planExpiryBadgeClass,
    sortPlansByPriceAsc,
    type AgentSubscriptionFilter,
} from '../utils/agentPlan';
import AgentAvatar from '../components/AgentAvatar';
import {
    countAgencyStaff,
    countAgencySubAgents,
    filterStaffForAgentSession,
    filterSubAgentsForAgentSession,
    resolveStaffCreatorAgentId,
    resolveMainAgencyAgent,
    resolveMainAgencyAgentId,
    isSubAgencyAgentSession,
    getAgencyPlanLimits,
    canAddAgencyStaff,
    canSessionManageStaffMember,
    isUnlimitedPlanSlots,
} from '../utils/databaseSync';
import {
    COUNTRY_PHONE_DATA,
    DEFAULT_COUNTRY_CODE,
    PHONE_LIMITS,
    formatStoredAgentPhone,
    getPhoneDigitLimit,
    parseStoredAgentPhone,
    sanitizeLocalPhoneDigits,
    validateLocalPhone,
} from '../utils/countryPhoneData';
import PermissionSelect from '../components/PermissionSelect';
import {
    ALL_PERMISSIONS,
    type PermissionKey,
    formatPermissionSummary,
    displayPermissionSummary,
    getFormPermissions,
    getStoredPermissions,
    hasPermission,
    SUB_AGENT_STAFF_PERMISSIONS,
} from '../utils/permissions';

const toDateInputValue = (iso?: string) => (iso ? String(iso).split('T')[0] : '');

type AgentStatusBadge = { label: string; className: string };

const agentCardBadgeClass =
    'px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide border truncate text-center min-w-0';

const agentCardBadgeInlineClass =
    'px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide border shrink-0';

const agentCardBadgeRowInlineClass = 'flex flex-wrap gap-1 my-2.5';

const agentCardChipClass =
    'px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border';

const agentCardMetaClass =
    'text-[11px] text-slate-500 font-medium min-w-0';

const agentCardContactGridClass =
    'grid grid-cols-1 gap-1.5 min-[1441px]:grid-cols-3 min-[1441px]:gap-1.5';

const agentCardBadgeRow3Class = 'grid grid-cols-3 gap-1.5 my-2.5';

const agentCardContactSectionClass = `${agentCardContactGridClass} py-2.5 my-2 border-t border-slate-100`;

const MainAgentListRow = ({
    agent,
    expiry,
    statusBadge,
    onView,
    onEdit,
}: {
    agent: any;
    expiry: ReturnType<typeof getAgentPlanExpiryDisplay>;
    statusBadge: AgentStatusBadge;
    onView: () => void;
    onEdit: () => void;
}) => (
    <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
        <AgentAvatar agent={agent} />
        <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-800 truncate">{agent.name}</h3>
                    <p className="text-[10px] lg:text-xs font-bold text-crm-600 uppercase tracking-wider truncate">
                        {agent.businessName}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                    <button
                        type="button"
                        onClick={onView}
                        className="p-1.5 text-slate-400 hover:text-crm-600 hover:bg-crm-50 rounded-lg transition-all"
                        title="View profile"
                    >
                        <Eye size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={onEdit}
                        className="p-1.5 text-slate-400 hover:text-crm-600 hover:bg-crm-50 rounded-lg transition-all"
                        title="Edit agent"
                    >
                        <Edit2 size={16} />
                    </button>
                </div>
            </div>
            <div className={agentCardBadgeRow3Class}>
                <span className={`${agentCardBadgeClass} ${statusBadge.className}`}>
                    {statusBadge.label}
                </span>
                <span className={`${agentCardBadgeClass} bg-crm-50 text-crm-700 border-crm-100`}>
                    {agent.plan || 'Lite'}
                </span>
                <span
                    className={`${agentCardBadgeClass} ${planExpiryBadgeClass(expiry.tone)}`}
                    title={`${expiry.label}: ${expiry.text}`}
                >
                    {expiry.label}: {expiry.text}
                </span>
            </div>
            <div className={agentCardContactSectionClass}>
                <div className={`flex items-center gap-1 ${agentCardMetaClass}`} title={agent.email}>
                    <Mail size={11} className="shrink-0 text-slate-400" />
                    <span className="truncate">{agent.email}</span>
                </div>
                <div className={`flex items-center gap-1 ${agentCardMetaClass}`} title={agent.phone || undefined}>
                    <Phone size={11} className="shrink-0 text-slate-400" />
                    <span className="truncate">{agent.phone || '—'}</span>
                </div>
                <div className={`flex items-center gap-1 ${agentCardMetaClass}`}>
                    <Clock size={11} className="shrink-0 text-slate-400" />
                    <span className="truncate" title={`Joined: ${agent.joinedDate}`}>Joined: {agent.joinedDate}</span>
                </div>
            </div>
        </div>
    </div>
);

const MainAgentCard = ({
    agent,
    expiry,
    statusBadge,
    onView,
    onEdit,
}: {
    agent: any;
    expiry: ReturnType<typeof getAgentPlanExpiryDisplay>;
    statusBadge: AgentStatusBadge;
    onView: () => void;
    onEdit: () => void;
}) => (
    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md hover:border-slate-300 transition-all h-full flex flex-col">
        <div className="flex items-start gap-2.5">
            <AgentAvatar agent={agent} roundedClassName="rounded-lg" />
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-800 truncate leading-tight">{agent.name}</h3>
                        <p className="text-[10px] lg:text-xs font-bold text-crm-600 uppercase tracking-wider truncate">
                            {agent.businessName}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                        <button
                            type="button"
                            onClick={onView}
                            className="p-1.5 text-slate-400 hover:text-crm-600 hover:bg-crm-50 rounded-md transition-all"
                            title="View profile"
                        >
                            <Eye size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={onEdit}
                            className="p-1.5 text-slate-400 hover:text-crm-600 hover:bg-crm-50 rounded-md transition-all"
                            title="Edit agent"
                        >
                            <Edit2 size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div className={agentCardBadgeRow3Class}>
            <span className={`${agentCardBadgeClass} ${statusBadge.className}`}>
                {statusBadge.label}
            </span>
            <span className={`${agentCardBadgeClass} bg-crm-50 text-crm-700 border-crm-100`}>
                {agent.plan || 'Lite'}
            </span>
            <span
                className={`${agentCardBadgeClass} ${planExpiryBadgeClass(expiry.tone)}`}
                title={`${expiry.label}: ${expiry.text}`}
            >
                {expiry.label}: {expiry.text}
            </span>
        </div>

        <div className={`mt-auto ${agentCardContactSectionClass}`}>
            <div className={`flex items-center gap-1 ${agentCardMetaClass}`} title={agent.email}>
                <Mail size={11} className="shrink-0 text-slate-400" />
                <span className="truncate">{agent.email}</span>
            </div>
            <div className={`flex items-center gap-1 ${agentCardMetaClass}`} title={agent.phone || undefined}>
                <Phone size={11} className="shrink-0 text-slate-400" />
                <span className="truncate">{agent.phone || '—'}</span>
            </div>
            <div className={`flex items-center gap-1 ${agentCardMetaClass}`}>
                <Clock size={11} className="shrink-0 text-slate-400" />
                <span className="truncate" title={`Joined: ${agent.joinedDate}`}>Joined: {agent.joinedDate}</span>
            </div>
        </div>
    </div>
);

const TravelAgent = () => {
    const { db, addRecord, updateRecord, deleteRecord, getNextId } = useDatabase();
    const [searchParams, setSearchParams] = useSearchParams();
    const userRole = localStorage.getItem('userRole');
    const userEmail = localStorage.getItem('userEmail');
    const sessionAgentId = localStorage.getItem('agentId');

    const currentAgent = findTravelAgentForSession(db.travelAgents?.data || [], {
        agentId: sessionAgentId,
        userEmail,
    });
    const mainAgencyAgent = useMemo(
        () =>
            resolveMainAgencyAgent(db, {
                sessionAgentId: sessionAgentId || currentAgent?.id || '',
                userEmail,
            }),
        [db, sessionAgentId, currentAgent?.id, userEmail]
    );
    const sessionAgentIdResolved = sessionAgentId || currentAgent?.id || '';
    const isSubAgentSession = isSubAgencyAgentSession(sessionAgentIdResolved, db);
    const agencyId = resolveMainAgencyAgentId(sessionAgentIdResolved, db);
    const staffCreatorAgentId =
        resolveStaffCreatorAgentId(sessionAgentIdResolved, db) || agencyId;
    const canManageStaffTeam =
        userRole === 'agent' ||
        isSubAgentSession ||
        (userRole === 'staff' && hasPermission(getStoredPermissions(), 'travelAgents'));
    const defaultStaffPermissions = (): PermissionKey[] =>
        isSubAgentSession ? [...SUB_AGENT_STAFF_PERMISSIONS] : [...ALL_PERMISSIONS];

    const planLimits = useMemo(
        () => getAgencyPlanLimits(db, sessionAgentIdResolved),
        [db, sessionAgentIdResolved, db.plans?.data, mainAgencyAgent?.plan]
    );
    const currentPlan = planLimits.planName;

    const [activeTab, setActiveTab] = useState<'agents' | 'staff' | 'sub-agents'>(() => {
        const tab = searchParams.get('tab');
        if (tab === 'agents' || tab === 'staff' || tab === 'sub-agents') return tab;
        return userRole === 'admin' ? 'agents' : canManageStaffTeam && userRole !== 'agent' ? 'staff' : userRole === 'agent' ? 'sub-agents' : 'staff';
    });
    const [isAddingStaff, setIsAddingStaff] = useState(false);
    const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
    const [highlightedStaffId, setHighlightedStaffId] = useState('');
    const [highlightedAgentId, setHighlightedAgentId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [agentSubscriptionFilter, setAgentSubscriptionFilter] = useState<AgentSubscriptionFilter>('all');
    
    const [staffForm, setStaffForm] = useState<{
        name: string;
        employeeId: string;
        password: string;
        role: string;
        status: string;
        permissions: PermissionKey[];
    }>({
        name: '',
        employeeId: '',
        password: '',
        role: 'Sales',
        status: 'active',
        permissions: [...ALL_PERMISSIONS],
    });

    const isIdDuplicate = useMemo(() => {
        if (!staffForm.employeeId) return false;
        const normalizedId = staffForm.employeeId.trim().toLowerCase();
        return (db.staff?.data || []).some(
            (s: any) =>
                String(s.employeeId || '').trim().toLowerCase() === normalizedId &&
                s.id !== editingStaffId
        );
    }, [staffForm.employeeId, db.staff?.data, editingStaffId]);

    const [agentForm, setAgentForm] = useState({
        name: '',
        businessName: '',
        email: '',
        password: '',
        gstNumber: '',
        countryCode: DEFAULT_COUNTRY_CODE,
        phone: '',
        address: '',
        status: 'approved',
        plan: 'Lite',
        planExpiresAt: '',
        trialEndsAt: '',
        isTrial: false,
        permissions: [...ALL_PERMISSIONS] as PermissionKey[],
    });

    const [agentPhoneError, setAgentPhoneError] = useState<string | undefined>();
    const [isAddingAgent, setIsAddingAgent] = useState(false);
    const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
    const [viewingAgent, setViewingAgent] = useState<any>(null);

    const emptyAgentForm = {
        name: '',
        businessName: '',
        email: '',
        password: '',
        gstNumber: '',
        countryCode: DEFAULT_COUNTRY_CODE,
        phone: '',
        address: '',
        status: 'approved' as string,
        plan: 'Lite',
        planExpiresAt: '',
        trialEndsAt: '',
        isTrial: false,
        permissions: [...ALL_PERMISSIONS] as PermissionKey[],
    };

    const requiredPhoneDigits = getPhoneDigitLimit(agentForm.countryCode);

    const planOptions = useMemo(
        () => sortPlansByPriceAsc(db.plans?.data || []).map((p: any) => p.name).filter(Boolean),
        [db.plans?.data]
    );

    const resetAgentForm = () => {
        setAgentForm(emptyAgentForm);
        setAgentPhoneError(undefined);
        setEditingAgentId(null);
    };

    // Filtering logic
    const agents = db.travelAgents?.data || [];
    const mainAgents = agents.filter(
        (a: any) => isMainAgencyAgent(a) && a.status !== 'rejected'
    );

    const agentSubscriptionFilterCounts = useMemo(() => {
        const counts = { all: mainAgents.length, active: 0, expired: 0, expiring_soon: 0 };
        mainAgents.forEach((agent: any) => {
            counts[getAgentSubscriptionStatus(agent)]++;
        });
        return counts;
    }, [mainAgents]);

    const filteredMainAgents = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return mainAgents.filter((agent: any) => {
            if (!matchesAgentSubscriptionFilter(agent, agentSubscriptionFilter)) return false;
            if (!q) return true;
            const haystack = [agent.name, agent.businessName, agent.email, agent.plan, agent.id]
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [mainAgents, agentSubscriptionFilter, searchQuery]);

    const agentSubscriptionFilterOptions: { id: AgentSubscriptionFilter; label: string }[] = [
        { id: 'all', label: 'All Agents' },
        { id: 'active', label: 'Active Agents' },
        { id: 'expired', label: 'Expired Agents' },
        { id: 'expiring_soon', label: 'Expire Soon' },
    ];

    const agentStatusBadge = (status: string) => {
        if (status === 'disabled') {
            return { label: 'Disabled', className: 'bg-red-50 text-red-600 border-red-100' };
        }
        if (status === 'pending') {
            return { label: 'Active', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
        }
        return { label: 'Active', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    };
    
    const staffMembers = filterStaffForAgentSession(
        db.staff?.data || [],
        sessionAgentIdResolved,
        db
    );
    const subAgents = filterSubAgentsForAgentSession(
        db.travelAgents?.data || [],
        sessionAgentIdResolved,
        db
    );

    const agencyStaffCount = useMemo(
        () => countAgencyStaff(db, sessionAgentIdResolved),
        [db, sessionAgentIdResolved, db.staff?.data]
    );

    const agencySubAgentCount = useMemo(
        () => countAgencySubAgents(db, sessionAgentIdResolved),
        [db, sessionAgentIdResolved, db.travelAgents?.data]
    );

    useEffect(() => {
        if ((isSubAgentSession || userRole === 'staff') && activeTab === 'sub-agents') {
            setActiveTab('staff');
        }
    }, [isSubAgentSession, userRole, activeTab]);

    const staffLimitReached = useMemo(() => {
        if (userRole === 'admin') return false;
        if (isUnlimitedPlanSlots(planLimits.staff)) return false;
        return agencyStaffCount >= planLimits.staff;
    }, [userRole, planLimits.staff, agencyStaffCount]);

    const staffLimitTitle = staffLimitReached
        ? `Plan limit reached: ${planLimits.staff} staff on ${currentPlan}. Upgrade in Plans.`
        : undefined;

    const canManageStaffMember = useCallback(
        (member: any) => canSessionManageStaffMember(member, sessionAgentIdResolved, db),
        [db, sessionAgentIdResolved]
    );

    const staffManageBlockedTitle = isSubAgentSession
        ? 'You can only edit or delete staff accounts you created'
        : 'You can only edit or delete staff accounts created by your main agency account';

    const openAddAgentModal = () => {
        resetAgentForm();
        setIsAddingAgent(true);
    };

    const openAddStaffModal = () => {
        if (staffLimitReached) return;
        setStaffForm({
            name: '',
            employeeId: '',
            password: '',
            role: 'Sales',
            status: 'active',
            permissions: defaultStaffPermissions(),
        });
        setEditingStaffId(null);
        setIsAddingStaff(true);
    };

    const handleAddStaff = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isIdDuplicate) return;

        // Enforce Plan Limits (Skip for Admin or when editing)
        if (!editingStaffId) {
            const staffCheck = canAddAgencyStaff(db, sessionAgentIdResolved);
            if (userRole !== 'admin' && !staffCheck.allowed) {
                alert(staffCheck.message);
                return;
            }
        }

        const staffPermissions = isSubAgentSession
            ? [...SUB_AGENT_STAFF_PERMISSIONS]
            : staffForm.permissions;

        if (editingStaffId) {
            const existingMember = (db.staff?.data || []).find((member: any) => member.id === editingStaffId);
            if (existingMember && !canManageStaffMember(existingMember)) {
                alert(staffManageBlockedTitle);
                return;
            }
            updateRecord('staff', editingStaffId, {
                ...staffForm,
                employeeId: staffForm.employeeId.trim(),
                password: staffForm.password.trim(),
                permissions: staffPermissions,
            });
        } else {
            addRecord('staff', {
                id: getNextId('staff', 'STF'),
                ...staffForm,
                employeeId: staffForm.employeeId.trim(),
                password: staffForm.password.trim(),
                permissions: staffPermissions,
                agentId: agencyId,
                createdByAgentId: staffCreatorAgentId,
                status: staffForm.status || 'active'
            });
        }
        
        setStaffForm({
            name: '',
            employeeId: '',
            password: '',
            role: 'Sales',
            status: 'active',
            permissions: defaultStaffPermissions(),
        });
        setIsAddingStaff(false);
        setEditingStaffId(null);
    };

    const handleEditStaff = (member: any) => {
        if (!canManageStaffMember(member)) {
            alert(staffManageBlockedTitle);
            return;
        }
        setStaffForm({
            name: member.name,
            employeeId: member.employeeId,
            password: member.password,
            role: member.role,
            status: member.status,
            permissions: getFormPermissions(member.permissions),
        });
        setEditingStaffId(member.id);
        setIsAddingStaff(true);
    };

    const handleDeleteStaff = (member: any) => {
        if (!canManageStaffMember(member)) {
            alert(staffManageBlockedTitle);
            return;
        }
        if (window.confirm('Are you sure you want to delete this staff member? This action cannot be undone.')) {
            deleteRecord('staff', member.id);
        }
    };

    const fillAgentFormFromRecord = useCallback((record: any) => {
        const parsedPhone = parseStoredAgentPhone(record.phone);
        setAgentPhoneError(undefined);
        setAgentForm({
            name: record.name || '',
            businessName: record.businessName || '',
            email: record.email || '',
            password: record.password || '',
            gstNumber: record.gstNumber || '',
            countryCode: parsedPhone.countryCode,
            phone: parsedPhone.phone,
            address: record.address || '',
            status:
                record.status === 'disabled'
                    ? 'disabled'
                    : record.status === 'rejected'
                      ? 'rejected'
                      : 'approved',
            plan: record.plan || 'Lite',
            planExpiresAt: toDateInputValue(record.planExpiresAt),
            trialEndsAt: toDateInputValue(record.trialEndsAt),
            isTrial: !!record.isTrial,
            permissions: getFormPermissions(record.permissions),
        });
        setEditingAgentId(record.id);
        setIsAddingAgent(true);
    }, []);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'agents' || tab === 'staff' || tab === 'sub-agents') {
            setActiveTab(tab);
        }
    }, [searchParams]);

    useEffect(() => {
        const focusTs = searchParams.get('focusTs');
        const staffId = searchParams.get('highlightStaffId');
        const agentId = searchParams.get('highlightAgentId');
        if (!focusTs || (!staffId && !agentId)) return;

        if (staffId) {
            setActiveTab('staff');
            setHighlightedStaffId(staffId);
        } else if (agentId) {
            const agent = (db.travelAgents?.data || []).find((a: any) => a.id === agentId);
            setHighlightedAgentId(agentId);
            if (userRole === 'admin') {
                setActiveTab('agents');
            } else if (agent?.parentId) {
                setActiveTab('sub-agents');
            }
        }

        const selector = staffId
            ? `[data-staff-id="${staffId}"]`
            : `[data-agent-id="${agentId}"]`;

        const scrollTimer = window.setTimeout(() => {
            const el = document.querySelector(selector) as HTMLElement | null;
            el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }, 180);

        const clearTimer = window.setTimeout(() => {
            setHighlightedStaffId('');
            setHighlightedAgentId('');
        }, 3200);

        return () => {
            clearTimeout(scrollTimer);
            clearTimeout(clearTimer);
        };
    }, [searchParams, db?.travelAgents?.data, userRole]);

    useEffect(() => {
        const editId = searchParams.get('editId');
        if (!editId || !db?.travelAgents?.data?.length) return;

        const record = db.travelAgents.data.find((a: any) => a.id === editId);
        if (!record) return;

        const canEdit =
            userRole === 'admin'
                ? isMainAgencyAgent(record)
                : userRole === 'agent' && record.parentId === agencyId;

        if (!canEdit) return;

        fillAgentFormFromRecord(record);

        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('editId');
        setSearchParams(nextParams, { replace: true });
    }, [
        searchParams,
        setSearchParams,
        db?.travelAgents?.data,
        userRole,
        agencyId,
        fillAgentFormFromRecord,
    ]);

    const handleEditSubAgent = (sub: any) => fillAgentFormFromRecord(sub);

    const handleEditMainAgent = (agent: any) => fillAgentFormFromRecord(agent);

    const handleSaveAgent = (e: React.FormEvent) => {
        e.preventDefault();

        if (isSubAgentSession) {
            alert('Sub-agents cannot create or manage other agents.');
            return;
        }

        const phoneValidationError =
            userRole === 'admin' && !agentForm.phone.trim()
                ? undefined
                : validateLocalPhone(agentForm.countryCode, agentForm.phone);
        if (phoneValidationError) {
            setAgentPhoneError(phoneValidationError);
            return;
        }
        setAgentPhoneError(undefined);

        const normalizedEmail = agentForm.email.trim().toLowerCase();

        const payload: Record<string, unknown> = {
            name: agentForm.name.trim(),
            businessName: agentForm.businessName.trim(),
            email: normalizedEmail,
            phone: formatStoredAgentPhone(agentForm.countryCode, agentForm.phone),
            address: agentForm.address?.trim() || '',
            gstNumber: agentForm.gstNumber?.trim() || '',
            status: agentForm.status,
        };

        if (userRole === 'admin') {
            payload.password = agentForm.password.trim() || 'password123';
        }

        if (userRole === 'agent') {
            const trimmedPassword = agentForm.password.trim();
            if (!editingAgentId && !trimmedPassword) {
                alert('Please set a password for staff portal login.');
                return;
            }
            payload.staffLoginId = normalizedEmail;
            if (trimmedPassword) {
                payload.password = trimmedPassword;
            }
            payload.permissions = agentForm.permissions;
        }

        if (userRole === 'admin') {
            payload.plan = agentForm.plan || 'Lite';
            payload.isTrial = agentForm.isTrial;
            payload.planExpiresAt = agentForm.planExpiresAt
                ? new Date(agentForm.planExpiresAt).toISOString()
                : null;
            payload.trialEndsAt =
                agentForm.isTrial && agentForm.trialEndsAt
                    ? new Date(agentForm.trialEndsAt).toISOString()
                    : null;
        }

        if (editingAgentId) {
            const existing = (db.travelAgents?.data || []).find((a: any) => a.id === editingAgentId);
            const planChanged =
                userRole === 'admin' &&
                (existing?.plan !== payload.plan ||
                    String(existing?.planExpiresAt || '') !== String(payload.planExpiresAt || ''));
            updateRecord('travelAgents', editingAgentId, {
                ...payload,
                ...(userRole !== 'admin'
                    ? {
                          password:
                              agentForm.password.trim() ||
                              existing?.password ||
                              'password123',
                          staffLoginId: normalizedEmail,
                      }
                    : {}),
                parentId: existing?.parentId ?? (userRole === 'agent' ? agencyId : null),
                joinedDate: existing?.joinedDate,
                ...(planChanged ? { planRenewedAt: new Date().toISOString() } : {}),
                ...(userRole === 'agent'
                    ? {
                          plan: mainAgencyAgent?.plan || 'Lite',
                          isTrial: mainAgencyAgent?.isTrial ?? false,
                          trialEndsAt: mainAgencyAgent?.trialEndsAt ?? null,
                          planExpiresAt: mainAgencyAgent?.planExpiresAt ?? null,
                      }
                    : {}),
            });
        } else {
            const isAdminCreate = userRole === 'admin';
            const planFields = isAdminCreate
                ? buildApprovalPlanFields(
                      {
                          plan: agentForm.plan || 'Lite',
                          isTrial: agentForm.isTrial,
                          trialEndsAt: agentForm.trialEndsAt,
                          planExpiresAt: agentForm.planExpiresAt,
                      },
                      db.plans?.data || []
                  )
                : {};
            const inheritedPlan =
                userRole === 'agent' && mainAgencyAgent
                    ? {
                          plan: mainAgencyAgent.plan || 'Lite',
                          isTrial: mainAgencyAgent.isTrial ?? false,
                          planExpiresAt: mainAgencyAgent.planExpiresAt ?? null,
                          trialEndsAt: mainAgencyAgent.trialEndsAt ?? null,
                      }
                    : {
                          plan: isAdminCreate ? agentForm.plan || 'Lite' : 'Lite',
                          isTrial: isAdminCreate ? agentForm.isTrial : false,
                          planExpiresAt:
                              isAdminCreate && agentForm.planExpiresAt
                                  ? new Date(agentForm.planExpiresAt).toISOString()
                                  : (planFields.planExpiresAt as string) || null,
                          trialEndsAt:
                              isAdminCreate && agentForm.isTrial && agentForm.trialEndsAt
                                  ? new Date(agentForm.trialEndsAt).toISOString()
                                  : (planFields.trialEndsAt as string) || null,
                      };
            addRecord('travelAgents', {
                id: getNextId('travelAgents', 'AGT'),
                ...payload,
                ...(userRole !== 'admin'
                    ? {
                          password: agentForm.password.trim(),
                          staffLoginId: normalizedEmail,
                      }
                    : {}),
                status: 'approved',
                joinedDate: new Date().toISOString().split('T')[0],
                parentId: userRole === 'agent' ? agencyId : null,
                ...inheritedPlan,
                ...planFields,
            });
        }

        resetAgentForm();
        setIsAddingAgent(false);
    };

    const toggleStaffStatus = (member: any) => {
        if (!canManageStaffMember(member)) {
            alert(staffManageBlockedTitle);
            return;
        }
        updateRecord('staff', member.id, {
            status: member.status === 'active' ? 'inactive' : 'active',
        });
    };

    return (
        <div className="h-full flex flex-col gap-6 overflow-hidden font-sans">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Users className="text-crm-600" size={28} /> 
                        {userRole === 'admin' ? 'Agent Administration' : 'Agents/Team Management'}
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">
                        Manage your {userRole === 'admin' ? 'global network of agents' : 'agency team and agents'}.
                    </p>
                </div>

                {userRole === 'agent' && (
                    <div className="bg-white border border-slate-200 px-4 py-3 sm:px-6 rounded-2xl flex flex-wrap items-center gap-4 sm:gap-6 shadow-sm w-full lg:w-auto">
                        <div className="flex flex-col min-w-[100px]">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Plan</span>
                            <div className="flex items-center gap-2">
                                <Crown size={14} className="text-amber-500 shrink-0" />
                                <span className="text-sm font-bold text-slate-800">{currentPlan}</span>
                            </div>
                        </div>
                        <div className="hidden sm:block h-8 w-px bg-slate-100" />
                        <div className="flex flex-col min-w-[100px]">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {isSubAgentSession ? 'Agency Staff Slots' : 'Staff Slots'}
                            </span>
                            <span className={`text-sm font-bold ${agencyStaffCount >= planLimits.staff ? 'text-red-500' : 'text-crm-600'}`}>
                                {agencyStaffCount} / {isUnlimitedPlanSlots(planLimits.staff) ? '∞' : planLimits.staff}
                            </span>
                        </div>
                        {!isSubAgentSession && (
                            <>
                                <div className="hidden sm:block h-8 w-px bg-slate-100" />
                                <div className="flex flex-col min-w-[100px]">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sub-Agent Slots</span>
                                    <span className="text-sm font-bold text-crm-600">
                                        {agencySubAgentCount}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                )}
                {userRole === 'admin' && (
                    <button onClick={openAddAgentModal} className="btn-primary flex items-center gap-2 py-3 px-6 bg-slate-900 hover:bg-slate-800">
                        <UserPlus size={18} /> Add Agent
                    </button>
                )}
                {userRole === 'agent' && !isSubAgentSession && activeTab === 'sub-agents' && (
                    <button
                        type="button"
                        onClick={openAddAgentModal}
                        className="btn-primary flex items-center gap-2 py-3 px-6 bg-slate-900 hover:bg-slate-800"
                    >
                        <UserPlus size={18} /> Add Sub-Agent
                    </button>
                )}
                {canManageStaffTeam && activeTab === 'staff' && (
                    <button
                        type="button"
                        onClick={openAddStaffModal}
                        disabled={staffLimitReached}
                        title={staffLimitTitle}
                        className="btn-primary flex items-center gap-2 py-3 px-6 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-crm-600 disabled:active:scale-100"
                    >
                        <UserPlus size={18} /> Add Employee
                    </button>
                )}
            </div>

            {/* Role-Based Tabs */}
            {userRole !== 'admin' && (
            <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl self-start max-w-full overflow-x-auto">
                {userRole === 'agent' && (
                    <>
                        {!isSubAgentSession && (
                            <button onClick={() => setActiveTab('sub-agents')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'sub-agents' ? 'bg-white text-crm-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>My Agents</button>
                        )}
                        <button onClick={() => setActiveTab('staff')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'staff' ? 'bg-white text-crm-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Staff Accounts</button>
                    </>
                )}
                {canManageStaffTeam && userRole !== 'agent' && (
                    <button onClick={() => setActiveTab('staff')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'staff' ? 'bg-white text-crm-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Staff Accounts</button>
                )}
            </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {/* ADMIN: Travel Agents List */}
                {userRole === 'admin' && activeTab === 'agents' && (
                    <>
                        <div className="mb-4 flex flex-col lg:flex-row lg:items-center gap-4">
                            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 lg:flex-wrap lg:overflow-visible">
                                {agentSubscriptionFilterOptions.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setAgentSubscriptionFilter(option.id)}
                                        className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                                            agentSubscriptionFilter === option.id
                                                ? 'bg-crm-600 text-white border-crm-600'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        {option.label}
                                        <span className="ml-2 opacity-80">
                                            ({agentSubscriptionFilterCounts[option.id]})
                                        </span>
                                    </button>
                                ))}
                            </div>
                            <div className="relative w-full lg:w-72 lg:ml-auto shrink-0">
                                <Search
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    size={16}
                                />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search agents..."
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-crm-500/20 focus:border-crm-400"
                                />
                            </div>
                        </div>
                        {agentSubscriptionFilter === 'expiring_soon' && (
                            <p className="mb-4 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2">
                                Showing agents whose plan or trial ends within the next 10 days.
                            </p>
                        )}
                    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-3 xl:grid-cols-3 lg:gap-4">
                        {filteredMainAgents.map((agent: any) => {
                            const expiry = getAgentPlanExpiryDisplay(agent);
                            const statusBadge = agentStatusBadge(agent.status);
                            const itemProps = {
                                agent,
                                expiry,
                                statusBadge,
                                onView: () => setViewingAgent(agent),
                                onEdit: () => handleEditMainAgent(agent),
                            };
                            return (
                                <div key={agent.id} className="contents">
                                    <div
                                        className={`lg:hidden ${highlightedAgentId === agent.id ? 'ring-2 ring-crm-500 rounded-xl' : ''}`}
                                        data-agent-id={agent.id}
                                    >
                                        <MainAgentListRow {...itemProps} />
                                    </div>
                                    <div
                                        className={`hidden lg:block ${highlightedAgentId === agent.id ? 'ring-2 ring-crm-500 rounded-[2.5rem]' : ''}`}
                                        data-agent-id={agent.id}
                                    >
                                        <MainAgentCard {...itemProps} />
                                    </div>
                                </div>
                            );
                        })}
                        {filteredMainAgents.length === 0 && (
                            <div className="lg:col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                                <Users size={40} className="mx-auto text-slate-200 mb-4" />
                                <p className="text-slate-400 font-bold uppercase text-xs tracking-[0.2em]">
                                    {mainAgents.length === 0
                                        ? 'No agents yet'
                                        : agentSubscriptionFilter === 'all'
                                          ? 'No agents match your search'
                                          : `No ${agentSubscriptionFilterOptions.find((o) => o.id === agentSubscriptionFilter)?.label.toLowerCase() || 'agents'} found`}
                                </p>
                            </div>
                        )}
                    </div>
                    </>
                )}

                {/* AGENT / STAFF: Staff Management */}
                {canManageStaffTeam && activeTab === 'staff' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">Your Team Accounts</h2>
                        </div>

                        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-3 xl:grid-cols-3 lg:gap-4">
                            {staffMembers.map((member: any) => {
                                const canManage = canManageStaffMember(member);
                                return (
                                <div key={member.id} className="contents">
                                    {/* List — mobile & tablet */}
                                    <div
                                        data-staff-id={member.id}
                                        className={`lg:hidden flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200 border-l-4 border-l-crm-500 shadow-sm ${
                                            highlightedStaffId === member.id ? 'ring-2 ring-crm-500' : ''
                                        }`}
                                    >
                                        <div className="w-10 h-10 shrink-0 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center">
                                            <Briefcase size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <h3 className="text-sm font-bold text-slate-800 truncate">{member.name}</h3>
                                                    <p className="text-[10px] font-black uppercase text-slate-500 mt-0.5">{member.role}</p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditStaff(member)}
                                                        disabled={!canManage}
                                                        title={canManage ? 'Edit staff' : staffManageBlockedTitle}
                                                        className={`p-1.5 rounded-lg transition-all ${canManage ? 'text-slate-400 hover:text-crm-600 hover:bg-crm-50' : 'text-slate-300 cursor-not-allowed opacity-50'}`}
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteStaff(member)}
                                                        disabled={!canManage}
                                                        title={canManage ? 'Delete staff' : staffManageBlockedTitle}
                                                        className={`p-1.5 rounded-lg transition-all ${canManage ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-300 cursor-not-allowed opacity-50'}`}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                <span className="bg-crm-50 text-crm-700 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase border border-crm-100">{currentPlan} Plan</span>
                                                <span className="bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase border border-slate-100 truncate max-w-full">{displayPermissionSummary(member.permissions)}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-slate-500">
                                                <span
                                                    className={`font-black text-[10px] ${canManage ? 'team-field-value' : 'team-field-value--restricted'}`}
                                                    title={canManage ? undefined : staffManageBlockedTitle}
                                                >
                                                    ID: {member.employeeId}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleStaffStatus(member)}
                                                    disabled={!canManage}
                                                    title={canManage ? 'Toggle staff access' : staffManageBlockedTitle}
                                                    className={`px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase transition-all ${
                                                        canManage
                                                            ? member.status === 'active'
                                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                                                                : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
                                                            : 'team-access-badge--restricted'
                                                    }`}
                                                >
                                                    {member.status === 'active' ? 'Enabled' : 'Disabled'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Card — laptop+ */}
                                    <div
                                        data-staff-id={member.id}
                                        className={`hidden lg:block bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md transition-all border-l-4 border-l-crm-500 h-full ${
                                            highlightedStaffId === member.id ? 'ring-2 ring-crm-500' : ''
                                        }`}
                                    >
                                     <div className="flex justify-between items-start mb-2 gap-2">
                                         <div className="w-9 h-9 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center shrink-0"><Briefcase size={18} /></div>
                                         <div className="flex items-center gap-1 flex-wrap justify-end">
                                             <button
                                                 type="button"
                                                 onClick={() => handleEditStaff(member)}
                                                 disabled={!canManage}
                                                 title={canManage ? 'Edit staff' : staffManageBlockedTitle}
                                                 className={`p-1 rounded-md transition-all ${canManage ? 'text-slate-400 hover:text-crm-600 hover:bg-crm-50' : 'text-slate-300 cursor-not-allowed opacity-50'}`}
                                             >
                                                 <Edit2 size={13} />
                                             </button>
                                             <button
                                                 type="button"
                                                 onClick={() => handleDeleteStaff(member)}
                                                 disabled={!canManage}
                                                 title={canManage ? 'Delete staff' : staffManageBlockedTitle}
                                                 className={`p-1 rounded-md transition-all ${canManage ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-300 cursor-not-allowed opacity-50'}`}
                                             >
                                                 <Trash2 size={13} />
                                             </button>
                                             <div className="text-[8px] font-black uppercase px-2 py-0.5 bg-slate-50 text-slate-500 rounded-full border border-slate-100">{member.role}</div>
                                         </div>
                                     </div>
                                    <h3 className="text-xs font-bold text-slate-800 truncate">{member.name}</h3>
                                    <div className="flex flex-wrap gap-1 mt-1.5 mb-1.5">
                                        <span className="bg-crm-50 text-crm-700 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wide border border-crm-100">
                                            {currentPlan} Plan
                                        </span>
                                        <span className="bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wide border border-slate-100 truncate max-w-full">
                                            {displayPermissionSummary(member.permissions)}
                                        </span>
                                    </div>
                                    <div className={`team-field-panel ${!canManage ? 'team-field-panel--restricted' : ''}`}>
                                         <div className="flex justify-between items-center gap-2 min-w-0">
                                             <span className="text-[8px] font-black uppercase tracking-widest shrink-0 team-field-label">Employee ID</span>
                                             <span
                                                 className={`font-black text-[10px] truncate ${canManage ? 'team-field-value' : 'team-field-value--restricted'}`}
                                                 title={canManage ? undefined : staffManageBlockedTitle}
                                             >
                                                 {member.employeeId}
                                             </span>
                                         </div>
                                         <div className="flex justify-between items-center gap-2">
                                             <span className="text-[8px] font-black uppercase tracking-widest shrink-0 team-field-label">Access</span>
                                             <button
                                                 type="button"
                                                 onClick={() => toggleStaffStatus(member)}
                                                 disabled={!canManage}
                                                 title={canManage ? 'Toggle staff access' : staffManageBlockedTitle}
                                                 className={`px-1.5 py-0.5 rounded border text-[8px] font-black uppercase tracking-widest transition-all shrink-0 ${
                                                     canManage
                                                         ? member.status === 'active'
                                                             ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                                                             : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
                                                         : 'team-access-badge--restricted'
                                                 }`}
                                             >
                                                 {member.status === 'active' ? 'ENABLED' : 'DISABLED'}
                                             </button>
                                         </div>
                                     </div>
                                 </div>
                                </div>
                            );
                            })}
                            {staffMembers.length === 0 && (
                                <div className="lg:col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                                    <UserPlus size={40} className="mx-auto text-slate-200 mb-4" />
                                    <p className="text-slate-400 font-bold uppercase text-xs tracking-[0.2em]">No staff accounts created yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* AGENT: Sub-Agent Management */}
                {userRole === 'agent' && !isSubAgentSession && activeTab === 'sub-agents' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">Your Sub-Agent Network</h2>
                        </div>

                        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-3 xl:grid-cols-3 lg:gap-4">
                            {subAgents.map((sub: any) => (
                                <div key={sub.id} className="contents">
                                    {/* List — mobile & tablet */}
                                    <div
                                        data-agent-id={sub.id}
                                        className={`lg:hidden flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200 border-l-4 border-l-indigo-500 shadow-sm ${
                                            highlightedAgentId === sub.id ? 'ring-2 ring-crm-500' : ''
                                        }`}
                                    >
                                        <div className="w-9 h-9 shrink-0 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-black text-sm">
                                            {sub.name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <h3 className="text-sm font-bold text-slate-800 truncate leading-tight">{sub.name}</h3>
                                                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider truncate">{sub.businessName}</p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-1">
                                                    <button type="button" onClick={() => handleEditSubAgent(sub)} className="p-1 text-slate-400 hover:text-crm-600 hover:bg-crm-50 rounded-lg transition-all" title="Edit agent details"><Edit2 size={14} /></button>
                                                    <span className={`${agentCardChipClass} ${sub.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                        {sub.status === 'approved' ? 'Active' : 'Off'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={agentCardBadgeRowInlineClass}>
                                                <span className={`${agentCardBadgeInlineClass} bg-crm-50 text-crm-700 border-crm-100`}>
                                                    {currentPlan} Plan
                                                </span>
                                                <span className={`${agentCardBadgeInlineClass} bg-slate-50 text-slate-600 border-slate-100 truncate max-w-full`}>
                                                    {displayPermissionSummary(sub.permissions)}
                                                </span>
                                            </div>
                                            <div className={agentCardContactSectionClass}>
                                                <p className={`truncate flex items-center gap-1 min-w-0 ${agentCardMetaClass}`} title={sub.email}>
                                                    <Mail size={11} className="shrink-0 text-slate-400" /> {sub.email}
                                                </p>
                                                <p className={`truncate flex items-center gap-1 min-w-0 ${agentCardMetaClass}`} title={sub.phone || undefined}>
                                                    <Phone size={11} className="shrink-0 text-slate-400" /> {sub.phone || '—'}
                                                </p>
                                                <p className={`truncate flex items-center gap-1 min-w-0 ${agentCardMetaClass}`} title={sub.password}>
                                                    <Key size={11} className="shrink-0 text-slate-400" /> Pwd: {sub.password || '—'}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => updateRecord('travelAgents', sub.id, { status: sub.status === 'approved' ? 'disabled' : 'approved' })}
                                                className={`mt-2 w-full py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${sub.status === 'approved' ? 'border-red-100 text-red-500 hover:bg-red-50' : 'border-emerald-100 text-emerald-600 hover:bg-emerald-50'}`}
                                            >
                                                {sub.status === 'approved' ? 'Deactivate' : 'Activate'}
                                            </button>
                                        </div>
                                    </div>
                                    {/* Card — laptop+ */}
                                    <div
                                        data-agent-id={sub.id}
                                        className={`hidden lg:block bg-white rounded-xl border border-slate-200 p-2.5 shadow-sm hover:shadow-md transition-all border-l-4 border-l-indigo-500 h-full flex flex-col ${
                                            highlightedAgentId === sub.id ? 'ring-2 ring-crm-500' : ''
                                        }`}
                                    >
                                    <div className="flex items-start gap-2 mb-1.5">
                                        <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-black text-sm shrink-0">
                                            {sub.name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-bold text-slate-800 truncate leading-tight">{sub.name}</h3>
                                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider truncate">
                                                {sub.businessName}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => handleEditSubAgent(sub)}
                                                className="p-1 text-slate-400 hover:text-crm-600 hover:bg-crm-50 rounded-md transition-all"
                                                title="Edit agent details"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <div className={`${agentCardChipClass} shrink-0 ${sub.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                {sub.status === 'approved' ? 'Active' : 'Disabled'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={agentCardBadgeRowInlineClass}>
                                        <span className={`${agentCardBadgeInlineClass} bg-crm-50 text-crm-700 border-crm-100`}>
                                            {currentPlan} Plan
                                        </span>
                                        <span className={`${agentCardBadgeInlineClass} bg-slate-50 text-slate-600 border-slate-100 truncate max-w-full`}>
                                            {displayPermissionSummary(sub.permissions)}
                                        </span>
                                    </div>
                                    
                                    <div className={`${agentCardContactSectionClass} flex-1 min-w-0`}>
                                        <div className={`flex items-center gap-1 ${agentCardMetaClass}`} title={sub.email}>
                                            <Mail size={11} className="shrink-0 text-slate-400" />
                                            <span className="truncate">{sub.email}</span>
                                        </div>
                                        <div className={`flex items-center gap-1 ${agentCardMetaClass}`} title={sub.phone || undefined}>
                                            <Phone size={11} className="shrink-0 text-slate-400" />
                                            <span className="truncate">{sub.phone || '—'}</span>
                                        </div>
                                        <div className={`flex items-center gap-1 ${agentCardMetaClass}`} title={sub.password}>
                                            <Key size={11} className="shrink-0 text-slate-400" />
                                            <span className="truncate">Pwd: {sub.password || '—'}</span>
                                        </div>
                                    </div>

                                    <button 
                                        type="button"
                                        onClick={() => updateRecord('travelAgents', sub.id, { status: sub.status === 'approved' ? 'disabled' : 'approved' })}
                                        className={`w-full py-1.5 rounded-lg text-[10px] lg:text-[11px] font-black uppercase tracking-wider transition-all border ${sub.status === 'approved' ? 'border-red-100 text-red-500 hover:bg-red-50' : 'border-emerald-100 text-emerald-600 hover:bg-emerald-50'}`}
                                    >
                                        {sub.status === 'approved' ? 'Deactivate Agent' : 'Activate agent'}
                                    </button>
                                </div>
                                </div>
                            ))}
                            {subAgents.length === 0 && (
                                <div className="lg:col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                                    <Globe size={40} className="mx-auto text-slate-200 mb-4" />
                                    <p className="text-slate-400 font-bold uppercase text-xs tracking-[0.2em]">No sub-agents added yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Add Staff Modal */}
            {isAddingStaff && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className="p-10 overflow-y-auto">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{editingStaffId ? 'Edit Staff' : 'Add Staff'}</h2>
                                    <p className="text-sm text-slate-500">{editingStaffId ? 'Update employee details' : 'Create a new employee login'}</p>
                                </div>
                                <button onClick={() => { setIsAddingStaff(false); setEditingStaffId(null); }} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24} /></button>
                            </div>
                            
                            <form onSubmit={handleAddStaff} className="space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Staff Member Name</label>
                                        <div className="relative"><User className="absolute left-4 top-3.5 text-slate-400" size={18} /><input required value={staffForm.name} onChange={e => setStaffForm({...staffForm, name: e.target.value})} type="text" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold" placeholder="Ex: Rahul Singh" /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Employee ID</label>
                                            <div className="relative">
                                                <Briefcase className={`absolute left-4 top-3.5 ${isIdDuplicate ? 'text-red-500' : 'text-slate-400'}`} size={18} />
                                                <input required value={staffForm.employeeId} onChange={e => setStaffForm({...staffForm, employeeId: e.target.value})} type="text" className={`w-full pl-12 pr-4 py-3.5 bg-slate-50 border rounded-2xl text-sm outline-none font-bold ${isIdDuplicate ? 'border-red-500 ring-2 ring-red-50' : 'border-slate-200'}`} placeholder="E-101 or 12345" />
                                            </div>
                                            {isIdDuplicate && <p className="text-[9px] text-red-500 mt-1 font-black uppercase tracking-wider animate-bounce">ID already taken!</p>}
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Password</label>
                                            <div className="relative"><Key className="absolute left-4 top-3.5 text-slate-400" size={18} /><input required value={staffForm.password} onChange={e => setStaffForm({...staffForm, password: e.target.value})} type="text" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold" /></div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Department / Role</label>
                                        <div className="relative crm-select-wrap">
                                        <select value={staffForm.role} onChange={e => setStaffForm({...staffForm, role: e.target.value})} className="w-full px-4 py-3.5 pr-10 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold appearance-none cursor-pointer">
                                            <option value="Sales">Sales & Marketing</option>
                                            <option value="Operations">Operations</option>
                                            <option value="Accounts">Accounts</option>
                                            <option value="Management">Management</option>
                                        </select>
                                        <DropdownChevron size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    {!isSubAgentSession && (
                                        <PermissionSelect
                                            value={staffForm.permissions}
                                            onChange={(permissions) => setStaffForm({ ...staffForm, permissions })}
                                        />
                                    )}
                                    {isSubAgentSession && (
                                        <p className="text-[9px] text-slate-400 font-medium bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                                            Staff accounts automatically get access to Leads, Quotations, and Bookings.
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={isIdDuplicate || (!editingStaffId && staffLimitReached)}
                                    title={!editingStaffId && staffLimitReached ? staffLimitTitle : undefined}
                                    className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all ${isIdDuplicate || (!editingStaffId && staffLimitReached) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-crm-600 hover:bg-crm-700 text-white shadow-crm-200 active:scale-[0.98]'}`}
                                >
                                    {editingStaffId ? 'Update Staff Account' : 'Create Staff Account'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Add / Edit Agent Modal */}
            {isAddingAgent && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                        <div className="p-10">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                        {editingAgentId
                                            ? (userRole === 'admin' ? 'Edit Agent' : 'Edit Sub-Agent')
                                            : (userRole === 'admin' ? 'Add New Agent' : 'Add Sub-Agent')}
                                    </h2>
                                    <p className="text-sm text-slate-500">
                                        {editingAgentId
                                            ? 'Update agent details and save changes'
                                            : (userRole === 'admin' ? 'Create a new travel agency' : 'Create a new sub-agent account')}
                                    </p>
                                </div>
                                <button onClick={() => { setIsAddingAgent(false); resetAgentForm(); }} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24} /></button>
                            </div>
                            
                            <form onSubmit={handleSaveAgent} className="space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Agent Full Name</label>
                                        <div className="relative"><User className="absolute left-4 top-3.5 text-slate-400" size={18} /><input required value={agentForm.name} onChange={e => setAgentForm({...agentForm, name: e.target.value})} type="text" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold" placeholder="Ex: Amit Patel" /></div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Agency / Business Name</label>
                                        <div className="relative"><Building className="absolute left-4 top-3.5 text-slate-400" size={18} /><input required value={agentForm.businessName} onChange={e => setAgentForm({...agentForm, businessName: e.target.value})} type="text" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold" placeholder="Ex: FlyHigh Travels" /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Email Address</label>
                                            <div className="relative"><Mail className="absolute left-4 top-3.5 text-slate-400" size={18} /><input required value={agentForm.email} onChange={e => setAgentForm({...agentForm, email: e.target.value})} type="email" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold" placeholder="agent@example.com" /></div>
                                        </div>
                                        {(userRole === 'admin' || userRole === 'agent') && (
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                                    Password
                                                    {userRole === 'agent' && editingAgentId ? ' (leave blank to keep)' : ''}
                                                </label>
                                                <div className="relative">
                                                    <Key className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                                    <input
                                                        required={userRole === 'admin' || !editingAgentId}
                                                        value={agentForm.password}
                                                        onChange={e => setAgentForm({ ...agentForm, password: e.target.value })}
                                                        type={userRole === 'agent' ? 'password' : 'text'}
                                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold"
                                                        placeholder={userRole === 'agent' ? 'Staff portal password' : undefined}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">GST Number</label>
                                            <div className="relative"><Landmark className="absolute left-4 top-3.5 text-slate-400" size={18} /><input value={agentForm.gstNumber} onChange={e => setAgentForm({...agentForm, gstNumber: e.target.value})} type="text" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold" placeholder="Ex: 27ABCDE1234F1Z5" /></div>
                                        </div>
                                    </div>
                                    {userRole === 'agent' && (
                                        <p className="text-[9px] text-slate-400 -mt-2 font-medium">
                                            Sub-agents sign in via <span className="font-bold">Employee Login</span> using their email address and this password.
                                        </p>
                                    )}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                            Mobile Number
                                            {userRole === 'admin' ? ' (optional)' : ''}
                                        </label>
                                        <div className="flex gap-2">
                                            <div className="w-44 shrink-0 relative crm-select-wrap">
                                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" size={14} />
                                                <select
                                                    value={agentForm.countryCode}
                                                    onChange={(e) => {
                                                        setAgentForm({
                                                            ...agentForm,
                                                            countryCode: e.target.value,
                                                            phone: '',
                                                        });
                                                        setAgentPhoneError(undefined);
                                                    }}
                                                    className="w-full pl-8 pr-8 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-1 focus:ring-crm-500 outline-none appearance-none cursor-pointer"
                                                >
                                                    {COUNTRY_PHONE_DATA.map((country) => (
                                                        <option key={country.code} value={country.code}>
                                                            {country.name} ({country.code})
                                                        </option>
                                                    ))}
                                                </select>
                                                <DropdownChevron size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            </div>
                                            <div className="flex-1 relative min-w-0">
                                                <Phone className="absolute left-4 top-3.5 text-slate-400" size={18} />
                                                <input
                                                    value={agentForm.phone}
                                                    onChange={(e) => {
                                                        setAgentForm({
                                                            ...agentForm,
                                                            phone: sanitizeLocalPhoneDigits(e.target.value, agentForm.countryCode),
                                                        });
                                                        if (agentPhoneError) setAgentPhoneError(undefined);
                                                    }}
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    maxLength={requiredPhoneDigits}
                                                    className={`w-full pl-12 pr-14 py-3.5 bg-slate-50 border rounded-2xl text-sm outline-none font-bold tracking-widest ${
                                                        agentPhoneError
                                                            ? 'border-red-400 bg-red-50/30'
                                                            : agentForm.phone.length > 0 && agentForm.phone.length < requiredPhoneDigits
                                                              ? 'border-amber-300 bg-amber-50/30'
                                                              : agentForm.phone.length === requiredPhoneDigits
                                                                ? 'border-emerald-300 bg-emerald-50/30'
                                                                : 'border-slate-200'
                                                    }`}
                                                    placeholder={`${requiredPhoneDigits} digits`}
                                                />
                                                <span
                                                    className={`absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black tabular-nums ${
                                                        agentForm.phone.length === requiredPhoneDigits
                                                            ? 'text-emerald-500'
                                                            : agentForm.phone.length > 0
                                                              ? 'text-amber-500'
                                                              : 'text-slate-300'
                                                    }`}
                                                >
                                                    {agentForm.phone.length}/{requiredPhoneDigits}
                                                </span>
                                            </div>
                                        </div>
                                        {agentPhoneError && (
                                            <p className="mt-1.5 text-[11px] font-semibold text-red-600">{agentPhoneError}</p>
                                        )}
                                        {!agentPhoneError && agentForm.phone.length > 0 && agentForm.phone.length < requiredPhoneDigits && (
                                            <p className="mt-1.5 text-[11px] font-semibold text-amber-600">
                                                {PHONE_LIMITS[agentForm.countryCode]?.name ?? 'Selected country'} numbers require exactly {requiredPhoneDigits} digits
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Office Address</label>
                                        <div className="relative"><MapPin className="absolute left-4 top-3.5 text-slate-400" size={18} /><input value={agentForm.address} onChange={e => setAgentForm({...agentForm, address: e.target.value})} type="text" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold" placeholder="City, Country" /></div>
                                    </div>
                                    {userRole === 'agent' && (
                                        <PermissionSelect
                                            value={agentForm.permissions}
                                            onChange={(permissions) => setAgentForm({ ...agentForm, permissions })}
                                            hint="Sub-agents sign in via Employee Login and will only see the modules you enable here."
                                        />
                                    )}
                                    {userRole === 'admin' && (
                                        <>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Subscription Plan</label>
                                                <div className="relative crm-select-wrap">
                                                <select
                                                    value={agentForm.plan}
                                                    onChange={e => setAgentForm({ ...agentForm, plan: e.target.value })}
                                                    className="w-full px-4 py-3.5 pr-10 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold appearance-none cursor-pointer"
                                                >
                                                    {(planOptions.length ? planOptions : ['Lite', 'Growth', 'Enterprise']).map((p: string) => (
                                                        <option key={p} value={p}>{p}</option>
                                                    ))}
                                                </select>
                                                <DropdownChevron size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Plan Expires (paid plans)</label>
                                                    <input
                                                        type="date"
                                                        value={agentForm.planExpiresAt}
                                                        onChange={e => setAgentForm({ ...agentForm, planExpiresAt: e.target.value })}
                                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Trial Ends</label>
                                                    <input
                                                        type="date"
                                                        value={agentForm.trialEndsAt}
                                                        disabled={!agentForm.isTrial}
                                                        onChange={e => setAgentForm({ ...agentForm, trialEndsAt: e.target.value })}
                                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold disabled:opacity-50 disabled:dark:opacity-100 disabled:dark:text-slate-200 disabled:dark:bg-slate-700 disabled:dark:border-slate-500"
                                                    />
                                                </div>
                                            </div>
                                            <label className="flex items-center gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={agentForm.isTrial}
                                                    onChange={e => setAgentForm({ ...agentForm, isTrial: e.target.checked })}
                                                    className="w-4 h-4 rounded border-slate-300 text-crm-600"
                                                />
                                                <span className="text-xs font-bold text-slate-600">Trial account (30-day trial if no end date set)</span>
                                            </label>
                                        </>
                                    )}
                                    {editingAgentId && (
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Account Status</label>
                                            <div className="relative crm-select-wrap">
                                            <select
                                                value={agentForm.status}
                                                onChange={e => setAgentForm({ ...agentForm, status: e.target.value })}
                                                className="w-full px-4 py-3.5 pr-10 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold appearance-none cursor-pointer"
                                            >
                                                {userRole === 'admin' ? (
                                                    <>
                                                        <option value="approved">Active</option>
                                                        <option value="disabled">Disabled</option>
                                                        <option value="rejected">Rejected</option>
                                                    </>
                                                ) : (
                                                    <>
                                                        <option value="approved">Active</option>
                                                        <option value="disabled">Disabled</option>
                                                    </>
                                                )}
                                            </select>
                                            <DropdownChevron size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    )}
                                    {userRole === 'admin' && !editingAgentId && (
                                        <p className="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                                            New agents are created as active. Use Edit Agent later to disable access or change plan.
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all bg-crm-600 hover:bg-crm-700 text-white shadow-crm-200 active:scale-[0.98]"
                                >
                                    {editingAgentId
                                        ? 'Save Changes'
                                        : userRole === 'admin'
                                          ? 'Create Agent'
                                          : 'Create Sub-agent Account'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin: View agent profile */}
            {viewingAgent && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-10">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Agent Profile</h2>
                                    <p className="text-sm text-slate-500">{viewingAgent.id}</p>
                                </div>
                                <button type="button" onClick={() => setViewingAgent(null)} className="text-slate-400 hover:text-red-500"><X size={24} /></button>
                            </div>
                            {(() => {
                                const expiry = getAgentPlanExpiryDisplay(viewingAgent);
                                return (
                                    <div className="space-y-4 text-sm">
                                        <div className="flex items-center gap-4">
                                            <AgentAvatar
                                                agent={viewingAgent}
                                                className="w-16 h-16"
                                                roundedClassName="rounded-2xl"
                                                textClassName="text-xl"
                                            />
                                            <div className="min-w-0">
                                                <p className="text-lg font-black text-slate-900 truncate">{viewingAgent.name}</p>
                                                <p className="text-sm font-bold text-crm-600 uppercase tracking-wider truncate">
                                                    {viewingAgent.businessName}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-600">{viewingAgent.status}</span>
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-crm-50 text-crm-700">{viewingAgent.plan || 'Lite'}</span>
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${planExpiryBadgeClass(expiry.tone)}`}>{expiry.label}: {expiry.text}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Name</p><p className="font-bold text-slate-800">{viewingAgent.name}</p></div>
                                            <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Business</p><p className="font-bold text-slate-800">{viewingAgent.businessName}</p></div>
                                            <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Email</p><p className="font-bold text-slate-800">{viewingAgent.email}</p></div>
                                            <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Password</p><p className="font-bold text-slate-800 font-mono">{viewingAgent.password}</p></div>
                                            <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Phone</p><p className="font-bold text-slate-800">{viewingAgent.phone || '—'}</p></div>
                                            <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Joined</p><p className="font-bold text-slate-800">{viewingAgent.joinedDate || '—'}</p></div>
                                        </div>
                                        <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Address</p><p className="font-bold text-slate-800">{viewingAgent.address || '—'}</p></div>
                                        <div className="flex gap-3 pt-4">
                                            <button type="button" onClick={() => { handleEditMainAgent(viewingAgent); setViewingAgent(null); }} className="flex-1 py-3 bg-crm-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest">Edit Profile</button>
                                            <button type="button" onClick={() => setViewingAgent(null)} className="px-6 py-3 border border-slate-200 rounded-2xl font-black text-xs uppercase text-slate-500">Close</button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TravelAgent;
