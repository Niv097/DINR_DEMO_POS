"use client";

import { useEffect, useState } from "react";
import { subscribeDisplay, type DisplayState } from "@/lib/customer-display";
import { formatCurrency } from "@/lib/format";
import { playPaymentReceived } from "@/lib/celebrate";
import { QRCodeSVG } from "qrcode.react";

/**
 * Open this on the customer-facing screen (or second monitor):
 * /customer-display. It shows the order being rung up on the POS in the
 * browser window next to it, previous rounds on the bill, then a thank-you once it is paid.
 */
export default function CustomerDisplayPage() {
  const [state, setState] = useState<DisplayState>({ kind: "idle" });
  useEffect(() => subscribeDisplay(setState), []);

  // Chime when the payment lands. Browsers only allow audio after a click on
  // the page, so the first tap on the display arms sound for the session.
  const [soundOn, setSoundOn] = useState(false);
  useEffect(() => {
    if (state.kind === "paid" && soundOn) playPaymentReceived(formatCurrency(state.total));
  }, [state, soundOn]);

  // After "paid", fall back to the welcome screen for the next guest after 10s.
  useEffect(() => {
    if (state.kind !== "paid") return;
    const t = setTimeout(() => setState({ kind: "idle" }), 10000);
    return () => clearTimeout(t);
  }, [state]);

  const hasPreviousLines = state.kind === "cart" && (state.previousLines?.length ?? 0) > 0;
  const hasCurrentLines = state.kind === "cart" && (state.lines?.length ?? 0) > 0;

  return (
    <main
      className="relative flex min-h-screen flex-col bg-background p-6 md:p-10 text-foreground selection:bg-none"
      onClick={() => setSoundOn(true)}
    >
      {!soundOn && (
        <p className="absolute right-4 top-4 rounded-full border border-border bg-card/60 backdrop-blur px-3 py-1 text-xs text-muted-foreground shadow-sm">
          Tap anywhere to enable sound
        </p>
      )}

      {state.kind === "idle" && (
        <div className="m-auto text-center animate-in fade-in duration-500">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-5xl md:text-6xl font-bold tracking-tight">Welcome</p>
          <p className="mt-4 text-xl md:text-2xl text-muted-foreground">Your order will appear here</p>
        </div>
      )}

      {state.kind === "cart" && (
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col animate-in fade-in duration-300">
          {/* Header with Table and Order */}
          <div className="mb-6 flex flex-wrap items-end justify-between border-b border-border pb-4 gap-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Customer Display
              </span>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                {state.tableName ?? "Your Order"}
              </h1>
            </div>
            <div className="text-right">
              {state.orderNumber && (
                <p className="text-sm font-semibold text-muted-foreground">
                  Order #{state.orderNumber}
                </p>
              )}
              {state.customerName && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Guest: <span className="font-medium text-foreground">{state.customerName}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            {/* Section 1: Previous Rounds / Already Ordered on this Bill */}
            {hasPreviousLines && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Already Ordered / In Kitchen
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {state.previousLines!.length} items
                  </span>
                </div>
                <ul className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 bg-secondary/20 p-3 sm:p-4">
                  {state.previousLines!.map((l, i) => (
                    <li key={`prev-${i}`} className="flex items-baseline justify-between gap-4 py-3 text-lg md:text-xl">
                      <span className="flex items-baseline gap-3">
                        <span className="font-semibold text-muted-foreground tabular-nums">{l.quantity}×</span>
                        <span className="font-medium">{l.name}</span>
                      </span>
                      <span className="tabular-nums font-semibold">{formatCurrency(l.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Section 2: Current Round / Adding to Bill */}
            {hasCurrentLines && (
              <div>
                {hasPreviousLines && (
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      New Round / Adding to Bill
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {state.lines.length} items
                    </span>
                  </div>
                )}
                <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card p-3 sm:p-4 shadow-xs">
                  {state.lines.map((l, i) => (
                    <li key={`curr-${i}`} className="flex items-baseline justify-between gap-4 py-3 text-xl md:text-2xl">
                      <span className="flex items-baseline gap-3">
                        <span className="font-semibold text-primary tabular-nums">{l.quantity}×</span>
                        <span className="font-semibold">{l.name}</span>
                      </span>
                      <span className="tabular-nums font-bold">{formatCurrency(l.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!hasPreviousLines && !hasCurrentLines && (
              <div className="py-16 text-center text-muted-foreground">
                <p className="text-lg">No items on this order yet</p>
              </div>
            )}
          </div>

          {/* Bill Totals Summary */}
          <div className="mt-6 border-t-2 border-foreground pt-4 space-y-2">
            {(state.tax !== undefined && state.tax > 0) || (state.discount !== undefined && state.discount > 0) ? (
              <div className="flex flex-col gap-1 text-sm md:text-base text-muted-foreground">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(state.subtotal)}</span>
                </div>
                {state.discount !== undefined && state.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Discount</span>
                    <span className="tabular-nums">-{formatCurrency(state.discount)}</span>
                  </div>
                )}
                {state.tax !== undefined && state.tax > 0 && (
                  <div className="flex justify-between">
                    <span>Taxes</span>
                    <span className="tabular-nums">+{formatCurrency(state.tax)}</span>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex items-baseline justify-between pt-2 text-4xl md:text-5xl font-extrabold tracking-tight">
              <span>Total Bill</span>
              <span className="tabular-nums text-primary">
                {formatCurrency(state.total ?? state.subtotal)}
              </span>
            </div>
          </div>
        </div>
      )}

      {state.kind === "upi" && (
        <div className="m-auto flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
          {state.tableName && (
            <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-foreground mb-2">
              {state.tableName}
            </span>
          )}
          {state.orderNumber && (
            <p className="text-xs text-muted-foreground font-mono">Order #{state.orderNumber}</p>
          )}
          <p className="mt-2 text-2xl md:text-3xl font-medium text-muted-foreground">Scan QR to pay</p>
          <p className="mt-1 text-6xl md:text-7xl font-extrabold tabular-nums tracking-tight text-foreground">
            {formatCurrency(state.total)}
          </p>
          <div className="mt-6 rounded-3xl bg-white p-6 shadow-2xl ring-4 ring-primary/20">
            <QRCodeSVG value={state.uri} size={300} level="M" marginSize={1} />
          </div>
          <p className="mt-6 text-lg text-muted-foreground">
            Pay {state.payee ? `to ${state.payee} ` : ""}with Google Pay, PhonePe, Paytm, or any UPI app
          </p>
        </div>
      )}

      {state.kind === "paid" && (
        <div className="m-auto text-center animate-in zoom-in-95 duration-400">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <svg className="h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-6xl md:text-7xl font-extrabold tracking-tight">Thank you!</p>
          <p className="mt-4 text-3xl md:text-4xl font-semibold text-muted-foreground tabular-nums">
            {formatCurrency(state.total)} paid {state.method ? `via ${state.method}` : ""}
          </p>
          {state.orderNumber && (
            <p className="mt-3 text-sm text-muted-foreground font-mono">
              Receipt #{state.orderNumber}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
