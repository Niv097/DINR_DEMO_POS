"use client";

import type { KotStatusDto } from "@nodedr-restaurant/types";
import { Check, ChefHat, RefreshCw, UtensilsCrossed } from "lucide-react";
import { useKdsProgress, useUpdateKotStatus } from "@/hooks/use-kds";
import { useNoteToast } from "@/components/ui/status-note";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COLUMNS: { status: KotStatusDto; label: string; dotClass: string }[] = [
  { status: "NEW", label: "New", dotClass: "bg-primary" },
  { status: "ACCEPTED", label: "Accepted", dotClass: "bg-warning" },
  { status: "PREPARING", label: "Preparing", dotClass: "bg-warning" },
  { status: "READY", label: "Ready to serve", dotClass: "bg-success" },
];

export function KitchenProgressWidget({ branchId }: { branchId: string | null }) {
  const { data: tickets, isError, refetch, isFetching } = useKdsProgress(branchId);
  const updateKotStatus = useUpdateKotStatus(branchId);
  const { toast } = useNoteToast();

  if (isError && !tickets) {
    return (
      <div role="status" className="flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
        <ChefHat className="h-3.5 w-3.5" aria-hidden />
        Kitchen progress is unavailable right now.
        <button
          type="button"
          className="inline-flex min-h-8 items-center gap-1 font-medium text-primary hover:underline disabled:opacity-60"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} aria-hidden />
          Retry
        </button>
      </div>
    );
  }
  if (!tickets) return null;

  const countOf = (status: KotStatusDto) => tickets.filter((t) => t.status === status).length;
  const active = tickets.filter((t) => t.status !== "SERVED");
  const readyTickets = tickets.filter((t) => t.status === "READY");
  if (active.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs">
        <span className="flex shrink-0 items-center gap-1.5 font-medium text-muted-foreground">
          <ChefHat className="h-3.5 w-3.5" />
          Kitchen
        </span>
        <div className="flex flex-wrap items-center gap-3">
          {COLUMNS.map((col) => {
            const count = countOf(col.status);
            if (count === 0) return null;
            return (
              <span key={col.status} className="flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", col.dotClass)} />
                <span className="text-muted-foreground">{col.label}</span>
                <span className="font-semibold tabular-nums text-foreground">{count}</span>
              </span>
            );
          })}
        </div>
      </div>

      {readyTickets.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs">
          <div className="flex items-center justify-between font-semibold text-emerald-800 dark:text-emerald-400">
            <span className="flex items-center gap-1.5">
              <UtensilsCrossed className="h-4 w-4" />
              {readyTickets.length} {readyTickets.length === 1 ? "order" : "orders"} ready to pickup & serve:
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {readyTickets.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-lg bg-background/90 px-3 py-1.5 shadow-sm border border-emerald-500/20"
              >
                <div className="flex flex-col">
                  <span className="font-bold text-foreground">
                    {t.order.table ? `Table ${t.order.table.name ?? t.order.table.number}` : t.order.type.replace("_", " ")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">#{t.order.orderNumber}</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={updateKotStatus.isPending}
                  onClick={() =>
                    updateKotStatus.mutate(
                      { id: t.id, status: "SERVED" },
                      {
                        onSuccess: () => {
                          const name = t.order.table
                            ? `Table ${t.order.table.name ?? t.order.table.number}`
                            : `Order #${t.order.orderNumber}`;
                          toast.success(`${name} marked as served!`);
                        },
                      },
                    )
                  }
                >
                  <Check className="mr-1 h-3.5 w-3.5" /> Mark Served
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
