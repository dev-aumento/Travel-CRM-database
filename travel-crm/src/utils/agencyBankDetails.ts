/** Agency banking details from Agency Profile → Banking (settings record). */

export type AgencyBankDetails = {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    branchName: string;
    gstDetails: string;
};

export const emptyAgencyBankDetails = (): AgencyBankDetails => ({
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    gstDetails: '',
});

/** Prefer agency settings (Agency Profile → Banking). */
export const resolveAgencyBankDetails = (settings?: any | null): AgencyBankDetails => {
    if (!settings || typeof settings !== 'object') return emptyAgencyBankDetails();
    return {
        bankName: String(settings.bankName || '').trim(),
        accountNumber: String(settings.accountNumber || '').trim(),
        ifscCode: String(settings.ifscCode || '').trim(),
        branchName: String(settings.branchName || '').trim(),
        gstDetails: String(settings.gstDetails || '').trim(),
    };
};

export const hasAgencyBankDetails = (details?: AgencyBankDetails | null): boolean => {
    if (!details) return false;
    return Boolean(
        details.bankName ||
            details.accountNumber ||
            details.ifscCode ||
            details.branchName ||
            details.gstDetails
    );
};

/** Ordered lines for PDF / print / WhatsApp / plain text. */
export const formatAgencyBankDetailsLines = (
    details?: AgencyBankDetails | null
): string[] => {
    if (!hasAgencyBankDetails(details) || !details) return [];
    const lines: string[] = [];
    if (details.bankName) lines.push(`Bank name: ${details.bankName}`);
    if (details.accountNumber) lines.push(`Account number: ${details.accountNumber}`);
    if (details.ifscCode) lines.push(`IFSC: ${details.ifscCode}`);
    if (details.branchName) lines.push(`Branch name: ${details.branchName}`);
    if (details.gstDetails) lines.push(`GST: ${details.gstDetails}`);
    return lines;
};

export const formatAgencyBankDetailsPlainText = (
    details?: AgencyBankDetails | null
): string => formatAgencyBankDetailsLines(details).join('\n');
