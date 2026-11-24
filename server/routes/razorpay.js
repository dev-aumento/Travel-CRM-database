import crypto from 'crypto';
import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

const keyId = () => String(process.env.RAZORPAY_KEY_ID || '').trim();
const keySecret = () => String(process.env.RAZORPAY_KEY_SECRET || '').trim();

const authHeader = () => `Basic ${Buffer.from(`${keyId()}:${keySecret()}`).toString('base64')}`;

const requireKeys = (res) => {
    if (keyId() && keySecret()) return true;
    res.status(503).json({
        error: 'Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the .env file, then restart the app.',
    });
    return false;
};

const parsePlanPriceValue = (price) => {
    const digits = String(price || '').replace(/[^\d.]/g, '');
    const parsed = Number(digits);
    return Number.isFinite(parsed) ? parsed : 0;
};

const readStoredAmount = (value) => {
    if (value === '' || value == null) return null;
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

/** Keep in step with getPlanPriceInr in src/utils/planPricing.ts */
const getPlanPriceInr = (plan, cycle) => {
    const monthly = readStoredAmount(plan?.priceInr) ?? parsePlanPriceValue(plan?.price);
    if (cycle !== 'yearly') return monthly;
    return readStoredAmount(plan?.priceYearlyInr) ?? monthly * 12;
};

const findPlan = async (planName) => {
    const plans = mongoose.connection.db.collection('plans');
    return plans.findOne({ name: planName });
};

router.post('/payments/razorpay/order', async (req, res) => {
    try {
        if (!requireKeys(res)) return;

        const planName = String(req.body?.planName || '').trim();
        const billingCycle = req.body?.billingCycle === 'yearly' ? 'yearly' : 'monthly';
        const agentId = String(req.body?.agentId || '').trim();

        if (!planName || !agentId) {
            return res.status(400).json({ error: 'Plan and agency are required.' });
        }

        const plan = await findPlan(planName);
        if (!plan) {
            return res.status(404).json({ error: 'Plan not found. Refresh the page and try again.' });
        }

        const amount = Math.round(getPlanPriceInr(plan, billingCycle) * 100);
        if (amount <= 0) {
            return res.json({ free: true, planName, billingCycle, amount: 0, currency: 'INR' });
        }
        if (amount < 100) {
            return res.status(400).json({ error: 'This plan price is below the Razorpay minimum of ₹1.' });
        }

        const receipt = `crm_${agentId}_${Date.now()}`.slice(0, 40);
        const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                Authorization: authHeader(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount,
                currency: 'INR',
                receipt,
                notes: { planName, billingCycle, agentId },
            }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const description = payload?.error?.description || 'Razorpay could not create the order.';
            return res.status(502).json({ error: description });
        }

        return res.json({
            keyId: keyId(),
            orderId: payload.id,
            amount: payload.amount,
            currency: payload.currency || 'INR',
            planName,
            billingCycle,
        });
    } catch (error) {
        console.error('Razorpay order failed:', error);
        return res.status(500).json({ error: 'Could not start the Razorpay payment.' });
    }
});

router.post('/payments/razorpay/verify', async (req, res) => {
    try {
        if (!requireKeys(res)) return;

        const orderId = String(req.body?.razorpay_order_id || '');
        const paymentId = String(req.body?.razorpay_payment_id || '');
        const signature = String(req.body?.razorpay_signature || '');
        const planName = String(req.body?.planName || '').trim();
        const billingCycle = req.body?.billingCycle === 'yearly' ? 'yearly' : 'monthly';
        const agentId = String(req.body?.agentId || '').trim();

        if (!orderId || !paymentId || !signature || !planName || !agentId) {
            return res.status(400).json({ error: 'Payment confirmation is incomplete.' });
        }

        const expected = crypto.createHmac('sha256', keySecret()).update(`${orderId}|${paymentId}`).digest('hex');
        const expectedBuf = Buffer.from(expected);
        const signatureBuf = Buffer.from(signature);
        const valid =
            expectedBuf.length === signatureBuf.length && crypto.timingSafeEqual(expectedBuf, signatureBuf);

        if (!valid) {
            return res.status(400).json({ error: 'Payment signature could not be verified.' });
        }

        const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
            headers: { Authorization: authHeader() },
        });
        const order = await orderRes.json().catch(() => ({}));
        if (!orderRes.ok) {
            return res.status(502).json({ error: 'Could not confirm the Razorpay order.' });
        }

        const notes = order.notes || {};
        if (notes.planName !== planName || notes.billingCycle !== billingCycle || notes.agentId !== agentId) {
            return res.status(400).json({ error: 'This payment does not match the selected plan.' });
        }

        const paymentRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
            headers: { Authorization: authHeader() },
        });
        const payment = await paymentRes.json().catch(() => ({}));
        if (!paymentRes.ok) {
            return res.status(502).json({ error: 'Could not confirm the Razorpay payment.' });
        }
        if (payment.order_id !== orderId) {
            return res.status(400).json({ error: 'Payment does not belong to this order.' });
        }
        if (!['captured', 'authorized'].includes(payment.status)) {
            return res.status(400).json({ error: 'Payment was not completed.' });
        }

        return res.json({
            ok: true,
            planName,
            billingCycle,
            agentId,
            paymentId,
            orderId,
            amountInr: Number(payment.amount ?? order.amount ?? 0) / 100,
        });
    } catch (error) {
        console.error('Razorpay verify failed:', error);
        return res.status(500).json({ error: 'Could not verify the payment.' });
    }
});

export default router;
