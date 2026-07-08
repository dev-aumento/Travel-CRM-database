/** Capture a tall HTML element and save it as a multi-page A4 PDF. */
export async function downloadElementAsMultiPagePdf(
    element: HTMLElement,
    filename: string,
    options: { backgroundColor?: string; marginMm?: number } = {}
): Promise<void> {
    const { backgroundColor = '#ffffff', marginMm = 8 } = options;

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
    ]);

    const cloneHost = document.createElement('div');
    cloneHost.style.position = 'fixed';
    cloneHost.style.left = '-100000px';
    cloneHost.style.top = '0';
    cloneHost.style.width = `${element.scrollWidth || element.clientWidth}px`;
    cloneHost.style.background = backgroundColor;
    cloneHost.style.padding = '0';
    cloneHost.style.margin = '0';
    cloneHost.style.zIndex = '-1';

    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.overflow = 'visible';
    clone.style.maxHeight = 'none';
    clone.style.height = 'auto';
    clone.style.minHeight = 'auto';
    clone.style.width = `${element.scrollWidth || element.clientWidth}px`;
    clone.style.background = backgroundColor;
    clone.style.boxShadow = 'none';
    clone.style.borderRadius = '0';

    cloneHost.appendChild(clone);
    document.body.appendChild(cloneHost);

    const captureWidth = clone.scrollWidth || element.scrollWidth || element.clientWidth;
    const captureHeight = clone.scrollHeight || element.scrollHeight || element.clientHeight;

    try {
        const canvas = await html2canvas(clone, {
            scale: 2,
            useCORS: true,
            backgroundColor,
            logging: false,
            width: captureWidth,
            height: captureHeight,
            windowWidth: captureWidth,
            windowHeight: captureHeight,
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const contentWidth = pageWidth - marginMm * 2;
        const imgHeight = (canvas.height * contentWidth) / canvas.width;

        let heightLeft = imgHeight;
        let y = marginMm;

        pdf.addImage(imgData, 'PNG', marginMm, y, contentWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight - marginMm * 2;

        while (heightLeft > 0) {
            pdf.addPage();
            y = marginMm - (imgHeight - heightLeft);
            pdf.addImage(imgData, 'PNG', marginMm, y, contentWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pageHeight - marginMm * 2;
        }

        pdf.save(filename);
    } finally {
        if (cloneHost.parentNode) {
            cloneHost.parentNode.removeChild(cloneHost);
        }
    }
};
