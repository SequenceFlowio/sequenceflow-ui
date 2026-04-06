"use client";

import { useEffect, useState } from "react";

type Config = {
  empathyEnabled: boolean;
  allowDiscount: boolean;
  maxDiscountAmount: number | null;
  signature: string;
};

const DEFAULT_CONFIG: Config = {
  empathyEnabled: true,
  allowDiscount: false,
  maxDiscountAmount: null,
  signature: "Team SequenceFlow",
};

type SupportResponse = {
  status: string;
  confidence: number;
  draft: {
    subject: string;
    body: string;
  };
  actions: any[];
  reasons: string[];
};

export default function AgentPage() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [preview, setPreview] = useState<SupportResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/agent-config");
      const data = await res.json();
      setConfig(data?.config ?? DEFAULT_CONFIG);
    }
    load();
  }, []);

  async function saveConfig() {
    await fetch("/api/agent-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
  }

  async function generatePreview() {
    setLoading(true);
    setPreview(null);

    const res = await fetch("/api/support/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: "Order #1234 arrived damaged",
        body: "Hi, my product arrived damaged. What can you do?",
        channel: "email",
        customer: {
          name: "John Doe",
          email: "john@example.com",
          language: "nl",
        },
        order: {
          orderId: "1234",
          productName: "Office Chair",
          pricePaid: 199,
          currency: "EUR",
        },
        config: {
          empathyEnabled: config.empathyEnabled,
          allowDiscount: config.allowDiscount,
          maxDiscountAmount: config.maxDiscountAmount ?? 0,
          signature: config.signature,
        },
      }),
    });

    const data = await res.json();
    setPreview(data);
    setLoading(false);
  }

  function confidenceColor(score: number): string {
    if (score >= 0.8) return "#C7F56F";
    if (score >= 0.6) return "#eab308";
    return "#ef4444";
  }

  return (
    <div className="p-10 min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <h1 className="text-3xl font-bold mb-8">Support Agent Config</h1>

      <div className="grid grid-cols-2 gap-10">
        <div className="space-y-6">
          <div>
            <label className="flex items-center gap-2 text-sm text-[var(--text)]">
              <input
                type="checkbox"
                checked={config.empathyEnabled}
                onChange={(e) =>
                  setConfig({ ...config, empathyEnabled: e.target.checked })
                }
              />
              Enable empathy
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-[var(--text)]">
              <input
                type="checkbox"
                checked={config.allowDiscount}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    allowDiscount: e.target.checked,
                    maxDiscountAmount: e.target.checked
                      ? config.maxDiscountAmount ?? 10
                      : null,
                  })
                }
              />
              Allow discount
            </label>
          </div>

          {config.allowDiscount && (
            <div>
              <label className="block mb-2 text-sm font-semibold text-[var(--text)]">Max discount (€)</label>
              <input
                type="number"
                className="w-full p-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                value={config.maxDiscountAmount ?? 0}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    maxDiscountAmount: Number(e.target.value),
                  })
                }
              />
            </div>
          )}

          <div>
            <label className="block mb-2 text-sm font-semibold text-[var(--text)]">Signature</label>
            <textarea
              className="w-full p-2 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
              value={config.signature}
              onChange={(e) =>
                setConfig({ ...config, signature: e.target.value })
              }
            />
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={saveConfig}
              className="px-6 py-2 rounded border border-[var(--border)] text-[var(--text)] bg-[var(--surface)] hover:bg-[var(--bg)] transition-colors"
            >
              Save Config
            </button>

            <button
              type="button"
              onClick={generatePreview}
              className="px-6 py-2 rounded font-bold transition-colors"
              style={{ background: "#C7F56F", color: "#1a1a1a" }}
            >
              Generate Preview
            </button>
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-2xl">
          <h2 className="text-xl font-semibold mb-4 text-[var(--text)]">AI Preview</h2>

          {loading && <p className="text-[var(--muted)] text-sm">Generating...</p>}

          {preview && (
            <div className="space-y-4 text-sm text-[var(--text)]">
              <div>
                <strong>Status:</strong>{" "}
                <span style={{ color: preview.status === "NEEDS_HUMAN" ? "#ef4444" : "#C7F56F", fontWeight: 600 }}>
                  {preview.status}
                </span>
              </div>

              <div>
                <strong>Confidence:</strong>{" "}
                <span style={{ color: confidenceColor(preview.confidence), fontWeight: 600 }}>
                  {(preview.confidence * 100).toFixed(0)}%
                </span>
              </div>

              <div>
                <strong>Subject:</strong>
                <div className="mt-1 text-[var(--muted)]">{preview.draft?.subject}</div>
              </div>

              <div>
                <strong>Body:</strong>
                <div className="mt-1 whitespace-pre-wrap text-[var(--muted)]">
                  {preview.draft?.body}
                </div>
              </div>

              {preview.reasons?.length > 0 && (
                <div>
                  <strong>Reasons:</strong>
                  <ul className="list-disc ml-6 mt-1" style={{ color: "#ef4444" }}>
                    {preview.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
