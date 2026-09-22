import React, { useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';

type CopyableTextProps = {
    value: string;
    label?: string;
    className?: string;
    title?: string;
    stopPropagation?: boolean;
};

const CopyableText = ({
    value,
    label,
    className = '',
    title,
    stopPropagation = true,
}: CopyableTextProps) => {
    const [copied, setCopied] = useState(false);
    const display = label ?? value;
    const canCopy = Boolean(String(value || '').trim()) && value !== '-';

    const handleCopy = useCallback(
        async (e: React.MouseEvent) => {
            if (stopPropagation) {
                e.stopPropagation();
                e.preventDefault();
            }
            if (!canCopy) return;

            try {
                await navigator.clipboard.writeText(value);
            } catch {
                const textarea = document.createElement('textarea');
                textarea.value = value;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }

            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        },
        [canCopy, stopPropagation, value]
    );

    if (!canCopy) {
        return <span className={className}>{display}</span>;
    }

    return (
        <button
            type="button"
            onClick={handleCopy}
            title={title || `Copy ${value}`}
            className={`inline-flex items-center gap-1 max-w-full cursor-pointer rounded-sm hover:text-crm-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crm-400 transition-colors group/copy ${className}`}
        >
            <span className="truncate">{display}</span>
            {copied ? (
                <span className="inline-flex items-center gap-0.5 text-emerald-600 shrink-0">
                    <Check size={10} />
                    <span className="text-[9px] font-bold uppercase tracking-wide">Copied</span>
                </span>
            ) : (
                <Copy
                    size={10}
                    className="shrink-0 opacity-0 group-hover/copy:opacity-70 group-focus-visible/copy:opacity-70"
                    aria-hidden
                />
            )}
        </button>
    );
};

export default CopyableText;
