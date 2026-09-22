import React from 'react';
import {
    parseTermsLines,
    type QuoteTermsRecord,
} from '../utils/quoteTerms';
import {
    isTermsHtml,
    sanitizeTermsHtml,
    termsContentIsEmpty,
} from '../utils/termsRichText';

type Props = {
    terms: QuoteTermsRecord | null;
    variant?: 'print' | 'screen' | 'compact';
    className?: string;
};

const TermsTitle = ({
    terms,
    className,
}: {
    terms: QuoteTermsRecord | null;
    className: string;
}) => (
    <p className={className}>{terms?.title || 'Terms & Conditions'}</p>
);

const TermsPlainList = ({
    lines,
    itemClass,
    bulletClass,
}: {
    lines: string[];
    itemClass: string;
    bulletClass: string;
}) => (
    <ul className="space-y-1.5 list-none">
        {lines.map((line, idx) => (
            <li key={idx} className={`${itemClass} flex gap-2`}>
                <span className={`${bulletClass} shrink-0`}>•</span>
                <span>{line}</span>
            </li>
        ))}
    </ul>
);

const TermsHtmlBody = ({ html, className }: { html: string; className?: string }) => (
    <div
        className={`terms-rich-content ${className || ''}`}
        dangerouslySetInnerHTML={{ __html: sanitizeTermsHtml(html) }}
    />
);

const QuoteTermsSection: React.FC<Props> = ({ terms, variant = 'print', className = '' }) => {
    const content = terms?.content || '';
    if (termsContentIsEmpty(content)) return null;

    const useHtml = isTermsHtml(content);
    const lines = useHtml ? [] : parseTermsLines(content);

    if (variant === 'compact') {
        return (
            <div className={`rounded-xl border border-slate-200 bg-slate-50 p-4 ${className}`}>
                <TermsTitle
                    terms={terms}
                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2"
                />
                {useHtml ? (
                    <TermsHtmlBody html={content} className="text-xs text-slate-600" />
                ) : (
                    <TermsPlainList
                        lines={lines}
                        itemClass="text-xs text-slate-600 leading-relaxed"
                        bulletClass="text-crm-500"
                    />
                )}
            </div>
        );
    }

    if (variant === 'screen') {
        return (
            <div className={`mt-8 pt-6 border-t border-slate-200 ${className}`}>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-3">
                    {terms?.title || 'Terms & Conditions'}
                </h4>
                {useHtml ? (
                    <TermsHtmlBody html={content} className="text-sm text-slate-600" />
                ) : (
                    <TermsPlainList
                        lines={lines}
                        itemClass="text-sm text-slate-600 leading-relaxed"
                        bulletClass="text-crm-600 font-bold"
                    />
                )}
            </div>
        );
    }

    return (
        <div className={className}>
            <TermsTitle
                terms={terms}
                className="text-[9px] font-black text-slate-900 uppercase tracking-widest mb-3"
            />
            {useHtml ? (
                <TermsHtmlBody html={content} className="text-[8px] text-slate-500 font-medium" />
            ) : (
                <TermsPlainList
                    lines={lines}
                    itemClass="text-[8px] text-slate-500 font-medium leading-relaxed"
                    bulletClass="text-slate-400"
                />
            )}
        </div>
    );
};

export default QuoteTermsSection;
