/**
 * Coach Othmeni — Stripe one-time payments (no subscriptions).
 *
 * Functions:
 *   - createCheckoutSession  (callable)  -> coaching pack (basic / advanced / vip / test) or e-book
 *   - verifyCheckoutSession  (callable)  -> called by the site after Stripe redirects back
 *   - stripeWebhook          (HTTP)      -> Stripe calls this; source of truth for "paid"
 *
 * Prices are defined HERE on the server. The browser only sends a product key
 * ("basic", "ebook", ...), so nobody can change the amount from the browser.
 */

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const Stripe = require('stripe');

initializeApp();
const db = getFirestore();

// ---- Secrets / config (never hard-code keys in this file) ----
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

const REGION = 'us-central1';

// ---- E-book: private file in Firebase Storage, streamed only to paying customers ----
const EBOOK_STORAGE_PATH = 'private/ebook/elite-performance-guide.pdf';
const EBOOK_FILE_NAME = 'Elite-Performance-Nutrition-Training-Guide.pdf';
const EBOOK_MAX_DOWNLOADS = 5;
const EBOOK_DOWNLOAD_ENDPOINT = `https://${REGION}-coach-othmeni.cloudfunctions.net/downloadEbook`;
const ebookUrl = (sessionId) => `${EBOOK_DOWNLOAD_ENDPOINT}?session_id=${encodeURIComponent(sessionId)}`;

// ---- Catalogue: Stripe product IDs + amounts in cents (USD) ----
const CATALOG = {
  basic:    { productId: 'prod_VZWTDKeSafu5pf', amount: 5000,  name: 'Basic Pack',    kind: 'coaching' },
  advanced: { productId: 'prod_VZrRFgWpy8r5aI', amount: 10000, name: 'Advanced Pack', kind: 'coaching' },
  vip:      { productId: 'prod_VZrUgPpbKOV0Oe', amount: 15000, name: 'VIP Pack',      kind: 'coaching' },
  test:     { productId: 'prod_VZrWaMkXU8i7MG', amount: 100,   name: 'Test Pack',     kind: 'coaching' },
  ebook:    { productId: 'prod_VZrWHnQnW7IZDm', amount: 1500,  name: 'E-Book',        kind: 'ebook' },
};

const COLLECTIONS = { coaching: 'coaching_applications', ebook: 'ebook_orders' };

let stripeClient = null;
function stripe() {
  if (!stripeClient) stripeClient = new Stripe(STRIPE_SECRET_KEY.value());
  return stripeClient;
}

/** Where Stripe sends the customer back. Uses the site that made the request. */
function siteOrigin(request) {
  const origin = request.rawRequest?.headers?.origin || '';
  if (/^https?:\/\/[^/]+$/i.test(origin)) return origin;
  return 'https://coach-aymen-othmani.pages.dev';
}

