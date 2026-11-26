import React, { useEffect, useState } from 'react';

type Notice = {
    message: string;
    onClose?: () => void;
};

let publish: ((notice: Notice) => void) | null = null;

/** Show a centered message instead of a browser alert or corner toast. */
export const showNotice = (message: string, onClose?: () => void) => {
    const text = String(message || '').trim();
    if (!text) return;
    publish?.({ message: text, onClose });
};

const AppNotice = () => {
    const [notice, setNotice] = useState<Notice | null>(null);

    useEffect(() => {
        publish = setNotice;
        return () => {
            publish = null;
        };
    }, []);

    if (!notice) return null;

    const close = () => {
        const done = notice.onClose;
        setNotice(null);
        done?.();
    };

    return (
        <div
            className="fixed inset-0 z-[4000] flex items-center justify-center bg-slate-900/50 p-4"
            onClick={close}
        >
            <div
                role="dialog"
                aria-modal="true"
                className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8"
                onClick={(event) => event.stopPropagation()}
            >
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{notice.message}</p>
                <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        onClick={close}
                        className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
                    >
                        Ok
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AppNotice;
