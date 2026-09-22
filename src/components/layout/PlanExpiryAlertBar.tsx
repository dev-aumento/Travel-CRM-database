import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '../../context/DatabaseContext';
import { getAgentPlanExpiryAlert } from '../../utils/agentPlan';
import { isMainAgencyOwnerSession, resolveMainAgencyAgent } from '../../utils/databaseSync';

const PlanExpiryAlertBar: React.FC = () => {
    const navigate = useNavigate();
    const { db } = useDatabase();
    const userRole = localStorage.getItem('userRole');
    const userEmail = localStorage.getItem('userEmail');
    const sessionAgentId = localStorage.getItem('agentId');

    if (userRole === 'admin') return null;

    const agencyAgent = resolveMainAgencyAgent(db, {
        sessionAgentId,
        userEmail,
    });
    const alert = getAgentPlanExpiryAlert(agencyAgent);
    if (!alert) return null;

    const canRenew = isMainAgencyOwnerSession(userRole, sessionAgentId, db);
    const dayLabel = alert.daysLeft === 1 ? 'day' : 'days';

    return (
        <div
            role="alert"
            className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 md:px-8 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
            <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg shrink-0">
                    <AlertTriangle size={18} />
                </div>
                <p className="text-sm text-amber-900">
                    <span className="font-bold">Your {alert.planName} plan is expiring soon.</span>{' '}
                    It expires on {alert.expiryDateText} ({alert.daysLeft} {dayLabel} left).
                    {canRenew
                        ? ' Renew or purchase a plan to continue using this CRM.'
                        : ' Please ask your agency owner to renew the plan.'}
                </p>
            </div>
            {canRenew && (
                <button
                    onClick={() => navigate('/plans')}
                    className="shrink-0 self-start sm:self-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                >
                    Renew Plan
                </button>
            )}
        </div>
    );
};

export default PlanExpiryAlertBar;