const str = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/* ------------------------------------------------------------------ */
/* 1) Create the Stripe Checkout page                                  */
/* ------------------------------------------------------------------ */
exports.createCheckoutSession = onCall(
  { region: REGION, secrets: [STRIPE_SECRET_KEY], cors: true },
  async (request) => {
    const data = request.data || {};
    const productKey = str(data.productKey, 20);
    const item = CATALOG[productKey];
    if (!item) throw new HttpsError('invalid-argument', 'Unknown product.');

    const origin = siteOrigin(request);
    let docRef;
    let email = '';

    if (item.kind === 'coaching') {
      const profile = data.client_profile || {};
      email = str(profile.email, 200).toLowerCase();
      if (str(profile.name, 200).length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new HttpsError('invalid-argument', 'Name and a valid email are required.');
      }

      docRef = db.collection(COLLECTIONS.coaching).doc();
      await docRef.set({
        client_profile: {
          name: str(profile.name, 200),
          email,
          phone: str(profile.phone, 50),
          country: str(profile.country, 100),
        },
        physical_metrics: {
          height_cm: Number(data.physical_metrics?.height_cm) || 0,
          current_weight_kg: Number(data.physical_metrics?.current_weight_kg) || 0,
          target_weight_kg: Number(data.physical_metrics?.target_weight_kg) || 0,
        },
        coaching_questionnaire: data.coaching_questionnaire || {},
        subscription: {               // field name kept so the admin dashboard keeps working
          plan_key: productKey,
          plan_name: item.name,
          amount: item.amount / 100,
          stripeProductId: item.productId,
        },
        payment: { status: 'pending', stripeSessionId: null },
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      docRef = db.collection(COLLECTIONS.ebook).doc();
      await docRef.set({
        product: item.name,
        amount: item.amount / 100,
        stripeProductId: item.productId,
        payment: { status: 'pending', stripeSessionId: null },
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    const session = await stripe().checkout.sessions.create({
      mode: 'payment', // one-time purchase, NOT a subscription
      line_items: [{
        quantity: 1,
        price_data: { currency: 'usd', product: item.productId, unit_amount: item.amount },
      }],
      ...(email ? { customer_email: email } : {}),
      client_reference_id: docRef.id,
      metadata: { orderId: docRef.id, productKey, kind: item.kind },
      payment_intent_data: { metadata: { orderId: docRef.id, productKey, kind: item.kind } },
      success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
    });

    await docRef.update({ 'payment.stripeSessionId': session.id });
    logger.info('Checkout created', { orderId: docRef.id, productKey, sessionId: session.id });

    return { checkoutUrl: session.url, orderId: docRef.id };
  }
);

/* ------------------------------------------------------------------ */
/* Shared: mark an order as paid (safe to call many times)             */
/* ------------------------------------------------------------------ */
async function markPaid(session) {
  const { orderId, kind } = session.metadata || {};
  if (!orderId || !COLLECTIONS[kind]) return null;

  const ref = db.collection(COLLECTIONS[kind]).doc(orderId);
  const update = {
    'payment.status': 'paid',
    'payment.stripeSessionId': session.id,
    'payment.paymentIntentId': session.payment_intent || null,
    'payment.amountPaid': (session.amount_total || 0) / 100,
    'payment.currency': session.currency || 'usd',
    'payment.paidAt': FieldValue.serverTimestamp(),
  };
  if (kind === 'ebook') {
    update.customer_email = session.customer_details?.email || null;
    update.customer_name = session.customer_details?.name || null;
  }
  await ref.update(update);
  return { orderId, kind };
}

/* ------------------------------------------------------------------ */
/* 2) Verify after redirect (gives instant feedback + e-book link)     */
/* ------------------------------------------------------------------ */
exports.verifyCheckoutSession = onCall(
  { region: REGION, secrets: [STRIPE_SECRET_KEY], cors: true },
  async (request) => {
    const sessionId = str(request.data?.sessionId, 300);
    if (!sessionId.startsWith('cs_')) throw new HttpsError('invalid-argument', 'Invalid session.');

    const session = await stripe().checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === 'paid';
    const kind = session.metadata?.kind || null;

    if (paid) await markPaid(session);

    return {
      paid,
      kind,
      productKey: session.metadata?.productKey || null,
      email: session.customer_details?.email || null,
      ebookUrl: paid && kind === 'ebook' ? ebookUrl(session.id) : null,
    };
  }
);

/* ------------------------------------------------------------------ */
/* 3) Stripe webhook (source of truth, works even if the tab closes)   */
/* ------------------------------------------------------------------ */
exports.stripeWebhook = onRequest(
  { region: REGION, secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    let event;
    try {
      event = stripe().webhooks.constructEvent(
        req.rawBody,
        req.headers['stripe-signature'],
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (err) {
      logger.warn('Webhook signature failed', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    try {
      const session = event.data.object;
      switch (event.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
          if (session.payment_status === 'paid') await markPaid(session);
          break;
        case 'checkout.session.expired':
        case 'checkout.session.async_payment_failed': {
          const { orderId, kind } = session.metadata || {};
          if (orderId && COLLECTIONS[kind]) {
            const ref = db.collection(COLLECTIONS[kind]).doc(orderId);
            const snap = await ref.get();
            if (snap.exists && snap.get('payment.status') !== 'paid') {
              await ref.update({ 'payment.status': 'cancelled' });
            }
          }
          break;
        }
        default:
          break;
      }
      res.json({ received: true });
    } catch (err) {
      logger.error('Webhook handler error', err);
      res.status(500).send('Handler error');
    }
  }
);

/* ------------------------------------------------------------------ */
/* 4) Secure e-book download                                           */
/*    GET /downloadEbook?session_id=cs_...                             */
/*    - checks with Stripe that this checkout was PAID for the e-book  */
/*    - max EBOOK_MAX_DOWNLOADS downloads per purchase                 */
/*    - streams the private PDF (the file itself is never public)      */
/* ------------------------------------------------------------------ */
exports.downloadEbook = onRequest(
  { region: REGION, secrets: [STRIPE_SECRET_KEY] },
  async (req, res) => {
    const deny = (code, msg) => res.status(code).type('text/plain').send(msg);
    if (req.method !== 'GET') return deny(405, 'Method not allowed.');

    const sessionId = str(req.query.session_id, 300);
    if (!sessionId.startsWith('cs_')) return deny(400, 'Invalid download link.');

    let session;
    try {
      session = await stripe().checkout.sessions.retrieve(sessionId);
    } catch (err) {
      return deny(404, 'Purchase not found.');
    }
    if (session.payment_status !== 'paid' || session.metadata?.kind !== 'ebook' || !session.metadata?.orderId) {
      return deny(403, 'This purchase is not paid.');
    }

    const orderRef = db.collection(COLLECTIONS.ebook).doc(session.metadata.orderId);
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(orderRef);
        const count = snap.exists ? (snap.get('downloadCount') || 0) : 0;
        if (count >= EBOOK_MAX_DOWNLOADS) throw new Error('LIMIT');
        tx.set(orderRef, {
          downloadCount: count + 1,
          lastDownloadAt: FieldValue.serverTimestamp(),
          'payment': { status: 'paid', stripeSessionId: session.id },
        }, { merge: true });
      });
    } catch (err) {
      if (err.message === 'LIMIT') {
        return deny(429, 'Download limit reached for this purchase. Please contact Coach Aymen on WhatsApp: +971 52 616 4854');
      }
      logger.error('Download counter error', err);
      return deny(500, 'Please try again in a moment.');
    }

    const file = getStorage().bucket().file(EBOOK_STORAGE_PATH);
    const [exists] = await file.exists();
    if (!exists) {
      logger.error('E-book file missing in Storage', { path: EBOOK_STORAGE_PATH });
      return deny(503, 'The e-book is being prepared. Please contact Coach Aymen on WhatsApp: +971 52 616 4854');
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${EBOOK_FILE_NAME}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    });
    file.createReadStream()
      .on('error', (err) => {
        logger.error('E-book stream error', err);
        if (!res.headersSent) deny(500, 'Download failed. Please try again.'); else res.end();
      })
      .pipe(res);
  }
);
