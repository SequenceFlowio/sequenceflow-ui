"use client";

import { useState } from "react";

export type BarSeries = { name: string; color: string };
export type BarPoint = { label: string; full?: string; values: number[] };

function format(value: number, unit: "count" | "eur") {
  return unit === "eur"
    ? `€${(value / 100).toLocaleString("nl-NL", { maximumFractionDigits: 0 })}`
    : value.toLocaleString("nl-NL");
}

/** Niet-afgeronde bovengrens naar een rond getal, zodat de as leesbaar blijft. */
function niceMax(value: number) {
  if (value <= 0) return 2;
  const power = 10 ** Math.floor(Math.log10(value));
  // Even stappen, zodat ook het midden van de as een heel getal is.
  const step = [2, 4, 6, 8, 10].find((candidate) => candidate * power >= value) ?? 10;
  return step * power;
}

/**
 * Staafdiagram met één of meer reeksen naast elkaar, één as. Kleur volgt de
 * reeks; cijfers staan in de tooltip en in de tabel eronder (voor wie de
 * grafiek niet kan aflezen).
 */
export function BarChart({ points, series, unit = "count", height = 180, every = 1, label }: {
  points: BarPoint[]; series: BarSeries[]; unit?: "count" | "eur"; height?: number; every?: number; label: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...points.flatMap((point) => point.values)));
  const ticks = [max, max / 2, 0];
  const hovered = active === null ? null : points[active];

  return (
    <figure className="bo-chart" aria-label={label}>
      {series.length > 1 ? (
        <figcaption className="bo-legend">
          {series.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>)}
        </figcaption>
      ) : null}
      <div className="bo-chart-body" style={{ height }}>
        <div className="bo-chart-axis" aria-hidden="true">
          {ticks.map((tick) => <span key={tick}>{format(tick, unit)}</span>)}
        </div>
        <div className="bo-chart-plot" onMouseLeave={() => setActive(null)}>
          <div className="bo-chart-grid" aria-hidden="true"><i /><i /><i /></div>
          {points.map((point, index) => (
            <button
              type="button"
              key={point.label + index}
              className={`bo-chart-col${active === index ? " is-active" : ""}`}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              aria-label={`${point.full ?? point.label}: ${series.map((item, i) => `${item.name} ${format(point.values[i] ?? 0, unit)}`).join(", ")}`}
            >
              <span className="bo-chart-bars">
                {series.map((item, i) => {
                  const value = point.values[i] ?? 0;
                  return <i key={item.name} style={{ height: `${value > 0 ? Math.max(1.5, (value / max) * 100) : 0}%`, background: item.color }} />;
                })}
              </span>
            </button>
          ))}
          {hovered && active !== null ? (
            <div className="bo-tip" style={{ left: `${((active + 0.5) / points.length) * 100}%` }} role="status">
              <b>{hovered.full ?? hovered.label}</b>
              {series.map((item, i) => (
                <span key={item.name}><i style={{ background: item.color }} />{item.name}<em>{format(hovered.values[i] ?? 0, unit)}</em></span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="bo-chart-labels" aria-hidden="true">
        {points.map((point, index) => <span key={point.label + index}>{index % every === 0 ? point.label : ""}</span>)}
      </div>
    </figure>
  );
}
