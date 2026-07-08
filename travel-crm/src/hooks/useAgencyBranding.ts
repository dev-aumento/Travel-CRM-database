import { useMemo } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { resolveAgencyBranding } from '../utils/databaseSync';

/** Main-agency branding for the logged-in session (sidebar, invoices, quotes). */
export const useAgencyBranding = () => {
    const { db } = useDatabase();
    return useMemo(
        () =>
            resolveAgencyBranding(db, {
                userRole: localStorage.getItem('userRole'),
                userEmail: localStorage.getItem('userEmail'),
                sessionAgentId: localStorage.getItem('agentId'),
            }),
        [db]
    );
};
