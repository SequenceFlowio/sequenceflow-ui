import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { AppShell } from "@/components/AppShell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppShell>{children}</AppShell>
      </LanguageProvider>
    </ThemeProvider>
  );
}
