/** Stripe error codes -> what a shopper should read. Unknown codes get a safe generic line; raw provider text is never shown (it can be technical or leak detail). */
const MAP: Record<string, string> = {
  card_declined: 'Your card was declined. Try another card or payment method.',
  insufficient_funds: 'Your card has insufficient funds. Try another card.',
  expired_card: 'Your card has expired. Try another card.',
  incorrect_cvc: 'The security code is not right. Check it and try again.',
  incorrect_number: 'The card number is not right. Check it and try again.',
  invalid_expiry_year: 'The expiry date is not right. Check it and try again.',
  invalid_expiry_month: 'The expiry date is not right. Check it and try again.',
  processing_error: 'Something went wrong processing your card. Please try again.',
  authentication_failure: 'We could not verify this payment with your bank. Try again or use another card.',
  payment_intent_authentication_failure: 'We could not verify this payment with your bank. Try again or use another card.',
  payment_intent_unexpected_state: 'This payment has already been handled. Refresh the page to see your order.',
  rate_limit: 'Too many attempts. Please wait a moment and try again.',
};
export const messageFor = (code?: string | null) => (code && MAP[code]) || 'We could not take your payment. You have not been charged. Please try again.';
