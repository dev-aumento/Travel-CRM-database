export interface RazorpayCheckoutResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    handler: (response: RazorpayCheckoutResponse) => void;
    prefill?: { name?: string; email?: string; contact?: string };
    theme?: { color?: string };
    modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
    open: () => void;
    on: (event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void) => void;
}

declare global {
    interface Window {
        Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
    }
}

export const loadRazorpayCheckout = (): Promise<boolean> => {
    if (typeof window === 'undefined') return Promise.resolve(false);
    if (window.Razorpay) return Promise.resolve(true);

    return new Promise((resolve) => {
        const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');
        if (existing) {
            existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)), { once: true });
            existing.addEventListener('error', () => resolve(false), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.dataset.razorpayCheckout = 'true';
        script.onload = () => resolve(Boolean(window.Razorpay));
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

export const createRazorpayCheckout = (options: RazorpayCheckoutOptions): RazorpayInstance => {
    if (!window.Razorpay) {
        throw new Error('Razorpay checkout is not available.');
    }
    return new window.Razorpay(options);
};
