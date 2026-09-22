/** Parse #rrggbb / #rgb / rgb()/rgba() into RGB components for jsPDF. */
function parseCssColorToRgb(color: string): { r: number; g: number; b: number } {
    const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
        let h = hex[1];
        if (h.length === 3) {
            h = h
                .split('')
                .map((c) => c + c)
                .join('');
        }
        return {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16),
        };
    }
    const rgb = color.trim().match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgb) {
        return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
    }
    return { r: 255, g: 255, b: 255 };
}

/** True visual bottom of all laid-out descendants relative to the root top. */
function measureFullContentHeight(root: HTMLElement): number {
    const rootRect = root.getBoundingClientRect();
    let maxBottom = root.scrollHeight;

    root.querySelectorAll('*').forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        const rect = node.getBoundingClientRect();
        if (rect.height <= 0 && rect.width <= 0) return;
        maxBottom = Math.max(maxBottom, rect.bottom - rootRect.top);
    });

    return Math.ceil(Math.max(maxBottom, root.offsetHeight, 1));
}

type AvoidZone = { top: number; bottom: number };

/** Collect DOM regions that should not be sliced mid-element in the PDF. */
function collectAvoidZones(root: HTMLElement, scale: number): AvoidZone[] {
    const rootRect = root.getBoundingClientRect();
    const zones: AvoidZone[] = [];
    const selector =
        '.print-break-avoid, .pdf-break-avoid, [data-pdf-break-avoid="true"]';

    root.querySelectorAll(selector).forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        const rect = node.getBoundingClientRect();
        if (rect.height < 8) return;
        const top = (rect.top - rootRect.top) * scale;
        const bottom = (rect.bottom - rootRect.top) * scale;
        if (bottom <= top) return;
        zones.push({ top, bottom });
    });

    zones.sort((a, b) => a.top - b.top || a.bottom - b.bottom);
    return zones;
}

/**
 * Pick a Y cut that fills the page as much as possible without slicing
 * through avoid zones (activity cards, hotel blocks, etc.).
 */
function resolveSliceEnd(
    srcY: number,
    idealEnd: number,
    canvasHeight: number,
    zones: AvoidZone[]
): number {
    const hardEnd = Math.min(idealEnd, canvasHeight);
    if (hardEnd <= srcY) return Math.min(srcY + 1, canvasHeight);

    let cut = hardEnd;
    const pageBudget = hardEnd - srcY;

    // Prefer ending just before a zone that would be cut mid-box
    const overlapping = zones.filter((z) => z.top < hardEnd - 1 && z.bottom > hardEnd + 1);
    if (overlapping.length > 0) {
        const earliestTop = Math.min(...overlapping.map((z) => z.top));
        const minUseful = srcY + Math.max(64, pageBudget * 0.15);
        if (earliestTop > minUseful) {
            cut = Math.floor(earliestTop) - 2;
        } else {
            // Zone starts too near page top — finish after the zone if it still fits
            const latestBottom = Math.max(...overlapping.map((z) => z.bottom));
            if (latestBottom > srcY && latestBottom - srcY <= pageBudget) {
                cut = Math.min(Math.ceil(latestBottom) + 2, canvasHeight);
            }
        }
    }

    // Final pass: never leave cut inside a zone when we can end before it
    for (const z of zones) {
        if (cut <= srcY) break;
        if (z.top < cut && z.bottom > cut && z.top > srcY + 64) {
            cut = Math.floor(z.top) - 2;
        }
    }

    if (cut <= srcY) {
        cut = Math.min(hardEnd, canvasHeight);
    }
    return Math.min(Math.max(cut, srcY + 1), canvasHeight);
}

/**
 * Capture a tall HTML element and save it as a multi-page A4 PDF.
 * Each page is filled with an opaque background before the content slice —
 * matching browser print behavior for continuous page background.
 */
