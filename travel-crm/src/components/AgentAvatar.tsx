import React from 'react';
import { User } from 'lucide-react';

type AgentAvatarProps = {
    agent?: {
        name?: string;
        businessName?: string;
        avatar?: string;
    } | null;
    className?: string;
    roundedClassName?: string;
    textClassName?: string;
    fallbackClassName?: string;
    fallback?: 'initial' | 'icon';
    iconSize?: number;
    alt?: string;
};

export const getAgentInitial = (agent?: { name?: string; businessName?: string } | null): string =>
    String(agent?.name || agent?.businessName || 'A').charAt(0).toUpperCase();

const AgentAvatar: React.FC<AgentAvatarProps> = ({
    agent,
    className = 'w-10 h-10',
    roundedClassName = 'rounded-xl',
    textClassName = 'text-sm',
    fallbackClassName = 'bg-slate-900 text-white',
    fallback = 'initial',
    iconSize = 20,
    alt,
}) => {
    const avatar = String(agent?.avatar || '').trim();
    const label = alt || agent?.name || agent?.businessName || 'Agent';

    if (avatar) {
        return (
            <div
                className={`${className} shrink-0 ${roundedClassName} overflow-hidden border border-slate-200 bg-slate-100`}
            >
                <img src={avatar} alt={label} className="w-full h-full object-cover" />
            </div>
        );
    }

    if (fallback === 'icon') {
        return (
            <div
                className={`${className} shrink-0 ${roundedClassName} ${fallbackClassName} flex items-center justify-center`}
            >
                <User size={iconSize} />
            </div>
        );
    }

    return (
        <div
            className={`${className} shrink-0 ${roundedClassName} ${fallbackClassName} flex items-center justify-center font-black ${textClassName} shadow-sm`}
        >
            {getAgentInitial(agent)}
        </div>
    );
};

export default AgentAvatar;
