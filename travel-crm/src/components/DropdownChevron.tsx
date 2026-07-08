import { ChevronDown } from 'lucide-react';
import type { LucideProps } from 'lucide-react';

export type DropdownChevronProps = LucideProps & {
    /** When provided, rotation follows this flag (custom dropdowns). Omit for native selects inside `.crm-select-wrap`. */
    open?: boolean;
};

const DropdownChevron = ({ open, className = '', ...props }: DropdownChevronProps) => {
    const rotationClass = open === undefined ? '' : open ? 'rotate-180' : '';

    return (
        <span
            className={`inline-flex items-center justify-center ${className}`.trim()}
            aria-hidden
        >
            <ChevronDown
                {...props}
                data-open={open === undefined ? undefined : open ? 'true' : 'false'}
                className={`crm-dropdown-chevron shrink-0 transition-transform duration-200 ${rotationClass}`.trim()}
            />
        </span>
    );
};

export default DropdownChevron;
