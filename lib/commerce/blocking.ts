export function blockingActionAllowsReply(
  status: string | null | undefined,
  confirmationStatus: string | null | undefined,
) {
  return status === "succeeded" && confirmationStatus === "prepared";
}
