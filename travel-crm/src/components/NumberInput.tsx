import {
    forwardRef,
    useCallback,
    useEffect,
    useState,
    type ChangeEvent,
    type FocusEvent,
    type InputHTMLAttributes,
    type KeyboardEvent,
    type WheelEvent,
} from 'react';

type NativeValue = string | number | readonly string[] | undefined | null;

export type NumberInputProps = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'defaultValue' | 'onChange'
> & {
    value?: NativeValue;
    defaultValue?: NativeValue;
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
    /** Override decimal allowance. Defaults from `step` (fractional step → decimals allowed). */
    allowDecimal?: boolean;
};

const toDisplayString = (value: NativeValue): string => {
    if (value === undefined || value === null || value === '') return '0';
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return '0';
        return String(value);
    }
    const text = String(Array.isArray(value) ? value[0] ?? '' : value).trim();
    return text === '' ? '0' : text;
};

const shouldAllowDecimal = (
    step: InputHTMLAttributes<HTMLInputElement>['step'],
    allowDecimal?: boolean
) => {
    if (typeof allowDecimal === 'boolean') return allowDecimal;
    if (step === 'any') return true;
    // Match native <input type="number">: decimals allowed unless step is a whole number.
    if (step === undefined || step === null || step === '') return true;
    const numericStep = Number(step);
    if (!Number.isFinite(numericStep)) return true;
    return numericStep % 1 !== 0;
};

/** Keep digits (and optional single decimal); strip leading zeros so typing replaces default 0. */
export const sanitizeNumberInput = (raw: string, allowDecimal: boolean): string => {
    let cleaned = raw.replace(allowDecimal ? /[^\d.]/g : /\D/g, '');

    if (allowDecimal) {
        const firstDot = cleaned.indexOf('.');
        if (firstDot !== -1) {
            cleaned =
                cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
        }
    }

    if (cleaned === '' || cleaned === '.') return cleaned;

    if (cleaned.startsWith('.')) cleaned = `0${cleaned}`;

    if (cleaned.includes('.')) {
        const [whole, fraction = ''] = cleaned.split('.');
        const normalizedWhole = whole.replace(/^0+(?=\d)/, '') || '0';
        return `${normalizedWhole}.${fraction}`;
    }

    return cleaned.replace(/^0+(?=\d)/, '') || '0';
};

const withValue = (event: ChangeEvent<HTMLInputElement>, nextValue: string) => {
    event.target.value = nextValue;
    return event;
};

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
    {
        value,
        defaultValue = 0,
        onChange,
        onFocus,
        onBlur,
        onKeyDown,
        allowDecimal,
        step,
        min,
        max,
        className,
        inputMode,
        ...rest
    },
    ref
) {
    const isControlled = value !== undefined;
    const decimals = shouldAllowDecimal(step, allowDecimal);
    const [innerValue, setInnerValue] = useState(() => toDisplayString(defaultValue));

    useEffect(() => {
        if (!isControlled) {
            setInnerValue(toDisplayString(defaultValue));
        }
    }, [defaultValue, isControlled]);

    const displayValue = isControlled ? toDisplayString(value) : innerValue;

    const commit = useCallback(
        (event: ChangeEvent<HTMLInputElement>, next: string) => {
            if (!isControlled) setInnerValue(next);
            onChange?.(withValue(event, next));
        },
        [isControlled, onChange]
    );

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        commit(event, sanitizeNumberInput(event.target.value, decimals));
    };

    const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
        // Select current value so typing replaces default 0 (or any existing number).
        requestAnimationFrame(() => event.target.select());
        onFocus?.(event);
    };

    const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
        let next = sanitizeNumberInput(event.target.value, decimals);
        if (next === '' || next === '.') next = '0';

        let numeric = Number(next);
        if (!Number.isFinite(numeric)) numeric = 0;

        if (min !== undefined && min !== null && `${min}` !== '' && numeric < Number(min)) {
            next = String(Number(min));
            numeric = Number(min);
        }
        if (max !== undefined && max !== null && `${max}` !== '' && numeric > Number(max)) {
            next = String(Number(max));
        }

        if (event.target.value !== next) {
            commit(event as unknown as ChangeEvent<HTMLInputElement>, next);
        } else if (!isControlled && innerValue !== next) {
            setInnerValue(next);
        }
        onBlur?.(event);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (['e', 'E', '+', '-'].includes(event.key)) {
            event.preventDefault();
        }
        if (!decimals && event.key === '.') {
            event.preventDefault();
        }
        onKeyDown?.(event);
    };

    const handleWheel = (event: WheelEvent<HTMLInputElement>) => {
        if (document.activeElement === event.currentTarget) {
            event.currentTarget.blur();
        }
    };

    return (
        <input
            {...rest}
            ref={ref}
            type="text"
            inputMode={inputMode ?? (decimals ? 'decimal' : 'numeric')}
            step={step}
            min={min}
            max={max}
            className={className}
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onWheel={handleWheel}
            autoComplete="off"
        />
    );
});

export default NumberInput;
