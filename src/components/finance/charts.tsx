import { formatBRL } from "@/lib/format";
import { percentOf } from "@/lib/reports";

/** Barras de faturamento por dia (SVG, acessível: cada barra tem <title>). */
export function DailyBars({ data }: { data: { date: string; revenue_cents: number; count: number }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.revenue_cents), 1);
  const width = 640;
  const height = 160;
  const gap = 4;
  const bar = Math.max(4, Math.min(48, (width - gap * (data.length - 1)) / data.length));
  const total = data.length * bar + (data.length - 1) * gap;
  const br = (d: string) => d.slice(8, 10) + "/" + d.slice(5, 7);
  return (
    <figure>
      <svg role="img" aria-label="Faturamento por dia" viewBox={`0 0 ${Math.max(total, width)} ${height + 24}`} className="w-full text-primary">
        <line x1="0" x2={Math.max(total, width)} y1={height} y2={height} stroke="currentColor" strokeOpacity="0.25" />
        {data.map((d, i) => {
          const h = Math.max(2, (d.revenue_cents / max) * (height - 8));
          const x = i * (bar + gap);
          return (
            <g key={d.date}>
              <rect x={x} y={height - h} width={bar} height={h} rx="3" fill="currentColor">
                <title>{`${br(d.date)}: ${formatBRL(d.revenue_cents)} (${d.count} venda${d.count === 1 ? "" : "s"})`}</title>
              </rect>
              {data.length <= 16 || i % Math.ceil(data.length / 12) === 0 ? (
                <text x={x + bar / 2} y={height + 16} textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.7">{br(d.date)}</text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Lista com barras de participação (valor + %). */
export function ShareList({ rows, total, empty }: { rows: { label: string; cents: number; extra?: string }[]; total: number; empty?: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty ?? "Sem dados no período."}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const pct = percentOf(r.cents, total);
        return (
          <li key={r.label}>
            <div className="flex justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{r.label}{r.extra ? <span className="text-muted-foreground"> · {r.extra}</span> : null}</span>
              <span className="shrink-0 font-medium">{formatBRL(r.cents)} <span className="text-muted-foreground">({pct.toLocaleString("pt-BR")}%)</span></span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-muted" role="presentation">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
