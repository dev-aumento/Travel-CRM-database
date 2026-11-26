import React, { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import {
    TRANSFER_KINDS,
    exportTransferCsv,
    importTransferCsv,
    type TransferKind,
    type TransferResult,
} from '../utils/dataTransfer';

type DataTransferPanelProps = {
    db: any;
    agentId: string;
    userEmail: string;
    userRole: string;
    isAdmin: boolean;
    addRecord: (table: string, record: any) => void;
    updateRecord: (table: string, id: string, updates: any) => void;
};

const DataTransferPanel = ({ db, agentId, userEmail, userRole, isAdmin, addRecord, updateRecord }: DataTransferPanelProps) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const pendingKind = useRef<TransferKind | null>(null);
    const [notice, setNotice] = useState('');

    const describe = (kind: TransferKind, result: TransferResult) => {
        const label = TRANSFER_KINDS.find((item) => item.id === kind)?.label || kind;
        setNotice(
            `${label}: ${result.added} added, ${result.updated} updated${result.skipped ? `, ${result.skipped} skipped` : ''}.`
        );
    };

    const scope = { agentId, userEmail, userRole, isAdmin };

    const chooseFile = (kind: TransferKind) => {
        pendingKind.current = kind;
        if (fileRef.current) {
            fileRef.current.value = '';
            fileRef.current.click();
        }
    };

    const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        const kind = pendingKind.current;
        if (!file || !kind) return;
        try {
            const text = await file.text();
            const result = importTransferCsv(kind, text, db, scope, addRecord, updateRecord);
            describe(kind, result);
        } catch (error) {
            console.error('Import failed:', error);
            setNotice('That file could not be imported. Use a CSV exported from this page.');
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold text-slate-800">Import & Export</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                    Download a CSV of your records, edit it, and import it back. Rows with an existing ID are updated. New rows are added to your agency.
                </p>
            </div>
            {notice && (
                <p className="text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    {notice}
                </p>
            )}
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TRANSFER_KINDS.map((item) => (
                    <div key={item.id} className="border border-slate-200 rounded-2xl p-5 bg-white">
                        <h4 className="font-bold text-slate-900">{item.label}</h4>
                        <p className="text-xs text-slate-500 mt-1 mb-4">{item.hint}</p>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => chooseFile(item.id)}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:border-crm-300">
                                <Download size={14} /> Import
                            </button>
                            <button type="button" onClick={() => exportTransferCsv(item.id, db, scope)}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">
                                <Upload size={14} /> Export
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DataTransferPanel;
