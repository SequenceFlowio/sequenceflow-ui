export function getInboundEmailDomain() {
  return (process.env.INBOUND_EMAIL_DOMAIN ?? "inbox.emailreply.sequenceflow.io").trim();
}

export function buildTenantInboundAddress(tenantId: string) {
  return `t-${tenantId}@${getInboundEmailDomain()}`;
}
