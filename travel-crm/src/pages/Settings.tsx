import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Globe, Building2, Landmark } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import {
    canManageAgencyProfile,
    findAgencySettingsRecord,
    resolveMainAgencyAgent,
} from '../utils/databaseSync';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../utils/currency';
import DropdownChevron from '../components/DropdownChevron';
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from '../utils/timezoneData';

const TABS = [
    { id: 'general', label: 'General' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'security', label: 'Security' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'banking', label: 'Banking' },
    { id: 'system', label: 'System Management' },
] as const;

type TabId = typeof TABS[number]['id'];

const Settings = () => {
    const { db, addRecord, updateRecord } = useDatabase();
    const userEmail = localStorage.getItem('userEmail') || '';
    const userRole = localStorage.getItem('userRole') || '';
    const sessionAgentId = localStorage.getItem('agentId') || '';

    const currentAgent = useMemo(() => {
        return (db?.travelAgents?.data || []).find(
            (a: any) =>
                a.id === sessionAgentId ||
                String(a.email || '').toLowerCase() === userEmail.toLowerCase()
        );
    }, [db?.travelAgents?.data, userEmail, sessionAgentId]);

    const mainAgencyAgent = useMemo(
        () =>
            resolveMainAgencyAgent(db, {
                sessionAgentId,
                userEmail,
            }),
        [db, sessionAgentId, userEmail]
    );

    const settingsOwnerEmail =
        mainAgencyAgent?.staffLoginId || mainAgencyAgent?.email || userEmail;

    // Agency settings always belong to the main agency owner (not sub-agent email)
    const settingsRecord = useMemo(() => {
        return (
            findAgencySettingsRecord(db, settingsOwnerEmail) ||
            db?.settings?.data?.[0] ||
            null
        );
    }, [db?.settings?.data, settingsOwnerEmail]);

    const [activeTab, setActiveTab] = useState<TabId>('general');

    const persistedSettings = useMemo(
        () => ({
            agencyName: settingsRecord?.agencyName || 'Travel Agency CRM',
            logoUrl: settingsRecord?.logoUrl || '',
            supportEmail:
                settingsRecord?.supportEmail || userEmail || 'hello@travelcrm.example.com',
            agencyAddress:
                settingsRecord?.agencyAddress ||
                'A-502, Crystal Plaza, New Link Road, Andheri West, Mumbai, Maharashtra 400053',
            currency: settingsRecord?.currency || DEFAULT_CURRENCY,
            timezone: settingsRecord?.timezone || DEFAULT_TIMEZONE,
            emailJsServiceId:
                currentAgent?.emailJsServiceId || settingsRecord?.emailJsServiceId || '',
            emailJsTemplateId:
                currentAgent?.emailJsTemplateId || settingsRecord?.emailJsTemplateId || '',
            emailJsPublicKey:
                currentAgent?.emailJsPublicKey || settingsRecord?.emailJsPublicKey || '',
            accountNumber: settingsRecord?.accountNumber || '',
            bankName: settingsRecord?.bankName || '',
            branchName: settingsRecord?.branchName || '',
            ifscCode: settingsRecord?.ifscCode || '',
            gstDetails: settingsRecord?.gstDetails || '',
        }),
        [
            settingsRecord?.id,
            settingsRecord?.agencyName,
            settingsRecord?.logoUrl,
            settingsRecord?.supportEmail,
            settingsRecord?.agencyAddress,
            settingsRecord?.currency,
            settingsRecord?.timezone,
            settingsRecord?.emailJsServiceId,
            settingsRecord?.emailJsTemplateId,
            settingsRecord?.emailJsPublicKey,
            settingsRecord?.accountNumber,
            settingsRecord?.bankName,
            settingsRecord?.branchName,
            settingsRecord?.ifscCode,
            settingsRecord?.gstDetails,
            currentAgent?.emailJsServiceId,
            currentAgent?.emailJsTemplateId,
            currentAgent?.emailJsPublicKey,
            userEmail,
        ]
    );

    const persistedSnapshot = useMemo(
        () => JSON.stringify(persistedSettings),
        [persistedSettings]
    );

    const [formState, setFormState] = useState(persistedSettings);

    // Only rehydrate from saved settings when the saved values actually change —
    // not when object identity churns on unrelated DB re-renders (which was clearing inputs on blur).
    useEffect(() => {
        setFormState(JSON.parse(persistedSnapshot));
    }, [persistedSnapshot]);

    const hasChanges = JSON.stringify(formState) !== persistedSnapshot;

    const handleFieldChange = (field: keyof typeof formState, value: string) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    };

    const handleCancel = () => {
        setFormState(persistedSettings);
    };

    const handleSave = () => {
        if (!hasChanges) return;

        const emailJsFields = {
            emailJsServiceId: formState.emailJsServiceId,
            emailJsTemplateId: formState.emailJsTemplateId,
            emailJsPublicKey: formState.emailJsPublicKey,
        };

        if (userRole === 'agent' && currentAgent?.id) {
            updateRecord('travelAgents', currentAgent.id, {
                ...currentAgent,
                ...emailJsFields,
            });
        }

        if (settingsRecord?.id) {
            updateRecord('settings', settingsRecord.id, {
                ...formState,
                email: settingsOwnerEmail,
            });
            alert('Settings updated successfully!');
            return;
        }

        addRecord('settings', {
            id: `SET-${Date.now()}`,
            email: settingsOwnerEmail,
            ...formState,
        });
        alert('Settings created successfully!');
    };

    const resetDatabase = () => {
        if (window.confirm('Are you sure you want to reset the database? All your changes will be lost and the system will be re-populated with enterprise-level mock data.')) {
            localStorage.removeItem('crm_database');
            window.location.reload();
        }
    };

    if (!canManageAgencyProfile(userRole, sessionAgentId, db)) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="w-full h-full flex flex-col space-y-6 min-h-0">
            <div className="shrink-0">
                <h1 className="text-2xl font-bold text-slate-900">Platform Settings</h1>
                <p className="text-slate-500 mt-1">Manage your agency preferences and system configurations for <b>{userEmail}</b></p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="flex border-b border-slate-200 overflow-x-auto shrink-0">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-4 font-medium whitespace-nowrap border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? 'text-crm-600 border-crm-600'
                                    : 'text-slate-500 hover:text-slate-700 border-transparent'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar focus:outline-none" tabIndex={0}>
                    {activeTab === 'general' ? (
                        <>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <Building2 size={20} className="text-crm-500" />
                                    Branding & Identity
                                </h3>
                                
                                {/* Compact Branding Identity Hub */}
                                <div className="flex flex-col md:flex-row gap-10 mb-10 p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 items-start">
                                    <div className="flex flex-col items-center gap-4 shrink-0">
                                        <div className="w-28 h-28 bg-slate-900 text-white rounded-[2.5rem] flex items-center justify-center text-5xl font-black shadow-2xl shadow-slate-200 overflow-hidden relative group">
                                            {formState.logoUrl ? (
                                                <img src={formState.logoUrl} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                formState.agencyName.charAt(0)
                                            )}
                                        </div>
                                        
                                        <div className="flex flex-col gap-2 w-full">
                                            <button 
                                                type="button"
                                                onClick={() => document.getElementById('logo-upload')?.click()}
                                                className="w-full py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-crm-500 hover:text-crm-600 transition-all shadow-sm"
                                            >
                                                {formState.logoUrl ? 'Change Logo' : 'Upload Logo'}
                                            </button>
                                            {formState.logoUrl && (
                                                <button 
                                                    type="button"
                                                    onClick={() => handleFieldChange('logoUrl', '')}
                                                    className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                            <input 
                                                id="logo-upload"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (event) => {
                                                            const img = new Image();
                                                            img.onload = () => {
                                                                const canvas = document.createElement('canvas');
                                                                const MAX_WIDTH = 400;
                                                                const scaleSize = MAX_WIDTH / img.width;
                                                                canvas.width = MAX_WIDTH;
                                                                canvas.height = img.height * scaleSize;
                                                                const ctx = canvas.getContext('2d');
                                                                ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                                                                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                                                                handleFieldChange('logoUrl', dataUrl);
                                                            };
                                                            img.src = event.target?.result as string;
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 w-full space-y-8 pt-2">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Agency Display Name</label>
                                            <input
                                                type="text"
                                                value={formState.agencyName}
                                                onChange={(e) => handleFieldChange('agencyName', e.target.value)}
                                                className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-lg font-black text-slate-900 focus:ring-4 focus:ring-crm-500/5 focus:border-crm-500 outline-none transition-all shadow-sm"
                                                placeholder="Enter Agency Name"
                                            />
                                            <p className="text-[10px] text-slate-400 mt-3 font-medium uppercase tracking-wider">This name will appear on all your invoices and itineraries.</p>
                                        </div>
                                        
                                        <div className="p-5 bg-crm-50/50 border border-crm-100 rounded-2xl">
                                            <p className="text-[10px] text-crm-700 font-bold leading-relaxed">
                                                Tip: Use a high-quality square PNG with a transparent background for the best results on printed documents.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Support & Billing Email</label>
                                        <input
                                            type="email"
                                            value={formState.supportEmail}
                                            readOnly
                                            className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-sm text-slate-500 cursor-not-allowed font-medium"
                                        />
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Physical Agency Headquarters</label>
                                        <input
                                            type="text"
                                            value={formState.agencyAddress}
                                            onChange={(e) => handleFieldChange('agencyAddress', e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-crm-500/5 focus:border-crm-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            <div>
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <Globe size={20} className="text-crm-500" />
                                    Localization
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                                        <div className="relative crm-select-wrap">
                                        <select
                                            value={formState.currency}
                                            onChange={(e) => handleFieldChange('currency', e.target.value)}
                                            className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg text-sm appearance-none cursor-pointer"
                                        >
                                            {CURRENCY_OPTIONS.map((option) => (
                                                <option key={option.code} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        <DropdownChevron size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
                                        <div className="relative crm-select-wrap">
                                        <select
                                            value={formState.timezone}
                                            onChange={(e) => handleFieldChange('timezone', e.target.value)}
                                            className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg text-sm appearance-none cursor-pointer"
                                        >
                                            {TIMEZONE_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        <DropdownChevron size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : activeTab === 'integrations' ? (
                        <div className="space-y-6 max-w-xl">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 mb-2">Send from your agent email</h3>
                                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                                    Configure{' '}
                                    <a
                                        href="https://www.emailjs.com/"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-crm-600 font-semibold hover:underline"
                                    >
                                        EmailJS
                                    </a>{' '}
                                    so quotations go straight to the customer from{' '}
                                    <strong>{currentAgent?.email || userEmail || 'your agent profile email'}</strong>.
                                    In EmailJS, connect the <strong>same Gmail or Outlook</strong> as that address,
                                    then create a template with:
                                </p>
                                <ul className="text-xs text-slate-600 list-disc pl-5 mb-4 space-y-1">
                                    <li>
                                        <strong>To email:</strong>{' '}
                                        <code className="bg-slate-100 px-1 rounded">{'{{to_email}}'}</code>
                                    </li>
                                    <li>
                                        <strong>Subject:</strong>{' '}
                                        <code className="bg-slate-100 px-1 rounded">{'{{subject}}'}</code>
                                    </li>
                                    <li>
                                        <strong>Content (HTML):</strong>{' '}
                                        <code className="bg-slate-100 px-1 rounded">{'{{{html_message}}}'}</code>{' '}
                                        (triple braces)
                                    </li>
                                    <li>
                                        <strong>From name:</strong>{' '}
                                        <code className="bg-slate-100 px-1 rounded">{'{{from_name}}'}</code>
                                    </li>
                                    <li>
                                        <strong>Reply / From email:</strong>{' '}
                                        <code className="bg-slate-100 px-1 rounded">{'{{from_email}}'}</code>
                                    </li>
                                </ul>
                                <p className="text-xs text-slate-500 mb-4">
                                    Paste the three IDs below and save. Each agent can use their own EmailJS account
                                    tied to their profile email.
                                </p>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Service ID</label>
                                    <input
                                        type="text"
                                        value={formState.emailJsServiceId}
                                        onChange={(e) => handleFieldChange('emailJsServiceId', e.target.value)}
                                        placeholder="service_xxxxxxx"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Template ID</label>
                                    <input
                                        type="text"
                                        value={formState.emailJsTemplateId}
                                        onChange={(e) => handleFieldChange('emailJsTemplateId', e.target.value)}
                                        placeholder="template_xxxxxxx"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Public key</label>
                                    <input
                                        type="text"
                                        value={formState.emailJsPublicKey}
                                        onChange={(e) => handleFieldChange('emailJsPublicKey', e.target.value)}
                                        placeholder="Your EmailJS public key"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'banking' ? (
                        <div className="space-y-6 max-w-xl">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                                    <Landmark size={20} className="text-crm-500" />
                                    Banking Details
                                </h3>
                                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                                    Store your agency bank account and GST details for invoices and settlements.
                                </p>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                                        Account Number
                                    </label>
                                    <input
                                        type="text"
                                        value={formState.accountNumber}
                                        onChange={(e) =>
                                            handleFieldChange('accountNumber', e.target.value)
                                        }
                                        placeholder="e.g. 123456789012"
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-crm-500/5 focus:border-crm-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                                        Bank Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formState.bankName}
                                        onChange={(e) =>
                                            handleFieldChange('bankName', e.target.value)
                                        }
                                        placeholder="e.g. HDFC Bank"
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-crm-500/5 focus:border-crm-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                                        Branch Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formState.branchName}
                                        onChange={(e) =>
                                            handleFieldChange('branchName', e.target.value)
                                        }
                                        placeholder="e.g. Andheri West"
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-crm-500/5 focus:border-crm-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                                        IFSC Code
                                    </label>
                                    <input
                                        type="text"
                                        value={formState.ifscCode}
                                        onChange={(e) =>
                                            handleFieldChange(
                                                'ifscCode',
                                                e.target.value.toUpperCase()
                                            )
                                        }
                                        placeholder="e.g. HDFC0001234"
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-mono font-medium tracking-wider focus:ring-4 focus:ring-crm-500/5 focus:border-crm-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                                        GST Number
                                    </label>
                                    <input
                                        type="text"
                                        value={formState.gstDetails}
                                        onChange={(e) =>
                                            handleFieldChange(
                                                'gstDetails',
                                                e.target.value.toUpperCase()
                                            )
                                        }
                                        placeholder="e.g. 27AAAAA0000A1Z5"
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-mono font-medium tracking-wider focus:ring-4 focus:ring-crm-500/5 focus:border-crm-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'system' ? (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 mb-2">Enterprise Mock Data</h3>
                                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                                    Use this option to populate the CRM with a large volume of enterprise-level data. This is useful for demonstrations and visualizing how the platform handles high-scale activity (hundreds of leads, millions in revenue, and large teams).
                                </p>
                                <div className="p-6 bg-amber-50 border border-amber-100 rounded-[24px]">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-white rounded-2xl shadow-sm text-amber-600 shrink-0">
                                            <Building2 size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-1">Reset to Enterprise Scale</h4>
                                            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                                                Warning: This will clear your current local database and reload the system with 50+ pre-configured records including multiple agencies, high-value bookings, and expanded staff lists.
                                            </p>
                                            <button 
                                                onClick={resetDatabase}
                                                className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                                            >
                                                Reload Enterprise Data
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-16 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                            <p className="text-slate-500 font-medium">Nothing to show</p>
                            <p className="text-slate-400 text-sm mt-1">No fields are configured for this tab yet.</p>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                    <button
                        onClick={handleCancel}
                        disabled={!hasChanges}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges}
                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Settings;
