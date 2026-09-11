/**
 * Formats a backend-supplied amount for display.
 *
 * Formatting only — this module intentionally contains no arithmetic. Every money figure the UI
 * shows is computed by the backend; deriving amounts client-side is what caused the publish screen
 * to promise drivers a fee rate the backend was not charging.
 */
export const formatMoney = (
    amount: number | null | undefined,
    currency?: string | null,
    fallback = '--'
): string => {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return fallback;
    const prefix = currency ? `${currency} ` : '';
    return `${prefix}${amount.toFixed(2)}`;
};
