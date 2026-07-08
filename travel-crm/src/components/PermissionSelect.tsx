import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import DropdownChevron from './DropdownChevron';
import {
    ALL_PERMISSIONS,
    PERMISSION_LABELS,
    type PermissionKey,
    formatPermissionSummary,
} from '../utils/permissions';

interface PermissionSelectProps {
    value: PermissionKey[];
    onChange: (permissions: PermissionKey[]) => void;
    label?: string;
    hint?: string;
}

const PermissionSelect: React.FC<PermissionSelectProps> = ({
    value,
    onChange,
    label = 'Module Access',
    hint = 'Select which sections this account can view after login.',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const togglePermission = (key: PermissionKey) => {
        if (value.includes(key)) {
            onChange(value.filter((item) => item !== key));
            return;
        }
        onChange([...value, key]);
    };

    const selectAll = () => onChange([...ALL_PERMISSIONS]);
    const clearAll = () => onChange([]);

    return (
        <div ref={containerRef} className="relative">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                {label}
            </label>
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none font-bold text-left hover:border-crm-300 transition-colors"
            >
                <span className="flex items-center gap-3 min-w-0">
                    <ShieldCheck className="text-slate-400 shrink-0" size={18} />
                    <span className="truncate text-slate-700">{formatPermissionSummary(value)}</span>
                </span>
                <DropdownChevron open={isOpen} size={18} className="text-slate-400" />
            </button>
            {hint && (
                <p className="text-[9px] text-slate-400 mt-1.5 font-medium">{hint}</p>
            )}

            {isOpen && (
                <div className="crm-dropdown-menu absolute left-0 right-0 top-full mt-2 z-[100] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Grant Access
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={selectAll}
                                className="text-[10px] font-black uppercase tracking-wider text-crm-600 hover:text-crm-700"
                            >
                                All
                            </button>
                            <span className="text-slate-200">|</span>
                            <button
                                type="button"
                                onClick={clearAll}
                                className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600"
                            >
                                None
                            </button>
                        </div>
                    </div>
                    <div className="p-2 max-h-56 overflow-y-auto">
                        {ALL_PERMISSIONS.map((key) => {
                            const checked = value.includes(key);
                            return (
                                <label
                                    key={key}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                                        checked ? 'bg-crm-50' : 'hover:bg-slate-50'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => togglePermission(key)}
                                        className="w-4 h-4 rounded border-slate-300 text-crm-600 focus:ring-crm-500"
                                    />
                                    <span className="text-sm font-bold text-slate-700">
                                        {PERMISSION_LABELS[key]}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PermissionSelect;
