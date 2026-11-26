import { getCurrencySymbol, parseCurrencyCode, resolveAgencyCurrency } from './currency';
import { getBookingPaymentDetails } from './pricingConsistency';
import { recordVisibleToSession } from './databaseSync';
import {
    compareQuoteVersions,
    findLeadForQuote,
    formatQuoteVersionLabel,
    normalizeQuoteVersion,
} from './quoteActivities';

export type TransferKind = 'leads' | 'customers' | 'finances' | 'bookings' | 'quotations' | 'terms';

export type TransferResult = { added: number; updated: number; skipped: number };

export const TRANSFER_KINDS: { id: TransferKind; label: string; hint: string }[] = [
    { id: 'leads', label: 'Leads', hint: 'Name, contact, destination, dates, and status' },
    { id: 'customers', label: 'Customers', hint: 'Name, email, phone, and booking count' },
    { id: 'finances', label: 'Finances', hint: 'Invoice totals and amounts paid on bookings' },
    { id: 'bookings', label: 'Bookings', hint: 'Customer, package, dates, total, and status' },
    { id: 'quotations', label: 'Quotations', hint: 'Customer, version (V1, V1.1), destination, and total' },
    { id: 'terms', label: 'Terms', hint: 'Title, location, and terms text' },
];

const PREFIX: Record<Exclude<TransferKind, 'finances'>, string> = {
    leads: 'LD',
    customers: 'CUST',
    bookings: 'BK',
    quotations: 'QT',
    terms: 'TC',
};

const TABLE: Record<Exclude<TransferKind, 'finances'>, string> = {
    leads: 'leads',
    customers: 'customers',
    bookings: 'bookings',
    quotations: 'quotations',
    terms: 'quoteTerms',
};

const cell = (value: unknown) => {
    const text = value == null ? '' : String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
};

const toCsv = (headers: string[], rows: unknown[][]) =>
    [headers.map(cell).join(','), ...rows.map((row) => row.map(cell).join(','))].join('\n');

export const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let value = '';
    let quoted = false;
    const source = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < source.length; i += 1) {
        const char = source[i];
        if (quoted) {
            if (char === '"') {
                if (source[i + 1] === '"') {
                    value += '"';
                    i += 1;
                } else {
                    quoted = false;
                }
            } else {
                value += char;
            }
        } else if (char === '"') {
            quoted = true;
        } else if (char === ',') {
            row.push(value);
            value = '';
        } else if (char === '\n') {
            row.push(value);
            rows.push(row);
            row = [];
            value = '';
        } else if (char !== '\r') {
            value += char;
        }
    }
    if (value.length || row.length) {
        row.push(value);
        rows.push(row);
    }
    return rows.filter((line) => line.some((item) => item.trim()));
};

const asObjects = (grid: string[][]) => {
    const headers = (grid[0] || []).map((header) => header.trim().toLowerCase());
    return grid.slice(1).map((line) => {
        const record: Record<string, string> = {};
        headers.forEach((header, index) => {
            record[header] = (line[index] || '').trim();
        });
        return record;
    });
};

const pick = (row: Record<string, string>, ...keys: string[]) => {
    for (const key of keys) {
        const value = row[key.toLowerCase()];
        if (value) return value;
    }
    return '';
};

const CURRENCY_MARKS: [string, string][] = [
    ['A$', 'AUD'],
    ['CA$', 'CAD'],
    ['C$', 'CAD'],
    ['NZ$', 'NZD'],
    ['HK$', 'HKD'],
    ['S$', 'SGD'],
    ['₹', 'INR'],
    ['€', 'EUR'],
    ['£', 'GBP'],
    ['¥', 'JPY'],
    ['₩', 'KRW'],
    ['₽', 'RUB'],
    ['₺', 'TRY'],
    ['₫', 'VND'],
    ['฿', 'THB'],
    ['$', 'USD'],
];

