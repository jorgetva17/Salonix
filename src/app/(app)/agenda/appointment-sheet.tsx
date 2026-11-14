"use client";

import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import { Loader2, MessageCircle, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { APPOINTMENT_EVENT_LABELS, APPOINTMENT_STATUS_LABELS } from "@/lib/agenda/status";
import { whatsappReminderUrl } from "@/lib/agenda/whatsapp";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/cash/methods";
import type { ActionResult } from "@/lib/action-result";
import { formatBRL, formatDateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import {
  cancelAppointment,
  completeAppointment,
  addAppointmentItem,
  getAppointmentDetails,
  markNoShow,
  removeAppointmentItem,
  rescheduleAppointment,
  revertAppointmentStart,
  startAppointment,
  type AppointmentDetails,
} from "./actions";
import { refundAppointment } from "../caixa/actions";
import { PaymentForm } from "../caixa/payment-dialog";
import type { AgendaAppointment } from "./agenda-client";
import { selectClass, SlotPicker, type ProfessionalOption } from "./new-appointment";

type SheetContext = {
  salonName: string;
  timeZone: string;
  canManage: boolean;
  isAdmin: boolean;
  myProfessionalId: string | null;
  professionals: ProfessionalOption[];
  services: { id: string; name: string; price_cents: number }[];
};

const OpenContext = createContext<(a: AgendaAppointment) => void>(() => {});

/** Abre o detalhe do atendimento a partir de qualquer bloco da agenda. */
export function useOpenAppointment() {
  return useContext(OpenContext);
}

export function AppointmentSheetProvider({ children, ...ctx }: SheetContext & { children: ReactNode }) {
  const [selected, setSelected] = useState<AgendaAppointment | null>(null);
  return (
    <OpenContext.Provider value={setSelected}>
      {children}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {selected && <AppointmentDetail key={selected.id} appointment={selected} ctx={ctx} onClose={() => setSelected(null)} />}
        </DialogContent>
      </Dialog>
    </OpenContext.Provider>
  );
}

function AppointmentDetail({
  appointment: a,
  ctx,
  onClose,
}: {
  appointment: AgendaAppointment;
  ctx: SheetContext;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<AppointmentDetails | null>(null);
  const [mode, setMode] = useState<"view" | "reschedule" | "cancel" | "no_show" | "revert" | "pay" | "refund">("view");
  const [pending, startTransition] = useTransition();
  const professional = ctx.professionals.find((p) => p.id === a.professionalId);
  const isOwn = ctx.myProfessionalId !== null && ctx.myProfessionalId === a.professionalId;
  const canAct = ctx.canManage || isOwn;
  // Status lido agora: a agenda pode ainda não ter recebido a última mudança.
  const status = details?.status ?? a.status;

  useEffect(() => {
    startTransition(async () => setDetails(await getAppointmentDetails(a.id)));
  }, [a.id]);
  const reload = () => startTransition(async () => setDetails(await getAppointmentDetails(a.id)));
  // Em curso: quem pode atender ajusta; aguardando pagamento: só a recepção/admin.
  const canAdjust = (status === "in_progress" && canAct) || (status === "awaiting_payment" && ctx.canManage);

  const run = (fn: () => Promise<ActionResult>, success: string) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        onClose();
      } else {
        toast.error(result.error);
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{a.customerName}</DialogTitle>
        <DialogDescription>
          {formatDateTime(a.startsAt, ctx.timeZone)} · {professional?.name}
        </DialogDescription>
      </DialogHeader>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Status</dt>
        <dd data-testid="appointment-status">
          {APPOINTMENT_STATUS_LABELS[status]}
          {details?.refundedAt && " · Estornado"}
        </dd>
        {!canAdjust && (
          <>
            <dt className="text-muted-foreground">Serviços</dt>
            <dd>{details ? details.items.map((i) => i.serviceName).join(" + ") : a.services.join(" + ")}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Total</dt>
        <dd data-testid="appointment-total">{formatBRL(details?.totalCents ?? a.totalCents)}</dd>
        {details && details.discountCents > 0 && (
          <>
            <dt className="text-muted-foreground">Desconto</dt>
            <dd>{formatBRL(details.discountCents)}</dd>
          </>
        )}
        {details && details.payments.length > 0 && (
          <>
            <dt className="text-muted-foreground">Pagamento</dt>
            <dd data-testid="appointment-payments">
              {details.payments
                .map(
                  (p) =>
                    `${p.method ? PAYMENT_METHOD_LABELS[p.method as PaymentMethod] : ""} ${formatBRL(p.amountCents)}` +
                    (p.status === "pending" ? " (a confirmar)" : p.status === "reversed" ? " (estornado)" : ""),
                )
                .join(" + ")}
            </dd>
          </>
        )}
        {a.customerPhone && (
          <>
            <dt className="text-muted-foreground">WhatsApp</dt>
            <dd>{formatPhone(a.customerPhone)}</dd>
          </>
        )}
        {details?.notes && (
          <>
            <dt className="text-muted-foreground">Observação</dt>
            <dd>{details.notes}</dd>
          </>
        )}
      </dl>

      {canAdjust && details && mode === "view" && (
        <ItemsEditor details={details} appointmentId={a.id} services={ctx.services} onChanged={reload} />
      )}

      {mode === "view" && details && (
        <div className="flex flex-wrap gap-2">
          {status === "scheduled" && canAct && (
            <Button className="h-11" disabled={pending} onClick={() => run(() => startAppointment(a.id), "Atendimento iniciado")}>
              Iniciar
            </Button>
          )}
          {status === "in_progress" && canAct && (
            <Button className="h-11" disabled={pending} onClick={() => run(() => completeAppointment(a.id), "Atendimento concluído")}>
              Concluir
            </Button>
          )}
          {status === "paid" && ctx.isAdmin && !details.refundedAt && (
            <Button variant="ghost" className="h-11 text-destructive" onClick={() => setMode("refund")}>
              Estornar
            </Button>
          )}
          {status === "awaiting_payment" && ctx.canManage && (
            <Button className="h-11" onClick={() => setMode("pay")}>
              Receber
            </Button>
          )}
          {status === "in_progress" && ctx.canManage && (
            <Button variant="outline" className="h-11" onClick={() => setMode("revert")}>
              Desfazer início
            </Button>
          )}
          {status === "scheduled" && ctx.canManage && (
            <>
              <Button variant="outline" className="h-11" onClick={() => setMode("reschedule")}>
                Reagendar
              </Button>
              <Button variant="outline" className="h-11" onClick={() => setMode("no_show")}>
                Faltou
              </Button>
              <Button variant="ghost" className="h-11 text-destructive" onClick={() => setMode("cancel")}>
                Cancelar
              </Button>
            </>
          )}
          {status === "scheduled" && a.customerPhone && (
            <a
              href={whatsappReminderUrl({
                phone: a.customerPhone,
                customerName: a.customerName,
                salonName: ctx.salonName,
                startsAt: a.startsAt,
                timeZone: ctx.timeZone,
                professionalName: professional?.name ?? "",
                serviceNames: a.services,
              })}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), "h-11")}
            >
              <MessageCircle aria-hidden />
              Lembrar no WhatsApp
            </a>
          )}
        </div>
      )}

      {mode === "reschedule" && (
        <RescheduleForm appointment={a} ctx={ctx} onCancel={() => setMode("view")} onDone={onClose} />
      )}

      {mode === "pay" && details && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <PaymentForm appointment={{ id: a.id, customerName: a.customerName, totalCents: details.totalCents }} onDone={onClose} />
          <Button variant="outline" className="h-11" onClick={() => setMode("view")}>
            Voltar
          </Button>
        </div>
      )}

      {mode === "refund" && (
        <ConfirmBox
          message={`Estornar o atendimento de ${a.customerName}? Os valores recebidos saem do caixa aberto.`}
          withReason
          reasonRequired
          confirmLabel="Confirmar estorno"
          pending={pending}
          onBack={() => setMode("view")}
          onConfirm={(reason) => run(() => refundAppointment(a.id, reason), "Atendimento estornado")}
        />
      )}

      {mode === "revert" && (
        <ConfirmBox
          message={a.kind === "walk_in" ? `Devolver ${a.customerName} para a fila?` : `Voltar ${a.customerName} para agendado?`}
          withReason={false}
          confirmLabel="Desfazer início"
          pending={pending}
          onBack={() => setMode("view")}
          onConfirm={() => run(() => revertAppointmentStart(a.id), "Início desfeito")}
        />
      )}

      {(mode === "cancel" || mode === "no_show") && (
        <ConfirmBox
          message={mode === "cancel" ? `Cancelar o atendimento de ${a.customerName}?` : `Marcar que ${a.customerName} faltou?`}
          withReason={mode === "cancel"}
          confirmLabel={mode === "cancel" ? "Confirmar cancelamento" : "Confirmar falta"}
          pending={pending}
          onBack={() => setMode("view")}
          onConfirm={(reason) =>
            mode === "cancel"
              ? run(() => cancelAppointment(a.id, reason), "Atendimento cancelado")
              : run(() => markNoShow(a.id), "Falta registrada")
          }
        />
      )}

      <section aria-label="Histórico">
        <h3 className="mb-2 text-sm font-semibold">Histórico</h3>
        {!details ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Carregando histórico" />
        ) : (
          <ol className="flex flex-col gap-1 text-sm" data-testid="appointment-history">
            {details.events.map((e, i) => (
              <li key={i}>
                <span className="font-medium">{APPOINTMENT_EVENT_LABELS[e.event] ?? e.event}</span>{" "}
                <span className="text-muted-foreground">
                  {formatDateTime(e.at, ctx.timeZone)}
                  {e.actorName && ` · ${e.actorName}`}
                  {e.reason && ` · ${e.reason}`}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function ItemsEditor({
  details,
  appointmentId,
  services,
  onChanged,
}: {
  details: AppointmentDetails;
  appointmentId: string;
  services: SheetContext["services"];
  onChanged: () => void;
}) {
  const [serviceId, setServiceId] = useState("");
  const [pending, startTransition] = useTransition();
  const act = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setServiceId("");
        onChanged();
      } else {
        toast.error(result.error);
      }
    });

  return (
    <section aria-label="Serviços do atendimento" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Serviços</h3>
      <ul className="divide-y rounded-lg border" data-testid="appointment-items">
        {details.items.map((item) => (
          <li key={item.id} className="flex min-h-11 items-center gap-2 px-3">
            <span className="flex-1 truncate">{item.serviceName}</span>
            <span className="text-sm tabular-nums">{formatBRL(item.unitPriceCents * item.quantity)}</span>
            {details.items.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={`Remover ${item.serviceName}`}
                disabled={pending}
                onClick={() => act(() => removeAppointmentItem(item.id))}
              >
                <X aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <select
          aria-label="Serviço para adicionar"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className={cn(selectClass, "flex-1")}
        >
          <option value="">Adicionar serviço…</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {formatBRL(s.price_cents)}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          className="h-11"
          disabled={!serviceId || pending}
          onClick={() => act(() => addAppointmentItem(appointmentId, serviceId))}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
          Adicionar
        </Button>
      </div>
    </section>
  );
}

export function ConfirmBox({
  message,
  withReason,
  reasonRequired = false,
  confirmLabel,
  pending,
  onBack,
  onConfirm,
}: {
  message: string;
  withReason: boolean;
  reasonRequired?: boolean;
  confirmLabel: string;
  pending: boolean;
  onBack: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-3">
      <p className="text-sm">{message}</p>
      {withReason && (
        <Input
          aria-label={reasonRequired ? "Motivo" : "Motivo (opcional)"}
          placeholder={reasonRequired ? "Motivo" : "Motivo (opcional)"}
          value={reason}
          maxLength={200}
          onChange={(e) => setReason(e.target.value)}
          className="h-11 text-base"
        />
      )}
      <div className="flex gap-2">
        <Button
          variant="destructive"
          className="h-11"
          disabled={pending || (reasonRequired && !reason.trim())}
          onClick={() => onConfirm(reason)}
        >
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {confirmLabel}
        </Button>
        <Button variant="outline" className="h-11" onClick={onBack}>
          Voltar
        </Button>
      </div>
    </div>
  );
}

function RescheduleForm({
  appointment: a,
  ctx,
  onCancel,
  onDone,
}: {
  appointment: AgendaAppointment;
  ctx: SheetContext;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [professionalId, setProfessionalId] = useState(a.professionalId);
  const [date, setDate] = useState(formatDateTime(a.startsAt, ctx.timeZone).split(" ")[0].split("/").reverse().join("-"));
  const [time, setTime] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await rescheduleAppointment(a.id, professionalId, date, time);
      if (result.ok) {
        toast.success("Atendimento reagendado");
        onDone();
      } else {
        toast.error(result.error);
      }
    });

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Profissional
          <select
            value={professionalId}
            onChange={(e) => {
              setProfessionalId(e.target.value);
              setTime("");
            }}
            className={selectClass}
          >
            {ctx.professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nova data
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setTime("");
            }}
            className="h-11 text-base"
          />
        </label>
      </div>
      <SlotPicker
        professionalId={professionalId}
        date={date}
        durationMinutes={a.end - a.start}
        value={time}
        onChange={setTime}
        ignoreAppointmentId={a.id}
      />
      <div className="flex gap-2">
        <Button className="h-11" disabled={!time || pending} onClick={save}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Confirmar reagendamento
        </Button>
        <Button variant="outline" className="h-11" onClick={onCancel}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
