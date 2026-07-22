"use client";

import { SettingsSkeleton, SettingsStyles } from "./SettingsUi";

export default function SettingsLoading() {
  return (
    <main className="settings-page">
      <SettingsStyles />
      <header className="settings-heading">
        <div style={{ width: 170, height: 32, borderRadius: 6, background: "var(--surface-subtle)" }} />
        <div style={{ width: "min(100%,520px)", height: 14, marginTop: 12, borderRadius: 6, background: "var(--surface-subtle)" }} />
      </header>
      <div className="settings-tabs-wrap"><div className="settings-tabs" style={{ width: 500, height: 46 }} /></div>
      <SettingsSkeleton />
    </main>
  );
}
