"use client";

import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CartLine } from "@/components/pos/cart-line";
import type { RestaurantTable } from "@/hooks/use-tables";
import { formatCurrency } from "@/lib/format";
import { subtotalOf } from "@/lib/pricing-preview";

export type PosOrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";
export interface DeliveryDetails {
  address: string;
  pincode: string;
  phone: string;
}

export function CartPanel({
  lines,
  orderType,
  onOrderTypeChange,
  tables,
  tableId,
  onTableChange,
  onIncrement,
  onDecrement,
  onRemove,
  onSubmit,
  isSubmitting,
  existingOrderNumber,
  onViewExistingOrder,
  openBills,
  selectedBillId,
  onSelectBill,
  checkingTable = false,
  delivery,
  onDeliveryChange,
  scheduledFor,
  onScheduledForChange,
  activeTakeawayOrders,
  activeDeliveryOrders,
  onSelectActiveOrder,
  existingItems,
  existingTotal,
}: {
  lines: CartLine[];
  orderType: PosOrderType;
  onOrderTypeChange: (type: PosOrderType) => void;
  tables: RestaurantTable[];
  tableId: string;
  onTableChange: (id: string) => void;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
  onRemove: (key: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  existingOrderNumber?: string;
  onViewExistingOrder?: () => void;
  /** All unpaid bills on the selected table (more than one is possible). */
  openBills?: { id: string; orderNumber: string }[];
  selectedBillId?: string | null;
  onSelectBill?: (id: string) => void;
  /** The table's open bills are still loading - sending now could start a duplicate bill. */
  checkingTable?: boolean;
  delivery: DeliveryDetails;
  onDeliveryChange: (d: DeliveryDetails) => void;
  scheduledFor: string;
  onScheduledForChange: (v: string) => void;
  activeTakeawayOrders?: { id: string; orderNumber: string }[];
  activeDeliveryOrders?: { id: string; orderNumber: string }[];
  onSelectActiveOrder?: (id: string) => void;
  existingItems?: {
    id: string;
    nameSnapshot: string;
    quantity: number;
    unitPriceSnapshot: string;
    lineTotal: string;
    modifiers?: { nameSnapshot: string }[];
  }[];
  existingTotal?: number;
}) {
  const subtotal = subtotalOf(lines.map((l) => l.unitPrice * l.quantity));
  const deliveryReady =
    orderType !== "DELIVERY" ||
    (delivery.address.trim().length >= 5 && delivery.pincode.trim().length >= 3 && delivery.phone.trim().length >= 6);
  const canSubmit =
    lines.length > 0 && (orderType !== "DINE_IN" || !!tableId) && deliveryReady && !isSubmitting && !checkingTable;

  return (
    <div className="flex h-full flex-col gap-4">
      <Tabs value={orderType} onValueChange={(v) => onOrderTypeChange(v as PosOrderType)}>
        <TabsList className="w-full">
          <TabsTrigger value="DINE_IN" className="flex-1">
            Dine-in
          </TabsTrigger>
          <TabsTrigger value="TAKEAWAY" className="flex-1">
            Takeaway
          </TabsTrigger>
          <TabsTrigger value="DELIVERY" className="flex-1">
            Delivery
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {orderType === "DINE_IN" && (
        <Select value={tableId} onValueChange={(v) => onTableChange(v ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select table">
              {(value: string | null) => {
                const t = tables.find((table) => table.id === value);
                if (!t) return "Select table";
                return `${t.name ?? `Table ${t.number}`}${t.status === "OCCUPIED" ? " (occupied)" : ""}`;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tables.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name ?? `Table ${t.number}`} {t.status === "OCCUPIED" ? "(occupied)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {orderType === "DELIVERY" && (
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Delivery address"
            value={delivery.address}
            onChange={(e) => onDeliveryChange({ ...delivery, address: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Pincode"
              inputMode="numeric"
              value={delivery.pincode}
              onChange={(e) => onDeliveryChange({ ...delivery, pincode: e.target.value })}
            />
            <Input
              placeholder="Phone"
              inputMode="tel"
              value={delivery.phone}
              onChange={(e) => onDeliveryChange({ ...delivery, phone: e.target.value })}
            />
          </div>
        </div>
      )}

      {orderType !== "DINE_IN" && (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Schedule for later (optional)
          <Input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => onScheduledForChange(e.target.value)}
          />
        </label>
      )}

      {orderType === "TAKEAWAY" && activeTakeawayOrders && activeTakeawayOrders.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-secondary/60 p-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {activeTakeawayOrders.length} active takeaway {activeTakeawayOrders.length === 1 ? "order" : "orders"} in progress:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {activeTakeawayOrders.map((o) => (
              <Button
                key={o.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-background hover:bg-primary hover:text-primary-foreground"
                onClick={() => onSelectActiveOrder?.(o.id)}
              >
                #{o.orderNumber} · View & pay
              </Button>
            ))}
          </div>
        </div>
      )}

      {orderType === "DELIVERY" && activeDeliveryOrders && activeDeliveryOrders.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-secondary/60 p-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {activeDeliveryOrders.length} active delivery {activeDeliveryOrders.length === 1 ? "order" : "orders"} in progress:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {activeDeliveryOrders.map((o) => (
              <Button
                key={o.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-background hover:bg-primary hover:text-primary-foreground"
                onClick={() => onSelectActiveOrder?.(o.id)}
              >
                #{o.orderNumber} · View & pay
              </Button>
            ))}
          </div>
        </div>
      )}

      {checkingTable && (
        <p role="status" className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          Checking this table&apos;s open bills…
        </p>
      )}
      {openBills && openBills.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" role="group" aria-label="Open bills on this table">
          <span>{openBills.length} open bills here — add to:</span>
          {openBills.map((b) => (
            <Button
              key={b.id}
              type="button"
              size="sm"
              variant={b.id === selectedBillId ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              aria-pressed={b.id === selectedBillId}
              onClick={() => onSelectBill?.(b.id)}
            >
              #{b.orderNumber}
            </Button>
          ))}
        </div>
      )}
      {existingOrderNumber && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          <span>
            This table already has open order{" "}
            <span className="font-medium text-foreground">#{existingOrderNumber}</span>
            {lines.length > 0 && " — these items will be added to it as a new round."}
          </span>
          {onViewExistingOrder && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs"
              onClick={onViewExistingOrder}
            >
              View & pay
            </Button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3">
        {existingItems && existingItems.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border/80 bg-secondary/30 p-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground pb-1 border-b border-border/40">
              <span>Already ordered on this bill (#{existingOrderNumber})</span>
              <span className="tabular-nums">{formatCurrency(existingTotal ?? 0)}</span>
            </div>
            <div className="flex flex-col divide-y divide-border/40 max-h-48 overflow-y-auto pr-1">
              {existingItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="truncate pr-2">
                    <span className="font-semibold text-muted-foreground mr-1.5">{item.quantity}×</span>
                    <span className="font-medium text-foreground">{item.nameSnapshot}</span>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <span className="text-[11px] text-muted-foreground ml-1">
                        ({item.modifiers.map((m) => m.nameSnapshot).join(", ")})
                      </span>
                    )}
                  </span>
                  <span className="font-medium tabular-nums shrink-0">
                    {formatCurrency(Number(item.lineTotal || (Number(item.unitPriceSnapshot) * item.quantity)))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {lines.length === 0 ? (
          (!existingItems || existingItems.length === 0) ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground py-10">
              <ShoppingCart className="h-8 w-8 opacity-40" />
              <p className="text-sm">Cart is empty</p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Select items from menu above to add a new round to this table
            </div>
          )
        ) : (
          <div className="flex flex-col gap-2">
            {existingItems && existingItems.length > 0 && (
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-0.5">
                <span>Adding now (New items)</span>
                <span className="tabular-nums">+{formatCurrency(subtotal)}</span>
              </div>
            )}
            {lines.map((l) => (
              <div key={l.key} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{l.name}</span>
                  {l.modifierLabel && (
                    <span className="truncate text-xs text-muted-foreground">{l.modifierLabel}</span>
                  )}
                  <span className="text-xs font-semibold tabular-nums text-foreground">
                    {formatCurrency(l.unitPrice * l.quantity)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onDecrement(l.key)}
                    aria-label={`Decrease quantity of ${l.name}`}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-xs font-semibold tabular-nums text-foreground">
                    {l.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onIncrement(l.key)}
                    aria-label={`Increase quantity of ${l.name}`}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemove(l.key)}
                    aria-label={`Remove ${l.name} from cart`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        {existingTotal !== undefined && existingTotal > 0 ? (
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Already ordered</span>
              <span className="tabular-nums">{formatCurrency(existingTotal)}</span>
            </div>
            {subtotal > 0 && (
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                <span>Adding now</span>
                <span className="tabular-nums">+{formatCurrency(subtotal)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm font-bold text-foreground border-t border-border/60 pt-1.5 mt-0.5">
              <span>Total Bill</span>
              <span className="text-base tabular-nums text-primary">{formatCurrency(existingTotal + subtotal)}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal (incl. tax)</span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatCurrency(subtotal)}
            </span>
          </div>
        )}
        <Button className="h-11" disabled={!canSubmit} onClick={onSubmit}>
          {isSubmitting
            ? "Sending to kitchen…"
            : existingOrderNumber
              ? "Add to order & send to kitchen"
              : "Send to kitchen"}
        </Button>
      </div>
    </div>
  );
}
