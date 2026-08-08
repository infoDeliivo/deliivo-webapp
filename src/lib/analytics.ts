/**
 * dataLayer contract between the app and GTM container GTM-KL8DBG96.
 *
 * Every name in `AnalyticsEvent` has a matching `CE - <name>` trigger and a
 * `GA4 - EV - <name>` tag in the container. Pushing a name that is not in the
 * union means no tag fires, so the union is the guard against silent typos -
 * keep it in sync with the container.
 */

type EcommerceEvent =
  | 'view_item'
  | 'view_item_list'
  | 'select_item'
  | 'add_payment_info'
  | 'begin_checkout'
  | 'booking_request'
  | 'purchase'
  | 'refund';

type PlainEvent =
  // identity
  | 'user_identified'
  | 'user_logout'
  // auth
  | 'sign_up_start'
  | 'sign_up'
  | 'login'
  | 'otp_resend'
  | 'complete_registration'
  // rider funnel
  | 'search'
  | 'search_no_results'
  | 'ride_alert_created'
  | 'view_price_quote'
  | 'payment_pending'
  | 'payment_failed'
  | 'payment_retry'
  // driver supply
  | 'publish_blocked'
  | 'publish_start'
  | 'publish_step'
  | 'price_recommendation_viewed'
  | 'publish_ride'
  // driver onboarding
  | 'payout_setup_start'
  | 'payout_setup_submit'
  | 'payout_document_uploaded'
  | 'payout_setup_complete'
  | 'payout_setup_pending'
  | 'verification_start'
  | 'verification_in_flight'
  | 'verification_submitted'
  | 'verification_canceled'
  | 'verification_failed'
  | 'vehicle_draft_start'
  | 'vehicle_document_uploaded'
  | 'vehicle_complete'
  // engagement and post-purchase
  | 'generate_lead'
  | 'contact_click'
  | 'share'
  | 'tracking_view'
  | 'ride_completed'
  | 'submit_rating'
  | 'create_dispute';

export type AnalyticsEvent = PlainEvent | EcommerceEvent;

type EventParams = Record<string, string | number | boolean | null | undefined>;

export interface EcommerceItem {
  item_id: string;
  item_name?: string;
  price?: number;
  quantity?: number;
}

export interface EcommercePayload {
  transaction_id?: string;
  value?: number;
  currency?: string;
  items?: EcommerceItem[];
}

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

const FALLBACK_CURRENCY = 'EUR';

/**
 * The backend types `currency` as a plain string. GA4 and Ads silently drop the
 * whole `value` when it is not valid ISO-4217 - the conversion still counts but
 * at zero, which breaks value bidding without ever surfacing an error.
 */
function safeCurrency(currency: string | undefined | null): string {
  const upper = currency?.toUpperCase();
  return upper && /^[A-Z]{3}$/.test(upper) ? upper : FALLBACK_CURRENCY;
}

function dropEmpty(params: EventParams): EventParams {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null));
}

/** Push a non-ecommerce event. No-op during SSR. */
export function pushEvent(event: PlainEvent, params: EventParams = {}): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...dropEmpty(params) });
}

/**
 * Push a GA4 ecommerce event. The monetary payload has to sit inside `ecommerce`
 * - GTM's "Send Ecommerce data / Data Layer" reads `dataLayer.ecommerce` and
 * cannot see top-level keys.
 */
export function pushEcommerceEvent(
  event: EcommerceEvent,
  ecommerce: EcommercePayload,
  params: EventParams = {},
): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  // The data layer keeps objects across pushes, so a stale `ecommerce` would be
  // inherited by the next event - the classic duplicated-purchase bug.
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({
    event,
    ecommerce: {
      ...dropEmpty(ecommerce as EventParams),
      ...(ecommerce.currency !== undefined ? { currency: safeCurrency(ecommerce.currency) } : {}),
      ...(ecommerce.items ? { items: ecommerce.items } : {}),
    },
    ...dropEmpty(params),
  });
}

/**
 * Identify the signed-in user. Call from the single login choke point so every
 * auth path (OTP signup, OTP login, Google) is covered once.
 *
 * `UserProfile` carries no rider/driver distinction - that only emerges from
 * driver eligibility - so `user_type` is optional and left unset until a caller
 * genuinely knows which one it is.
 */
export function pushUserIdentified(
  userId: string,
  options: { userType?: 'rider' | 'driver'; locale?: string } = {},
): void {
  pushEvent('user_identified', { user_id: userId, user_type: options.userType, locale: options.locale });
}

/** Clear the identity on logout so the next session is not attributed to it. */
export function pushUserLogout(): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'user_logout', user_id: undefined });
}
