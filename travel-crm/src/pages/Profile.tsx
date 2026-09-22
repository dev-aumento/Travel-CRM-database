import React, { useEffect, useRef, useState, useMemo } from 'react';
import { User, Mail, Phone, MapPin, Award, Save, X, Camera, Building, Briefcase } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import { findSessionUser, buildProfileSavePlan, isBookingFromConfirmedLead, recordVisibleToSession, resolveProfileLocationFromRecord, resolveSessionDisplayName } from '../utils/databaseSync';
import { getStoredSessionUserId } from '../utils/authLogin';
import { PLATFORM_NAME } from '../constants/platform';

const Profile = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { db, updateRecord } = useDatabase();
    const userEmail = localStorage.getItem('userEmail');
    const userRole = localStorage.getItem('userRole');
    const currentAgentId = localStorage.getItem('agentId');
    const sessionUserId = getStoredSessionUserId();

    const [isEditing, setIsEditing] = useState(false);

    const sessionScope = useMemo(
        () => ({
            userRole,
            userEmail,
            sessionAgentId: currentAgentId,
            sessionUserId,
        }),
        [userRole, userEmail, currentAgentId, sessionUserId]
    );

    const sessionUser = useMemo(
        () => findSessionUser(db, sessionScope),
        [db, sessionScope]
    );
    const currentUserData = sessionUser?.record;
    const displayName = useMemo(
        () => resolveSessionDisplayName(db, sessionScope),
        [db, sessionScope]
    );

    const [profile, setProfile] = useState({
        name: '',
        role: '',
        email: '',
        phone: '',
        location: '',
        avatar: '',
        businessName: ''
    });

    const [editForm, setEditForm] = useState(profile);

    useEffect(() => {
        if (currentUserData || userRole === 'admin') {
            const isSubAgent = sessionUser?.type === 'subAgent';
            const isStaffMember = sessionUser?.type === 'staff';
            const resolvedName =
                userRole === 'admin'
                    ? currentUserData?.agencyName || PLATFORM_NAME
                    : String(currentUserData?.name || '').trim() || displayName;
            const data = {
                name: resolvedName,
                role: userRole === 'admin'
                    ? 'System Administrator'
                    : isSubAgent
                      ? 'Sub-Agent'
                      : (currentUserData?.role || (userRole === 'agent' ? 'Agency Owner' : 'Team Member')),
                email: userRole === 'admin'
                    ? (currentUserData?.email || 'admin@lordshiva.com')
                    : (currentUserData?.email || currentUserData?.employeeId || currentUserData?.staffLoginId || ''),
                phone: currentUserData?.phone || '',
                location: resolveProfileLocationFromRecord(
                    currentUserData,
                    sessionUser?.type,
                    db
                ),
                avatar: currentUserData?.avatar || '',
                businessName: isStaffMember
                    ? ''
                    : (currentUserData?.businessName || '')
            };
            setProfile(data);
            if (!isEditing) {
                setEditForm(data);
            }
        }
    }, [currentUserData, userRole, sessionUser?.type, displayName, db, isEditing]);

    const activityStats = useMemo(() => {
        const allQuotes = db.quotations?.data || [];
        const allBookings = db.bookings?.data || [];

        let scopedQuotes: any[] = [];
        let scopedBookings: any[] = [];

        const sessionScope = {
            userRole,
            userEmail,
            sessionAgentId: currentAgentId,
            sessionUserId,
        };

        if (userRole === 'admin') {
            scopedQuotes = allQuotes;
            scopedBookings = allBookings;
        } else {
            scopedQuotes = allQuotes.filter((q: any) =>
                recordVisibleToSession('quotations', q, db, sessionScope)
            );
            scopedBookings = allBookings.filter((b: any) =>
                recordVisibleToSession('bookings', b, db, sessionScope)
            );
        }

        const quotesGenerated = scopedQuotes.length;
        const confirmedBookings = scopedBookings.filter((b: any) =>
            isBookingFromConfirmedLead(b, db)
        ).length;
        const successRate =
            quotesGenerated > 0 ? Math.round((confirmedBookings / quotesGenerated) * 100) : 0;

        return { quotesGenerated, confirmedBookings, successRate };
    }, [db, userRole, userEmail, currentAgentId, sessionUserId, currentUserData?.id, sessionUser?.type]);

    const profileReady = Boolean(currentUserData) || userRole === 'admin';
    const showRoleSubtitle =
        userRole === 'admin' ||
        (sessionUser?.type !== 'staff' && sessionUser?.type !== 'subAgent');

    const handleSave = () => {
        if (!sessionUser?.record?.id) return;

        const savePlan = buildProfileSavePlan(db, sessionUser, userRole, editForm);
        if (!savePlan.length) return;

        savePlan.forEach(({ table, id, patch }) => {
            updateRecord(table, id, patch);
        });

        setProfile(editForm);
        setIsEditing(false);
    };

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !sessionUser?.record?.id) return;

        const reader = new FileReader();
        reader.onload = () => {
            const uploadedAvatar = typeof reader.result === 'string' ? reader.result : '';
            if (!uploadedAvatar) return;

            setEditForm((prev) => ({ ...prev, avatar: uploadedAvatar }));
            if (!isEditing) {
                const savePlan = buildProfileSavePlan(db, sessionUser, userRole, {
                    ...profile,
                    avatar: uploadedAvatar,
                });
                savePlan.forEach(({ table, id, patch }) => {
                    updateRecord(table, id, { avatar: patch.avatar });
                });
                setProfile((prev) => ({ ...prev, avatar: uploadedAvatar }));
            }
        };
        reader.readAsDataURL(file);
    };

    if (!profileReady) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <User size={64} className="mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-xs">Loading Profile...</p>
            </div>
        );
    }

    return (
        <div className="h-full min-h-0 w-full overflow-y-auto custom-scrollbar">
            <div className="w-full space-y-6 pb-6">
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Your Profile</h1>
                <p className="text-slate-500 font-medium">Manage your personal information and account settings.</p>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="h-32 bg-gradient-to-r from-crm-500 to-crm-600 relative"></div>
                <div className="px-10 pb-10 relative">
                    <div className="flex justify-between items-end -mt-16 mb-8">
                        <div className="w-32 h-32 rounded-[2rem] bg-white border-8 border-white shadow-xl relative overflow-hidden flex items-center justify-center group">
                            {(isEditing ? editForm.avatar : profile.avatar) ? (
                                <img
                                    src={isEditing ? editForm.avatar : profile.avatar}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-200">
                                    <User size={64} />
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                            >
                                <Camera size={24} />
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarUpload}
                                className="hidden"
                            />
                        </div>

                        {!isEditing ? (
                            <button onClick={() => setIsEditing(true)} className="btn-secondary shadow-lg">Edit Profile</button>
                        ) : (
                            <div className="flex gap-3">
                                <button onClick={() => { setIsEditing(false); setEditForm(profile); }} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all flex items-center gap-2">
                                    <X size={18} /> Cancel
                                </button>
                                <button onClick={handleSave} className="px-6 py-2.5 bg-crm-600 text-white rounded-xl font-bold text-sm hover:bg-crm-700 shadow-lg shadow-crm-500/30 transition-all flex items-center gap-2">
                                    <Save size={18} /> Save Changes
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="mb-10">
                        {!isEditing ? (
                            <div className="space-y-1">
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                    {profile.name}
                                    <Award className="text-amber-500 fill-current" size={24} />
                                </h2>
                                {showRoleSubtitle && (
                                <div className="flex items-center gap-2 text-crm-600 font-bold uppercase text-[10px] tracking-widest">
                                    <Briefcase size={12} />
                                    {profile.role}
                                    {profile.businessName && (
                                        <>
                                            <span className="text-slate-300">•</span>
                                            <Building size={12} />
                                            {profile.businessName}
                                        </>
                                    )}
                                </div>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                                    <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-crm-500 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Office Location / Address</label>
                                    <input type="text" value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-crm-500 transition-colors" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        <div className="space-y-6">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Contact Details</h3>

                            {!isEditing ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-slate-50 rounded-2xl text-slate-400"><Mail size={20} /></div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email</p>
                                            <p className="text-sm font-bold text-slate-700">{profile.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-slate-50 rounded-2xl text-slate-400"><Phone size={20} /></div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone</p>
                                            <p className="text-sm font-bold text-slate-700">{profile.phone || 'Not provided'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4 sm:col-span-2">
                                        <div className="p-3 bg-slate-50 rounded-2xl text-slate-400"><MapPin size={20} /></div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Office / Address</p>
                                            <p className="text-sm font-bold text-slate-700">{profile.location}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
                                        <input type="email" readOnly value={editForm.email} className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-bold text-slate-400 cursor-not-allowed" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Phone Number</label>
                                        <input type="text" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-crm-500 transition-colors" />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Activity Highlights</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 transition-all hover:bg-grey-50 hover:shadow-s hover:shadow-slate-50 group">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 group-hover:text-crm-500 transition-colors">Quotes Generated</p>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-3xl font-black text-slate-900">{activityStats.quotesGenerated}</p>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-2">
                                        {userRole === 'admin' ? 'All agency quotations' : 'Quotations in your portfolio'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 transition-all hover:bg-grey-50 hover:shadow-s hover:shadow-slate-50 group">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 group-hover:text-crm-500 transition-colors">Success Rate</p>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-3xl font-black text-slate-900">
                                            {activityStats.quotesGenerated > 0 ? `${activityStats.successRate}%` : '—'}
                                        </p>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-2">
                                        {activityStats.confirmedBookings} confirmed booking
                                        {activityStats.confirmedBookings === 1 ? '' : 's'}
                                        {activityStats.quotesGenerated > 0
                                            ? ` of ${activityStats.quotesGenerated} quote${activityStats.quotesGenerated === 1 ? '' : 's'}`
                                            : ''}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};

export default Profile;