export async function downloadElementAsMultiPagePdf(
    element: HTMLElement,
    filename: string,
    options: { backgroundColor?: string; marginMm?: number } = {}
): Promise<void> {
    const backgroundColor = options.backgroundColor ?? '#ffffff';
    const marginMm = options.marginMm ?? 8;
    const pageRgb = parseCssColorToRgb(backgroundColor);

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
    ]);

    const sourceWidth = Math.ceil(element.scrollWidth || element.clientWidth || 794);

    const cloneHost = document.createElement('div');
    cloneHost.setAttribute('data-pdf-capture-host', 'true');
    cloneHost.style.cssText = [
        'position:fixed',
        'left:-100000px',
        'top:0',
        `width:${sourceWidth}px`,
        `background:${backgroundColor}`,
        'padding:0',
        'margin:0',
        'z-index:-1',
        'overflow:visible',
        'pointer-events:none',
    ].join(';');

    const clone = element.cloneNode(true) as HTMLElement;

    // Drop print-only running chrome — fixed headers confuse height measurement
    clone
        .querySelectorAll('.quote-print-running-header, .quote-print-running-footer')
        .forEach((node) => node.remove());

    // Force a growing block so background spans the full document (not one A4 card)
    clone.style.cssText = [
        'display:block',
        `width:${sourceWidth}px`,
        'height:auto',
        'min-height:0',
        'max-height:none',
        'overflow:visible',
        `background:${backgroundColor}`,
        'box-shadow:none',
        'border-radius:0',
        'transform:none',
        'margin:0',
        'position:relative',
        // Keep readable PDF padding without the screen preview's huge card padding
        'padding:28px 32px',
        'box-sizing:border-box',
    ].join(';');

    cloneHost.appendChild(clone);
    document.body.appendChild(cloneHost);

    clone.querySelectorAll<HTMLElement>('*').forEach((node) => {
        const className = typeof node.className === 'string' ? node.className : '';
        node.style.maxHeight = 'none';
        // Prevent clipped text from overflow/truncate during rasterization
        if (className.includes('truncate') || className.includes('line-clamp')) {
            node.style.overflow = 'visible';
            node.style.textOverflow = 'clip';
            node.style.whiteSpace = 'normal';
            node.style.webkitLineClamp = 'unset';
            (node.style as any).WebkitBoxOrient = 'unset';
        }
        // Keep cards from clipping descenders / borders
        if (
            className.includes('pdf-break-avoid') ||
            className.includes('print-break-avoid') ||
            className.includes('rounded-xl') ||
            className.includes('rounded-2xl') ||
            className.includes('rounded-3xl')
        ) {
            node.style.overflow = 'visible';
        }
        if (
            className.includes('flex-1') ||
            className.includes('min-h-') ||
            className.includes('h-full') ||
            className.includes('quote-print-body')
        ) {
            node.style.flex = 'none';
            node.style.flexGrow = '0';
            node.style.height = 'auto';
            node.style.minHeight = '0';
        }
        if (window.getComputedStyle(node).position === 'fixed') {
            node.style.position = 'absolute';
        }
    });

    try {
        if (document.fonts?.ready) {
            await document.fonts.ready;
        }

        // Two-pass measure: expand → reflow → lock explicit height for html2canvas
        void clone.offsetHeight;
        let captureHeight = measureFullContentHeight(clone);
        clone.style.height = `${captureHeight}px`;
        void clone.offsetHeight;
        captureHeight = measureFullContentHeight(clone);
        clone.style.height = `${captureHeight}px`;

        // Measure avoid zones in CSS pixels before canvas scale
        const cssZones = collectAvoidZones(clone, 1);

        const canvas = await html2canvas(clone, {
            scale: 2,
            useCORS: true,
            backgroundColor,
            logging: false,
            width: sourceWidth,
            height: captureHeight,
            windowWidth: sourceWidth,
            windowHeight: captureHeight,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0,
            onclone: (_doc, clonedEl) => {
                clonedEl.querySelectorAll('.truncate, .line-clamp-1, .line-clamp-2').forEach((n) => {
                    if (!(n instanceof HTMLElement)) return;
                    n.style.overflow = 'visible';
                    n.style.whiteSpace = 'normal';
                    n.style.textOverflow = 'clip';
                });
            },
        });

        const scale = canvas.width / Math.max(sourceWidth, 1);
        const zones = cssZones.map((z) => ({
            top: z.top * scale,
            bottom: z.bottom * scale,
        }));

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const contentWidth = pageWidth - marginMm * 2;
        const contentHeight = pageHeight - marginMm * 2;
        const pageSlicePx = Math.max(1, Math.floor((contentHeight * canvas.width) / contentWidth));

        let srcY = 0;
        let pageIndex = 0;

        const paintPageBackground = () => {
            pdf.setFillColor(pageRgb.r, pageRgb.g, pageRgb.b);
            pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        };

        while (srcY < canvas.height) {
            const remaining = canvas.height - srcY;
            // Skip near-empty trailing slices (avoids blank last page)
            if (remaining < 2) break;

            if (pageIndex > 0) {
                pdf.addPage();
            }
            paintPageBackground();

            const idealEnd = srcY + pageSlicePx;
            const sliceEnd = resolveSliceEnd(srcY, idealEnd, canvas.height, zones);
            const sliceHeight = Math.max(1, sliceEnd - srcY);
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sliceHeight;
            const ctx = sliceCanvas.getContext('2d');
            if (!ctx) break;

            ctx.fillStyle = `rgb(${pageRgb.r}, ${pageRgb.g}, ${pageRgb.b})`;
            ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            ctx.drawImage(
                canvas,
                0,
                srcY,
                canvas.width,
                sliceHeight,
                0,
                0,
                canvas.width,
                sliceHeight
            );

            const sliceMm = (sliceHeight * contentWidth) / canvas.width;
            pdf.addImage(
                sliceCanvas.toDataURL('image/png'),
                'PNG',
                marginMm,
                marginMm,
                contentWidth,
                sliceMm,
                undefined,
                'FAST'
            );

            srcY = sliceEnd;
            pageIndex += 1;
        }

        pdf.save(filename);
    } finally {
        if (cloneHost.parentNode) {
            cloneHost.parentNode.removeChild(cloneHost);
        }
    }
}
