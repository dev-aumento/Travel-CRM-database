import React, { useEffect, useRef, useCallback } from 'react';
import {
    Bold,
    Italic,
    Underline,
    List,
    ListOrdered,
    Heading2,
    Heading3,
    Pilcrow,
} from 'lucide-react';
import { plainTermsToHtml, sanitizeTermsHtml } from '../utils/termsRichText';

type Props = {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
};

const ToolbarButton = ({
    onClick,
    title,
    children,
    active,
}: {
    onClick: () => void;
    title: string;
    children: React.ReactNode;
    active?: boolean;
}) => (
    <button
        type="button"
        title={title}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={`p-2 rounded-lg border transition-colors ${
            active
                ? 'bg-crm-100 border-crm-300 text-crm-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
    >
        {children}
    </button>
);

const TermsRichTextEditor: React.FC<Props> = ({
    value,
    onChange,
    placeholder = 'Add headings, bullet points, and formatted terms…',
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const lastEmitted = useRef('');

    const emitChange = useCallback(() => {
        const html = sanitizeTermsHtml(editorRef.current?.innerHTML || '');
        lastEmitted.current = html;
        onChange(html);
    }, [onChange]);

    const exec = (command: string, valueArg?: string) => {
        editorRef.current?.focus();
        document.execCommand(command, false, valueArg);
        emitChange();
    };

    useEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        const next = plainTermsToHtml(value || '');
        if (next !== lastEmitted.current && el.innerHTML !== next) {
            el.innerHTML = next;
            lastEmitted.current = next;
        }
    }, [value]);

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-crm-400/30 focus-within:border-crm-400">
            <div className="flex flex-wrap items-center gap-1 px-2 py-2 border-b border-slate-100 bg-slate-50">
                <ToolbarButton onClick={() => exec('formatBlock', 'h2')} title="Heading 2">
                    <Heading2 size={16} />
                </ToolbarButton>
                <ToolbarButton onClick={() => exec('formatBlock', 'h3')} title="Heading 3">
                    <Heading3 size={16} />
                </ToolbarButton>
                <ToolbarButton onClick={() => exec('formatBlock', 'p')} title="Paragraph">
                    <Pilcrow size={16} />
                </ToolbarButton>
                <span className="w-px h-6 bg-slate-200 mx-0.5" aria-hidden />
                <ToolbarButton onClick={() => exec('bold')} title="Bold">
                    <Bold size={16} />
                </ToolbarButton>
                <ToolbarButton onClick={() => exec('italic')} title="Italic">
                    <Italic size={16} />
                </ToolbarButton>
                <ToolbarButton onClick={() => exec('underline')} title="Underline">
                    <Underline size={16} />
                </ToolbarButton>
                <span className="w-px h-6 bg-slate-200 mx-0.5" aria-hidden />
                <ToolbarButton onClick={() => exec('insertUnorderedList')} title="Bullet list">
                    <List size={16} />
                </ToolbarButton>
                <ToolbarButton onClick={() => exec('insertOrderedList')} title="Numbered list">
                    <ListOrdered size={16} />
                </ToolbarButton>
            </div>
            <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline
                data-placeholder={placeholder}
                onInput={emitChange}
                onBlur={emitChange}
                className="terms-rich-editor min-h-[220px] max-h-[360px] overflow-y-auto px-4 py-3 text-sm text-slate-800 outline-none custom-scrollbar"
            />
        </div>
    );
};

export default TermsRichTextEditor;
