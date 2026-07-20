export const WOO_ACTION_META_KEY = "sequenceflow_action_fingerprint";

export type WooMeta = { key?: string; value?: unknown };
export type WooCancellationOrder = {
  id: number;
  status: string;
  total: string;
  line_items?: Array<{
    id: number;
    quantity: number;
    total?: string;
    taxes?: Array<{ id: number; total?: string }>;
  }>;
};
export type WooCancellationRefund = {
  id: number;
  amount?: string;
  meta_data?: WooMeta[];
};
export type WooRequest = <T>(path: string, init?: RequestInit) => Promise<T>;
const ZERO = BigInt(0);

function decimalScale(values: string[]) {
  return Math.min(8, values.reduce((scale, value) => Math.max(scale, value.split(".")[1]?.length ?? 0), 0));
}

function decimalUnits(value: string, scale: number) {
  const match = value.trim().match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) throw new Error(`WooCommerce returned an invalid amount: ${value}`);
  const fraction = (match[3] ?? "").padEnd(scale, "0").slice(0, scale);
  const units = BigInt(`${match[2]}${fraction}`);
  return match[1] ? -units : units;
}

function formatUnits(units: bigint, scale: number) {
  const negative = units < ZERO;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, "0");
  const value = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits;
  return negative ? `-${value}` : value;
}

export function calculateWooRefundAmounts(orderTotal: string, refunds: Array<Pick<WooCancellationRefund, "amount">>) {
  const values = [orderTotal, ...refunds.map((refund) => refund.amount ?? "0")];
  const scale = decimalScale(values);
  const totalUnits = decimalUnits(orderTotal, scale);
  if (totalUnits < ZERO) throw new Error("WooCommerce returned a negative order total.");
  const refundedUnits = refunds.reduce((sum, refund) => {
    const amount = decimalUnits(refund.amount ?? "0", scale);
    return sum + (amount < ZERO ? -amount : amount);
  }, ZERO);
  const remainingUnits = totalUnits > refundedUnits ? totalUnits - refundedUnits : ZERO;
  return {
    orderTotal: formatUnits(totalUnits, scale),
    totalRefunded: formatUnits(refundedUnits, scale),
    remaining: formatUnits(remainingUnits, scale),
    remainingUnits,
    scale,
  };
}

export async function submitWooCommerceCancellation(input: {
  request: WooRequest;
  externalOrderId: string;
  staffNote: string;
  idempotencyKey: string;
}) {
  const orderPath = `orders/${input.externalOrderId}`;
  const refundPath = `${orderPath}/refunds`;
  const order = await input.request<WooCancellationOrder>(orderPath);
  const refunds = await input.request<WooCancellationRefund[]>(refundPath);
  const existingActionRefund = refunds.find((refund) => refund.meta_data?.some(
    (meta) => meta.key === WOO_ACTION_META_KEY && meta.value === input.idempotencyKey,
  ));
  const amounts = calculateWooRefundAmounts(order.total, refunds);

  if (refunds.length > 0 && !existingActionRefund) {
    throw new Error("This order already has a refund outside this action. Partially refunded orders require manual handling.");
  }
  if (existingActionRefund && amounts.remainingUnits > ZERO) {
    throw new Error("A refund for this action already exists, but the order is not fully refunded. Resolve the remaining amount manually.");
  }

  let refund = existingActionRefund;
  let refundCreated = false;
  if (!refund && amounts.remainingUnits > ZERO) {
    refund = await input.request<WooCancellationRefund>(refundPath, {
      method: "POST",
      body: JSON.stringify({
        amount: amounts.remaining,
        reason: input.staffNote,
        api_refund: true,
        api_restock: true,
        line_items: (order.line_items ?? []).filter((item) => item.quantity > 0).map((item) => ({
          id: item.id,
          quantity: item.quantity,
          refund_total: item.total ?? "0",
          refund_tax: (item.taxes ?? []).map((tax) => ({ id: tax.id, refund_total: tax.total ?? "0" })),
        })),
        meta_data: [{ key: WOO_ACTION_META_KEY, value: input.idempotencyKey }],
      }),
    });
    refundCreated = true;
  }

  const alreadyClosed = order.status === "cancelled";
  const cancelled = alreadyClosed ? order : await input.request<WooCancellationOrder>(orderPath, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled" }),
  });

  return {
    status: "succeeded" as const,
    providerJobId: null,
    response: {
      orderId: cancelled.id,
      orderStatus: cancelled.status,
      refundId: refund?.id ?? null,
      refundCreated,
      refundAmount: refundCreated ? amounts.remaining : "0",
      restockedItemCount: refundCreated ? (order.line_items ?? []).filter((item) => item.quantity > 0).length : 0,
      totalRefundedBeforeAction: amounts.totalRefunded,
      orderTotal: amounts.orderTotal,
    },
  };
}
