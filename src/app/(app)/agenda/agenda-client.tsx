"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { minutesToTime } from "@/lib/agenda/time";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/agenda/status";
import { useOpenAppointment } from "./appointment-sheet";

export type AgendaAppointment = {
  id: string;
  professionalId: string;
  start: number;
  end: number;
  startsAt: string;
  status: string;
  kind: string;
  customerName: string;
  customerPhone: string | null;
  services: string[];
  totalCents: number;
};

export type AgendaColumn = {
  id: string;
  name: string;
  color: string;
  intervals: { start: number; end: number }[];
  blocks: { start: number; end: number }[];
  appointments: AgendaAppointment[];
};

const PX_PER_MINUTE = 1.6;

function AppointmentBlock({
  appointment,
  color,
  top,
}: {
  appointment: AgendaAppointment;
  color: string;
  top: number;
}) {
  const onSelect = useOpenAppointment();
  const height = Math.max((appointment.end - appointment.start) * PX_PER_MINUTE, 28);
  return (
    <button
      type="button"
      data-testid="agenda-appointment"
      onClick={() => onSelect(appointment)}
      className="absolute inset-x-1 overflow-hidden rounded-md px-2 py-1 text-left text-xs text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      style={{ top, height, backgroundColor: color, opacity: appointment.status === "awaiting_payment" || appointment.status === "paid" ? 0.7 : 1 }}
    >
      <span className="block font-semibold tabular-nums">
        {minutesToTime(appointment.start)} {appointment.customerName}
      </span>
      <span className="block truncate">{appointment.services.join(" + ")}</span>
      {appointment.status !== "scheduled" && (
        <span className="block truncate opacity-90">{APPOINTMENT_STATUS_LABELS[appointment.status]}</span>
      )}
    </button>
  );
}

export function DayGrid({
  columns,
  range,
  selectedId,
}: {
  columns: AgendaColumn[];
  range: { start: number; end: number };
  selectedId: string;
}) {
  const [mobileId, setMobileId] = useState(selectedId);
  const height = (range.end - range.start) * PX_PER_MINUTE;
  const hours: number[] = [];
  for (let m = Math.ceil(range.start / 60) * 60; m <= range.end; m += 60) hours.push(m);
  const y = (minutes: number) => (minutes - range.start) * PX_PER_MINUTE;

  return (
    <div className="flex flex-col gap-3">
      {columns.length > 1 && (
        <div className="flex gap-2 overflow-x-auto md:hidden" role="tablist" aria-label="Profissional">
          {columns.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={mobileId === c.id}
              onClick={() => setMobileId(c.id)}
              className={cn(
                "flex h-11 shrink-0 items-center gap-2 rounded-full border px-4",
                mobileId === c.id && "border-primary bg-primary text-primary-foreground",
              )}
            >
              <span className="size-3 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
              {c.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex overflow-x-auto rounded-xl border">
        <div className="relative w-12 shrink-0 border-r" style={{ height }} aria-hidden>
          {hours.map((m) => (
            <span key={m} className="absolute right-1 -translate-y-1/2 text-xs text-muted-foreground tabular-nums" style={{ top: y(m) }}>
              {minutesToTime(m)}
            </span>
          ))}
        </div>
        {columns.map((c) => (
          <section
            key={c.id}
            aria-label={c.name}
            data-testid={`agenda-column-${c.id}`}
            className={cn("min-w-40 flex-1 border-r last:border-r-0", c.id !== mobileId && "hidden md:block")}
          >
            <h2 className="sticky top-0 z-10 flex h-10 items-center gap-2 border-b bg-background px-2 text-sm font-medium">
              <span className="size-3 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
              <span className="truncate">{c.name}</span>
            </h2>
            <div
              className="relative bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,var(--muted)_6px,var(--muted)_12px)]"
              style={{ height }}
            >
              {hours.map((m) => (
                <div key={m} className="absolute inset-x-0 border-t border-dashed border-border/60" style={{ top: y(m) }} />
              ))}
              {c.intervals.map((i) => (
                <div key={i.start} className="absolute inset-x-0 bg-background" style={{ top: y(i.start), height: (i.end - i.start) * PX_PER_MINUTE }} />
              ))}
              {c.blocks.map((b, idx) => (
                <div
                  key={idx}
                  className="absolute inset-x-0 bg-muted text-center text-xs text-muted-foreground"
                  style={{ top: y(Math.max(b.start, range.start)), height: (Math.min(b.end, range.end) - Math.max(b.start, range.start)) * PX_PER_MINUTE }}
                >
                  Bloqueado
                </div>
              ))}
              {c.appointments.map((a) => (
                <AppointmentBlock key={a.id} appointment={a} color={c.color} top={y(a.start)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function WeekList({
  days,
  color,
}: {
  days: { date: string; label: string; appointments: AgendaAppointment[] }[];
  color: string;
}) {
  const onSelect = useOpenAppointment();
  return (
    <ol className="flex flex-col gap-4">
      {days.map((d) => (
        <li key={d.date} data-testid={`agenda-day-${d.date}`}>
          <h2 className="mb-2 text-sm font-semibold">{d.label}</h2>
          {d.appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem atendimentos.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {d.appointments.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    data-testid="agenda-appointment"
                    onClick={() => onSelect(a)}
                    className="flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left hover:bg-muted"
                  >
                    <span className="h-8 w-1 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                    <span className="font-medium tabular-nums">{minutesToTime(a.start)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {a.customerName} · {a.services.join(" + ")}
                    </span>
                    {a.status !== "scheduled" && (
                      <span className="text-sm text-muted-foreground">{APPOINTMENT_STATUS_LABELS[a.status]}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
