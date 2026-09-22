/** Detect stored HTML vs legacy plain-text (one bullet per line). */
export const isTermsHtml = (content: string): boolean => /<[a-z][\s\S]*>/i.test(String(content || ''));

export const stripTermsHtmlToText = (content: string): string => {
    const raw = String(content || '');
    if (!raw.trim()) return '';
    if (!isTermsHtml(raw)) return raw.replace(/\r\n/g, '\n').trim();
    if (typeof document === 'undefined') {
        return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

export const termsContentIsEmpty = (content: string): boolean =>
    stripTermsHtmlToText(content).length === 0;

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

/** Convert legacy plain lines to HTML for the rich editor. */
export const plainTermsToHtml = (content: string): string => {
    const raw = String(content || '').trim();
    if (!raw) return '';
    if (isTermsHtml(raw)) return raw;
    return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<p>${escapeHtml(line.replace(/^[\s•\-*]+/, ''))}</p>`)
        .join('');
};

/** Remove unsafe markup while keeping headings, lists, and basic formatting. */
export const sanitizeTermsHtml = (html: string): string => {
    const raw = String(html || '').trim();
    if (!raw) return '';
    if (!isTermsHtml(raw)) return plainTermsToHtml(raw);

    if (typeof document === 'undefined') return raw;

    const doc = new DOMParser().parseFromString(raw, 'text/html');
    doc.querySelectorAll('script, style, iframe, object, link, meta').forEach((el) => el.remove());
    doc.body.querySelectorAll('*').forEach((el) => {
        [...el.attributes].forEach((attr) => {
            const name = attr.name.toLowerCase();
            if (name.startsWith('on') || name === 'style' || name === 'href' || name === 'src') {
                el.removeAttribute(attr.name);
            }
        });
    });
    return doc.body.innerHTML.trim();
};

/** Inner HTML for email table cells (already sanitized). */
export const termsHtmlToEmailInner = (content: string): string => {
    const html = sanitizeTermsHtml(content);
    if (!html) return '';
    return `<div class="terms-rich-content" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:#334155;">${html}</div>`;
};

/** Plain lines for WhatsApp / plain-text fallbacks. */
export const termsHtmlToPlainLines = (content: string): string[] => {
    const raw = String(content || '').trim();
    if (!raw) return [];
    if (!isTermsHtml(raw)) {
        return raw
            .split(/\r?\n/)
            .map((line) => line.replace(/^[\s•\-*]+/, '').trim())
            .filter(Boolean);
    }

    if (typeof document === 'undefined') {
        return [stripTermsHtmlToText(raw)];
    }

    const doc = new DOMParser().parseFromString(sanitizeTermsHtml(raw), 'text/html');
    const lines: string[] = [];

    const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const t = (node.textContent || '').trim();
            if (t) lines.push(t);
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        if (tag === 'h2' || tag === 'h3') {
            const t = (el.textContent || '').trim();
            if (t) lines.push(tag === 'h2' ? `**${t}**` : `*${t}*`);
            return;
        }
        if (tag === 'li') {
            const t = (el.textContent || '').trim();
            if (t) lines.push(t);
            return;
        }
        if (tag === 'br') {
            return;
        }
        el.childNodes.forEach(walk);
    };

    doc.body.childNodes.forEach(walk);
    return lines.filter(Boolean);
};
