"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { scheduleSchema, WEEKDAY_LABELS, type ScheduleSlot } from "@/lib/professionals/schedule";
import { saveSchedule } from "../actions";

type Interval = { startsAt: string; endsAt: string };

// Segunda primeiro, domingo por último (como a semana de trabalho é lida no salão).
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function ScheduleEditor({ professionalId, initial }: { professionalId: string; initial: ScheduleSlot[] }) {
  const [days, setDays] = useState<Record<number, Interval[]>>(() => {
    const out: Record<number, Interval[]> = {};
    for (const s of initial) (out[s.weekday] ??= []).push({ startsAt: s.startsAt, endsAt: s.endsAt });
    return out;
  });
  const [error, setError] = useState<{ weekday: number; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (weekday: number, intervals: Interval[]) => {
    setError(null);
    setDays((d) => ({ ...d, [weekday]: intervals }));
  };

  const save = () => {
    const slots: ScheduleSlot[] = WEEK_ORDER.flatMap((weekday) => (days[weekday] ?? []).map((i) => ({ weekday, ...i })));
    const parsed = scheduleSchema.safeParse(slots);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const [first] = issue.path;
      // Sobreposição aponta o weekday; fim antes do início aponta o índice do slot.
      const weekday = issue.path.length === 1 ? Number(first) : slots[Number(first)].weekday;
      setError({ weekday, message: issue.message });
      return;
    }
    startTransition(async () => {
      const result = await saveSchedule(professionalId, slots);
      if (result.ok) toast.success("Jornada salva");
      else toast.error(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y">
        {WEEK_ORDER.map((weekday) => {
          const intervals = days[weekday] ?? [];
          const label = WEEKDAY_LABELS[weekday];
          const works = intervals.length > 0;
          return (
            <li key={weekday} className="flex flex-col gap-2 py-3" data-testid={`schedule-${weekday}`}>
              <div className="flex min-h-11 items-center justify-between gap-3">
                <label className="flex items-center gap-3 font-medium">
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    checked={works}
                    onChange={(e) =>
                      update(weekday, e.target.checked ? [{ startsAt: "09:00", endsAt: "18:00" }] : [])
                    }
                  />
                  {label}
                </label>
                {works ? (
                  <Button
                    variant="ghost"
                    className="h-11"
                    aria-label={`Adicionar intervalo em ${label}`}
                    onClick={() => update(weekday, [...intervals, { startsAt: "", endsAt: "" }])}
                  >
                    <Plus aria-hidden />
                    Intervalo
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">Não trabalha</span>
                )}
              </div>
              {intervals.map((interval, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="time"
                    aria-label={`${label}, início do intervalo ${index + 1}`}
                    value={interval.startsAt}
                    onChange={(e) =>
                      update(weekday, intervals.map((it, i) => (i === index ? { ...it, startsAt: e.target.value } : it)))
                    }
                    className="h-11 w-32 text-base"
                  />
                  <span aria-hidden>até</span>
                  <Input
                    type="time"
                    aria-label={`${label}, fim do intervalo ${index + 1}`}
                    value={interval.endsAt}
                    onChange={(e) =>
                      update(weekday, intervals.map((it, i) => (i === index ? { ...it, endsAt: e.target.value } : it)))
                    }
                    className="h-11 w-32 text-base"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Remover intervalo ${index + 1} de ${label}`}
                    onClick={() => update(weekday, intervals.filter((_, i) => i !== index))}
                  >
                    <X aria-hidden />
                  </Button>
                </div>
              ))}
              {error?.weekday === weekday && (
                <p role="alert" className="text-sm text-destructive">
                  {error.message}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <Button className="h-11 self-start text-base" disabled={pending} onClick={save}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Salvar jornada
      </Button>
    </div>
  );
}