/** Budget strings store a currency symbol. Excel shows that symbol as a broken icon, so export the code instead. */
export const formatLeadBudgetForCsv = (raw: unknown, agencyCurrency?: string | null): string => {
    const text = String(raw ?? '').trim();
    if (!text) return '';
    const explicit = text.match(/^([A-Z]{3})\b/i);
    let code = explicit ? explicit[1].toUpperCase() : '';
    if (!code) {
        const mark = CURRENCY_MARKS.find(([symbol]) => text.includes(symbol));
        if (mark?.[0] === '$') {
            const agencyCode = parseCurrencyCode(agencyCurrency);
            const agencySymbol = getCurrencySymbol(agencyCurrency);
            code = agencySymbol.includes('$') ? agencyCode : 'USD';
        } else if (mark) {
            code = mark[1];
        }
    }
    const amount = text
        .replace(/^([A-Z]{3})\b/i, '')
        .replace(/[₹€£¥₩₽₺₫฿]/g, '')
        .replace(/A\$|CA\$|C\$|NZ\$|HK\$|S\$|\$/g, '')
        .trim();
    return code ? `${code} ${amount}`.trim() : text;
};

/** Turn an exported budget such as "INR 2,96,604" back into the symbol form the CRM stores. */
export const leadBudgetFromCsv = (raw: string): string => {
    const text = String(raw || '').trim();
    const match = text.match(/^([A-Z]{3})\b\s*(.*)$/i);
    if (!match) return text;
    const code = match[1].toUpperCase();
    const amount = match[2].trim();
    const symbol = getCurrencySymbol(code);
    if (!symbol || symbol === code) return `${code} ${amount}`.trim();
    return `${symbol} ${amount}`.trim();
};

