import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Mail, Send, Loader2, CheckCircle2, AlertCircle, Download, Copy, ExternalLink } from 'lucide-react';
import {
    sendQuoteEmail,
    downloadQuoteEml,
    copyQuoteEmailHtml,
    openMailAppDraft,
    type QuoteEmailDraft,
    type QuoteEmailSender,
} from '../utils/quoteShareEmail';
import { useDatabase } from '../context/DatabaseContext';
import { canManageAgencyProfile } from '../utils/databaseSync';

type Props = {
    draft: QuoteEmailDraft;
    sender: QuoteEmailSender;
    onClose: () => void;
    onSent?: () => void;
};

const QuoteEmailSendModal: React.FC<Props> = ({ draft, sender, onClose, onSent }) => {
    const { db } = useDatabase();
    const [subject, setSubject] = useState(draft.subject);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [sent, setSent] = useState(false);
    const previewFrameRef = useRef<HTMLIFrameElement>(null);

    const resizePreviewFrame = useCallback(() => {
        const iframe = previewFrameRef.current;
        const doc = iframe?.contentDocument;
        if (!iframe || !doc) return;
        const height = Math.max(
            doc.documentElement?.scrollHeight || 0,
            doc.body?.scrollHeight || 0,
            320
        );
        iframe.style.height = `${height + 32}px`;
    }, []);

    useEffect(() => {
        resizePreviewFrame();
    }, [draft.htmlBody, resizePreviewFrame]);

    const canSendViaApi = Boolean(sender.emailJsConfig);
    const canOpenAgencyProfile = canManageAgencyProfile(
        localStorage.getItem('userRole'),
        localStorage.getItem('agentId'),
        db
    );

    const currentDraft = useMemo(
        () => ({ ...draft, subject, fromEmail: sender.fromEmail }),
        [draft, subject, sender.fromEmail]
    );

    const handleSend = async () => {
        setError('');
        setInfo('');
        setSending(true);
        try {
            const result = await sendQuoteEmail(
                currentDraft,
                { fromName: sender.fromName, fromEmail: sender.fromEmail },
                sender.emailJsConfig
            );
            if (!result.ok) {
                setError(result.error || 'Could not send email. Please try again.');
                return;
            }
            setSent(true);
            onSent?.();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unexpected error while sending.');
        } finally {
            setSending(false);
        }
    };

    const handleDownloadEml = () => {
        setError('');
        setInfo('');
        downloadQuoteEml(currentDraft);
        setInfo(
            'Draft downloaded. Open the .eml file in your mail app (from your agent email), review, then click Send.'
        );
    };

    const handleCopy = async () => {
        setError('');
        setInfo('');
        const ok = await copyQuoteEmailHtml(currentDraft);
        if (ok) {
            setInfo('Copied to clipboard. Paste into a new email from your agent address.');
        } else {
            setError('Could not copy to clipboard. Try Download draft (.eml) instead.');
        }
    };

    const handleOpenMailApp = () => {
        setError('');
        setInfo('');
        const result = openMailAppDraft(currentDraft);
        if (!result.ok) {
            setError(result.error || 'Could not open mail app.');
            return;
        }
        setInfo(
            result.hint ||
                'Check your mail app and the .eml file, then send from your agent email address.'
        );
    };

    return (
        <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={sending || sent ? undefined : onClose}
                aria-hidden
            />
            <div
                role="dialog"
                aria-labelledby="quote-email-modal-title"
                className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            >
                <div className="shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                            <Mail size={20} />
                        </div>
                        <div>
                            <h2 id="quote-email-modal-title" className="text-lg font-bold text-slate-900">
                                Send itinerary email
                            </h2>
                            <p className="text-xs text-slate-500">
                                Delivered from your agent email to the customer
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={sending}
                        className="p-2 rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-40"
                    >
                        <X size={22} />
                    </button>
                </div>

                <div className="shrink-0 px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-slate-100 bg-white">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To</label>
                        <p className="text-sm font-semibold text-slate-800 mt-0.5">{draft.to}</p>
                        {draft.customerName && (
                            <p className="text-xs text-slate-500">{draft.customerName}</p>
                        )}
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From</label>
                        <p className="text-sm font-semibold text-slate-800 mt-0.5">
                            {sender.fromName}
                            {sender.fromEmail ? (
                                <span className="text-slate-500 font-normal"> &lt;{sender.fromEmail}&gt;</span>
                            ) : null}
                        </p>
                    </div>
                    <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subject</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            disabled={sent || sending}
                            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none disabled:bg-slate-50"
                        />
                    </div>
                </div>

                {!canSendViaApi && !sent && (
                    <div className="shrink-0 mx-6 mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-950">
                        <p className="font-bold mb-1">Connect your agent email to send in one click</p>
                        <p className="text-xs leading-relaxed text-amber-900/90">
                            {canOpenAgencyProfile ? (
                                <>
                                    In{' '}
                                    <Link to="/settings" className="text-crm-700 font-bold underline" onClick={onClose}>
                                        Agency Profile → Integrations
                                    </Link>
                                    , add EmailJS keys linked to the same inbox as{' '}
                                </>
                            ) : (
                                <>
                                    Ask your main agency agent to configure EmailJS under Agency Profile →
                                    Integrations for{' '}
                                </>
                            )}
                            <strong>{sender.fromEmail || 'your profile email'}</strong>. Template fields:{' '}
                            <code className="bg-white/80 px-1 rounded">{'{{to_email}}'}</code>,{' '}
                            <code className="bg-white/80 px-1 rounded">{'{{subject}}'}</code>,{' '}
                            <code className="bg-white/80 px-1 rounded">{'{{{html_message}}}'}</code>,{' '}
                            <code className="bg-white/80 px-1 rounded">{'{{from_email}}'}</code>.
                        </p>
                        <p className="text-xs mt-2 text-amber-800">
                            Or use <strong>Download draft (.eml)</strong> / <strong>Open in mail app</strong> below.
                        </p>
                    </div>
                )}

                {error && (
                    <div className="shrink-0 mx-6 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700 flex items-start gap-2">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {info && !sent && (
                    <div className="shrink-0 mx-6 mt-3 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-900 flex items-start gap-2">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <span>{info}</span>
                    </div>
                )}

                {sent && (
                    <div className="shrink-0 mx-6 mt-3 px-3 py-3 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 size={18} className="shrink-0" />
                        <span>
                            Email sent from <strong>{sender.fromEmail}</strong> to <strong>{draft.to}</strong>.
                        </span>
                    </div>
                )}

                <div className="flex-1 min-h-0 flex flex-col px-6 py-4 overflow-hidden">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 shrink-0">Preview</p>
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar border border-slate-200 rounded-xl bg-slate-50">
                        <iframe
                            ref={previewFrameRef}
                            title="Email preview"
                            srcDoc={draft.htmlBody}
                            onLoad={resizePreviewFrame}
                            className="w-full border-0 bg-white block"
                            style={{ minHeight: '320px' }}
                            sandbox="allow-same-origin"
                        />
                    </div>
                </div>

                <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50 space-y-3">
                    {!sent && (
                        <div className="flex flex-wrap gap-2">
                            {!canSendViaApi && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleDownloadEml}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-white"
                                    >
                                        <Download size={14} />
                                        Download draft (.eml)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-white"
                                    >
                                        <Copy size={14} />
                                        Copy email
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleOpenMailApp}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-white"
                                    >
                                        <ExternalLink size={14} />
                                        Open in mail app
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={sending}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                        >
                            {sent ? 'Close' : 'Cancel'}
                        </button>
                        {!sent && (
                            <button
                                type="button"
                                onClick={handleSend}
                                disabled={sending || !subject.trim() || !canSendViaApi}
                                title={
                                    canSendViaApi
                                        ? undefined
                                        : 'Configure EmailJS under Agency Profile → Integrations'
                                }
                                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {sending ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Sending…
                                    </>
                                ) : (
                                    <>
                                        <Send size={18} />
                                        Send to customer
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuoteEmailSendModal;
