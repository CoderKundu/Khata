/**
 * State for the payment-link sheet.
 *
 * It lives here rather than beside the action because a "use server" file may
 * only export async functions, so the initial-state constant cannot sit there.
 */

export type PaymentLinkState = {
  errors: { amount?: string };
  formError: string | null;
  /** Set only once a link actually exists. The sheet switches on this. */
  sent: {
    whatsappUrl: string;
    link: string;
    message: string;
  } | null;
};

export const emptyPaymentLinkState: PaymentLinkState = {
  errors: {},
  formError: null,
  sent: null,
};