const moneyNumber = (value: string) => {
    const numeric = Number(String(value || '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(numeric) ? numeric : 0;
};

const yes = (value: string) => /^(1|y|yes|true)$/i.test(value);

const downloadCsv = (filename: string, csv: string) => {
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
};

type Scope = { agentId: string; userEmail: string; userRole: string; isAdmin: boolean };

const visible = (table: string, row: any, db: any, scope: Scope) => {
    if (scope.isAdmin) return true;
    if (table === 'quoteTerms') return !row?.agentId || row.agentId === scope.agentId;
    if (table === 'customers') return customerNamesForAgency(db, scope).has(row?.name);
    return recordVisibleToSession(table, row, db, {
        userRole: scope.userRole || 'agent',
        userEmail: scope.userEmail,
        sessionAgentId: scope.agentId,
    });
};

const customerNamesForAgency = (db: any, scope: Scope) => {
    const names = new Set<string>();
    (db?.leads?.data || []).forEach((lead: any) => {
        if (visible('leads', lead, db, scope) && lead.name) names.add(lead.name);
    });
    (db?.bookings?.data || []).forEach((booking: any) => {
        if (visible('bookings', booking, db, scope) && booking.customer) names.add(booking.customer);
    });
    return names;
};

const rowsFor = (kind: TransferKind, db: any, scope: Scope) => {
    if (kind === 'finances') {
        return (db?.bookings?.data || []).filter((row: any) => visible('bookings', row, db, scope));
    }
    if (kind === 'customers') {
        const all = db?.customers?.data || [];
        if (scope.isAdmin) return all;
        const names = customerNamesForAgency(db, scope);
        return all.filter((row: any) => names.has(row.name));
    }
    const table = TABLE[kind];
    return (db?.[table]?.data || []).filter((row: any) => visible(table, row, db, scope));
};

const quoteCustomerName = (quote: any, db: any) => {
    const saved = String(quote?.customer || '').trim();
    if (saved) return saved;
    const lead = findLeadForQuote(quote, db?.leads?.data || []);
    return String(lead?.name || '').trim();
};

export const quotationExportRows = (rows: any[], db: any) => {
    const quotes = [...rows].sort((left: any, right: any) => {
        const byCustomer = quoteCustomerName(left, db).localeCompare(quoteCustomerName(right, db));
        if (byCustomer !== 0) return byCustomer;
        return compareQuoteVersions(left.version, right.version);
    });
    const byId = new Map((db?.quotations?.data || rows).map((quote: any) => [quote.id, quote]));
    return quotes.map((row: any) => {
        const version = formatQuoteVersionLabel(row.version);
        const parent = row.parentId ? byId.get(row.parentId) : null;
        return [
            row.id,
            quoteCustomerName(row, db),
            `V${version}`,
            version.includes('.') ? 'Revision' : 'Quote',
            parent ? `V${formatQuoteVersionLabel(parent.version)}` : '',
            row.destination,
            row.source,
            row.airport,
            row.duration,
            row.travelers,
            row.total,
            row.status,
            row.date,
        ];
    });
};

export const exportTransferCsv = (kind: TransferKind, db: any, scope: Scope) => {
    const rows = rowsFor(kind, db, scope);
    let headers: string[] = [];
    let body: unknown[][] = [];

    if (kind === 'leads') {
        headers = ['ID', 'Name', 'Email', 'Phone', 'Destination', 'Travelers', 'Dates', 'Duration', 'Source', 'Airport', 'Budget', 'Status'];
        body = rows.map((row: any) => [
            row.id, row.name, row.email, row.phone, row.destination, row.travelers, row.dates,
            row.duration, row.sourceCountry || row.source, row.sourceAirport || row.airport,
            formatLeadBudgetForCsv(row.budget, resolveAgencyCurrency(db, scope.userEmail)),
            row.status,
        ]);
    } else if (kind === 'customers') {
        headers = ['ID', 'Name', 'Email', 'Phone', 'Total Bookings'];
        body = rows.map((row: any) => [row.id, row.name, row.email, row.phone, row.totalBookings ?? 0]);
    } else if (kind === 'finances') {
        headers = ['Booking ID', 'Customer', 'Package', 'Dates', 'Total', 'Amount Paid', 'Payment Status', 'Status'];
        body = rows.map((row: any) => {
            const payment = getBookingPaymentDetails(row, db);
            return [row.id, row.customer, row.package, row.dates, payment.total, payment.amountPaid, payment.status, row.status];
        });
    } else if (kind === 'bookings') {
        headers = ['ID', 'Customer', 'Email', 'Phone', 'Package', 'Dates', 'Travelers', 'Source', 'Airport', 'Total', 'Status', 'Payment Status', 'Amount Paid'];
        body = rows.map((row: any) => {
            const payment = getBookingPaymentDetails(row, db);
            return [
                row.id, row.customer, row.email, row.phone, row.package, row.dates, row.travelers,
                row.source, row.airport, row.total || payment.total, row.status, payment.status, payment.amountPaid,
            ];
        });
    } else if (kind === 'quotations') {
        headers = ['ID', 'Customer', 'Version', 'Type', 'Revised From', 'Destination', 'Source', 'Airport', 'Duration', 'Travelers', 'Total', 'Status', 'Date'];
        body = quotationExportRows(rows, db);
    } else {
        headers = ['ID', 'Title', 'Location', 'Locations', 'Content', 'Status', 'Default'];
        body = rows.map((row: any) => [
            row.id, row.title, row.location, (row.locations || []).join(', '), row.content, row.status || 'Active',
            row.isDefault ? 'Yes' : 'No',
        ]);
    }

    downloadCsv(`${kind}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(headers, body));
};

const nextSerial = (db: any, table: string) => {
    const numbers = (db?.[table]?.data || [])
        .map((row: any) => parseInt(String(row.id || '').split('-').pop() || '', 10))
        .filter((value: number) => Number.isFinite(value));
    return numbers.length ? Math.max(...numbers) : 0;
};

export const importTransferCsv = (
    kind: TransferKind,
    csvText: string,
    db: any,
    scope: Scope,
    addRecord: (table: string, record: any) => void,
    updateRecord: (table: string, id: string, updates: any) => void
): TransferResult => {
    const objects = asObjects(parseCsv(csvText));
    const result: TransferResult = { added: 0, updated: 0, skipped: 0 };
    const serials: Record<string, number> = {};

    const freshId = (table: string, prefix: string) => {
        if (serials[table] == null) serials[table] = nextSerial(db, table);
        serials[table] += 1;
        return `${prefix}-${String(serials[table]).padStart(3, '0')}`;
    };

    const existingIn = (table: string, id: string) =>
        (db?.[table]?.data || []).find((row: any) => String(row.id) === id);

    objects.forEach((row) => {
        if (kind === 'finances') {
            const bookingId = pick(row, 'booking id', 'id');
            const current = existingIn('bookings', bookingId);
            if (current && !visible('bookings', current, db, scope)) {
                result.skipped += 1;
                return;
            }
            if (!current) {
                const customer = pick(row, 'customer');
                if (!customer) {
                    result.skipped += 1;
                    return;
                }
                addRecord('bookings', {
                    id: bookingId || freshId('bookings', 'BK'),
                    customer,
                    package: pick(row, 'package'),
                    dates: pick(row, 'dates'),
                    total: pick(row, 'total'),
                    status: pick(row, 'status') || 'confirmed',
                    paymentStatus: pick(row, 'payment status') || 'unpaid',
                    paid: moneyNumber(pick(row, 'amount paid')),
                    agentId: scope.agentId || null,
                });
                result.added += 1;
                return;
            }
            const paidText = pick(row, 'amount paid');
            updateRecord('bookings', current.id, {
                ...(pick(row, 'total') ? { total: pick(row, 'total') } : {}),
                ...(pick(row, 'status') ? { status: pick(row, 'status') } : {}),
                ...(pick(row, 'payment status') ? { paymentStatus: pick(row, 'payment status').toLowerCase() } : {}),
                ...(paidText ? { paid: moneyNumber(paidText) } : {}),
            });
            result.updated += 1;
            return;
        }

        const table = TABLE[kind];
        const prefix = PREFIX[kind];
        const requestedId = pick(row, 'id');
        const current = requestedId ? existingIn(table, requestedId) : null;
        if (current && !visible(table, current, db, scope)) {
            result.skipped += 1;
            return;
        }

        let record: any = null;
        if (kind === 'leads') {
            const name = pick(row, 'name');
            if (!name) {
                result.skipped += 1;
                return;
            }
            record = {
                name,
                email: pick(row, 'email'),
                phone: pick(row, 'phone'),
                destination: pick(row, 'destination'),
                travelers: pick(row, 'travelers'),
                dates: pick(row, 'dates'),
                duration: pick(row, 'duration'),
                sourceCountry: pick(row, 'source'),
                sourceAirport: pick(row, 'airport'),
                budget: leadBudgetFromCsv(pick(row, 'budget')),
                status: (pick(row, 'status') || 'new').toLowerCase(),
                agentId: current?.agentId || scope.agentId || null,
            };
        } else if (kind === 'customers') {
            const name = pick(row, 'name');
            if (!name) {
                result.skipped += 1;
                return;
            }
            record = {
                name,
                email: pick(row, 'email'),
                phone: pick(row, 'phone'),
                totalBookings: moneyNumber(pick(row, 'total bookings')),
            };
        } else if (kind === 'bookings') {
            const customer = pick(row, 'customer');
            if (!customer) {
                result.skipped += 1;
                return;
            }
            record = {
                customer,
                email: pick(row, 'email'),
                phone: pick(row, 'phone'),
                package: pick(row, 'package'),
                dates: pick(row, 'dates'),
                travelers: pick(row, 'travelers'),
                source: pick(row, 'source'),
                airport: pick(row, 'airport'),
                total: pick(row, 'total'),
                status: (pick(row, 'status') || 'confirmed').toLowerCase(),
                paymentStatus: (pick(row, 'payment status') || 'unpaid').toLowerCase(),
                paid: moneyNumber(pick(row, 'amount paid')),
                agentId: current?.agentId || scope.agentId || null,
            };
        } else if (kind === 'quotations') {
            const customer = pick(row, 'customer', 'customer name');
            if (!customer) {
                result.skipped += 1;
                return;
            }
            const versionText = pick(row, 'version').replace(/^v/i, '');
            record = {
                customer,
                destination: pick(row, 'destination'),
                source: pick(row, 'source'),
                airport: pick(row, 'airport'),
                duration: pick(row, 'duration'),
                travelers: pick(row, 'travelers'),
                total: pick(row, 'total'),
                status: (pick(row, 'status') || 'draft').toLowerCase(),
                date: pick(row, 'date') || new Date().toISOString().slice(0, 10),
                ...(versionText ? { version: normalizeQuoteVersion(versionText) } : {}),
                agentId: current?.agentId || scope.agentId || null,
            };
        } else {
            const title = pick(row, 'title');
            if (!title) {
                result.skipped += 1;
                return;
            }
            const locations = pick(row, 'locations')
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);
            record = {
                title,
                location: pick(row, 'location') || locations[0] || 'Global',
                locations,
                content: pick(row, 'content'),
                status: pick(row, 'status') || 'Active',
                isDefault: yes(pick(row, 'default')),
                agentId: current?.agentId || scope.agentId || null,
                updatedAt: new Date().toISOString(),
            };
        }

        if (current) {
            updateRecord(table, current.id, record);
            result.updated += 1;
            return;
        }
        const id = requestedId && !existingIn(table, requestedId) ? requestedId : freshId(table, prefix);
        addRecord(table, { id, ...record });
        result.added += 1;
    });

    return result;
};
