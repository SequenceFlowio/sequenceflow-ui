type MailboxConfig = {
  smtp?: { host?: string; fromEmail?: string; hasPassword?: boolean };
  imap?: { host?: string; username?: string; hasPassword?: boolean };
};

export function configuredMailboxEmail(config: MailboxConfig): string {
  const { smtp, imap } = config;
  if ((smtp?.host || smtp?.hasPassword) && smtp?.fromEmail) return smtp.fromEmail;
  if ((imap?.host || imap?.hasPassword) && imap?.username) return imap.username;
  return "";
}
