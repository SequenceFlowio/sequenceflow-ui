export type CancellationEligibility = { allowed: true } | { allowed: false; reason: string };

export function evaluateCancellation(input: {
  cancelable: boolean;
  cancelledAt: string | null;
  financialStatus?: string | null;
  fulfillmentStatus: string | null;
  totalAmount: number;
  maxCancelAmount: number;
  currencyCode: string;
  shopCurrency: string | null;
}): CancellationEligibility {
  if (input.cancelledAt) return { allowed: false, reason: "Order is already cancelled." };
  if (["REFUNDED", "PARTIALLY_REFUNDED"].includes(String(input.financialStatus ?? "").toUpperCase())) {
    return { allowed: false, reason: "Refunded or partially refunded orders require manual handling." };
  }
  if (!input.cancelable) return { allowed: false, reason: "The commerce provider does not consider this order safely cancelable." };
  if (["FULFILLED", "PARTIALLY_FULFILLED", "PARTIAL", "SHIPPED"].includes(String(input.fulfillmentStatus ?? "").toUpperCase())) {
    return { allowed: false, reason: "Fulfilled or partially fulfilled orders cannot be cancelled here." };
  }
  if (input.shopCurrency && input.currencyCode !== input.shopCurrency) {
    return { allowed: false, reason: "Order currency differs from the configured shop currency." };
  }
  if (input.totalAmount > input.maxCancelAmount) {
    return { allowed: false, reason: `Order exceeds the approval limit of ${input.maxCancelAmount} ${input.shopCurrency ?? input.currencyCode}.` };
  }
  return { allowed: true };
}

export function evaluateCancellationRetry(input: Parameters<typeof evaluateCancellation>[0] & {
  allowFullyRefundedClosure: boolean;
}): CancellationEligibility {
  const fullyRefunded = String(input.financialStatus ?? "").toUpperCase() === "REFUNDED";
  const closingVerifiedRefund = input.allowFullyRefundedClosure && fullyRefunded;

  return evaluateCancellation({
    ...input,
    // A WooCommerce refund can succeed before the final order-status update.
    // The adapter still proves ownership through the action fingerprint before
    // it closes that order; every other live safety condition remains enforced.
    financialStatus: closingVerifiedRefund ? null : input.financialStatus,
    cancelable: closingVerifiedRefund ? true : input.cancelable,
  });
}
