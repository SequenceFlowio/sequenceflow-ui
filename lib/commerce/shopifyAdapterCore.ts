export type ShopifyGraphQl = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

export async function submitShopifyCancellation(input: {
  graphql: ShopifyGraphQl;
  mutation: string;
  externalOrderId: string;
  staffNote: string;
}) {
  const data = await input.graphql<{
    orderCancel: {
      job?: { id?: string; done?: boolean } | null;
      orderCancelUserErrors?: Array<{ message?: string }>;
      userErrors?: Array<{ message?: string }>;
    };
  }>(input.mutation, { orderId: input.externalOrderId, staffNote: input.staffNote });
  const errors = [
    ...(data.orderCancel.orderCancelUserErrors ?? []),
    ...(data.orderCancel.userErrors ?? []),
  ].map((error) => error.message).filter(Boolean);
  if (errors.length) throw new Error(errors.join("; "));
  const job = data.orderCancel.job;
  return {
    status: job?.done ? "succeeded" as const : "provider_pending" as const,
    providerJobId: job?.id ?? null,
    response: { jobId: job?.id ?? null, done: Boolean(job?.done) },
  };
}
