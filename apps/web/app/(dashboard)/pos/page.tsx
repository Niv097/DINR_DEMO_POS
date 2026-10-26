"use client";

import { ChevronLeft, MonitorSmartphone, Receipt, ShoppingCart } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { StatusNote, useNoteToast } from "@/components/ui/status-note";
import { listenDisplaySync, publishDisplay, type DisplayLine, type DisplayState } from "@/lib/customer-display";
import { BranchNotice } from "@/components/layout/branch-notice";
import { CartPanel, type DeliveryDetails, type PosOrderType } from "@/components/pos/cart-panel";
import { cartLineKey, portionText, type CartLine, type Portion } from "@/components/pos/cart-line";
import { clearDraft, switchTableDraft, type Drafts } from "@/lib/pos-drafts";
import { CheckoutPanel } from "@/components/pos/checkout-panel";
import { KitchenProgressWidget } from "@/components/pos/kitchen-progress-widget";
import { TableRequestsBar } from "@/components/tables/table-requests-bar";
import { ModifierPickerDialog } from "@/components/pos/modifier-picker-dialog";
import { PosTablePicker } from "@/components/pos/pos-table-picker";
import { ProductGrid } from "@/components/pos/product-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { hasPermission, useCurrentUser } from "@/hooks/use-auth";
import { useBranch } from "@/hooks/use-branch";
import type { MenuItem } from "@/hooks/use-menu";
import {
  useAddOrderItems,
  useCreateOrder,
  useOpenOrders,
  useOpenOrdersForTable,
  useOrder,
  type CreatedOrder,
  type OpenOrder,
} from "@/hooks/use-orders";
import { useCreateRequest, useFloors, useTableRequests, type RestaurantTable } from "@/hooks/use-tables";
import { ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function PosPage() {
  return (
    <Suspense fallback={null}>
      <PosPageInner />
    </Suspense>
  );
}

function PosPageInner() {
  const { branchId, isLoading: branchLoading } = useBranch();
  const { data: me } = useCurrentUser();
  const canAcceptPayment = hasPermission(me?.user, "sales.view");
  const { note, clear: clearNote, toast } = useNoteToast();
  const floorsQuery = useFloors(branchId);
  const floors = floorsQuery.data;
  const tables = floors?.flatMap((f) => f.tables) ?? [];
  const { data: tableRequests = [] } = useTableRequests(branchId);
  const createRequest = useCreateRequest(branchId);
  const searchParams = useSearchParams();
  const preselectedTableId = searchParams.get("tableId") ?? "";
  const preselectedOrderId = searchParams.get("orderId") ?? "";

  const syncUrl = (nextTableId?: string | null, nextOrderId?: string | null) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (nextTableId) url.searchParams.set("tableId", nextTableId);
    else url.searchParams.delete("tableId");
    if (nextOrderId) url.searchParams.set("orderId", nextOrderId);
    else url.searchParams.delete("orderId");
    window.history.replaceState(null, "", url.toString());
  };

  const [lines, setLines] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<PosOrderType>("DINE_IN");
  const [delivery, setDelivery] = useState<DeliveryDetails>({ address: "", pincode: "", phone: "" });
  const [scheduledFor, setScheduledFor] = useState("");
  const [tableId, setTableIdRaw] = useState(preselectedTableId);
  // Unsent cart per table, so switching tables never moves or loses items.
  const [drafts, setDrafts] = useState<Drafts<CartLine>>({});
  const setTableId = (next: string) => {
    if (next === tableId) return;
    const r = switchTableDraft(drafts, tableId, next, lines);
    setDrafts(r.drafts);
    setLines(r.lines);
    setSelectedBillId(null);
    setTableIdRaw(next);
    syncUrl(next, activeOrder?.id);
  };
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [pickerItem, setPickerItem] = useState<MenuItem | null>(null);
  const [activeOrder, setActiveOrder] = useState<CreatedOrder | null>(null);
  const [activeCustomer, setActiveCustomer] = useState<OpenOrder["customer"]>(null);

  // Restore preselected order if provided via URL (?orderId=...)
  const preselectedOrderQuery = useOrder(branchId, preselectedOrderId || null);
  useEffect(() => {
    if (preselectedOrderQuery.data && !activeOrder) {
      const o = preselectedOrderQuery.data;
      setActiveOrder(o);
      setActiveCustomer(o.customer);
      if (o.tableId) {
        setTableIdRaw(o.tableId);
      }
      if (o.type === "TAKEAWAY" || o.type === "DELIVERY" || o.type === "DINE_IN") {
        setOrderType(o.type as PosOrderType);
      }
    }
  }, [preselectedOrderQuery.data, activeOrder]);

  // /pos?tableId=... can change while this page stays mounted.
  const [seenPreselected, setSeenPreselected] = useState(preselectedTableId);
  if (preselectedTableId !== seenPreselected) {
    setSeenPreselected(preselectedTableId);
    if (preselectedTableId && !activeOrder) setTableId(preselectedTableId);
  }
  // Phones show the menu full-screen and the cart/checkout as an overlay; from
  // lg up both sit side by side and this flag is ignored.
  const [cartOpen, setCartOpen] = useState(false);

  const createOrder = useCreateOrder(branchId);
  const addOrderItems = useAddOrderItems(branchId);
  const openBillsQuery = useOpenOrdersForTable(
    branchId,
    orderType === "DINE_IN" ? tableId || null : null,
  );
  const existingOrders = openBillsQuery.data;
  // A table can carry several open bills; the user picks which one gets the
  // new items (default: the newest). Until the table's bills are loaded we do
  // not know whether this is a new bill or a new round, so submitting waits.
  const checkingTable =
    orderType === "DINE_IN" && !!tableId && (openBillsQuery.isPending || openBillsQuery.isFetching);
  const existingOrder =
    existingOrders?.find((o) => o.id === selectedBillId) ?? existingOrders?.[0];

  // Fetch full details of existing order so customer display & cart show the customer's previous round(s)
  const existingOrderDetailQuery = useOrder(branchId, existingOrder?.id ?? null);
  const activeOrderDetailQuery = useOrder(branchId, activeOrder?.id ?? null);

  const computeDisplayState = useCallback((): DisplayState => {
    if (activeOrder) {
      const activeItems = activeOrderDetailQuery.data?.items ?? [];
      const curTable = tables.find((t) => t.id === (activeOrderDetailQuery.data?.tableId ?? tableId));
      const tableName = curTable
        ? (curTable.name ?? `Table ${curTable.number}`)
        : (orderType === "DINE_IN" ? "" : orderType.replace("_", " "));

      return {
        kind: "cart",
        orderNumber: activeOrder.orderNumber,
        tableName,
        customerName: (activeCustomer?.name ?? activeOrderDetailQuery.data?.customer?.name) || undefined,
        lines: activeItems.map((item) => ({
          name: item.modifiers && item.modifiers.length > 0
            ? `${item.nameSnapshot} (${item.modifiers.map((m) => m.nameSnapshot).join(", ")})`
            : item.nameSnapshot,
          quantity: item.quantity,
          total: Number(item.lineTotal || (Number(item.unitPriceSnapshot) * item.quantity)),
        })),
        subtotal: Number(activeOrder.subtotal),
        tax: Number(activeOrder.taxAmount),
        discount: Number(activeOrder.discountAmount),
        total: Number(activeOrder.totalAmount),
      };
    }

    const prevItems = existingOrderDetailQuery.data?.items ?? [];
    const prevLines: DisplayLine[] = prevItems.map((item) => ({
      name: item.modifiers && item.modifiers.length > 0
        ? `${item.nameSnapshot} (${item.modifiers.map((m) => m.nameSnapshot).join(", ")})`
        : item.nameSnapshot,
      quantity: item.quantity,
      total: Number(item.lineTotal || (Number(item.unitPriceSnapshot) * item.quantity)),
      status: "Ordered",
    }));

    const currLines: DisplayLine[] = lines.map((l) => ({
      name: l.modifierLabel ? `${l.name} (${l.modifierLabel})` : l.name,
      quantity: l.quantity,
      total: l.unitPrice * l.quantity,
      status: existingOrder ? "Adding to bill" : undefined,
    }));

    if (prevLines.length === 0 && currLines.length === 0) {
      return { kind: "idle" };
    }

    const curTable = tables.find((t) => t.id === tableId);
    const tableName = curTable
      ? (curTable.name ?? `Table ${curTable.number}`)
      : (orderType === "DINE_IN" ? "" : orderType.replace("_", " "));

    const prevSubtotal = Number(existingOrderDetailQuery.data?.subtotal ?? existingOrder?.subtotal ?? 0);
    const prevTotal = Number(existingOrderDetailQuery.data?.totalAmount ?? existingOrder?.totalAmount ?? 0);
    const currentSubtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

    return {
      kind: "cart",
      orderNumber: existingOrder?.orderNumber,
      tableName,
      customerName: (existingOrder?.customer?.name ?? activeCustomer?.name) || undefined,
      previousLines: prevLines.length > 0 ? prevLines : undefined,
      lines: currLines,
      subtotal: prevSubtotal + currentSubtotal,
      total: prevTotal + currentSubtotal,
    };
  }, [
    activeOrder,
    activeOrderDetailQuery.data,
    existingOrder,
    existingOrderDetailQuery.data,
    lines,
    tableId,
    tables,
    orderType,
    activeCustomer,
  ]);

  // Mirror all rounds (both before order & current round) to customer display
  useEffect(() => {
    publishDisplay(computeDisplayState());
  }, [computeDisplayState]);

  // Reply to any customer display window that opens and requests synchronization
  useEffect(() => {
    return listenDisplaySync(computeDisplayState);
  }, [computeDisplayState]);

  const openOrdersQuery = useOpenOrders(branchId);
  const allOpenOrders = openOrdersQuery.data ?? [];
  const activeTakeawayOrders = allOpenOrders
    .filter((o) => o.type === "TAKEAWAY" && o.status !== "PAID" && o.status !== "CANCELLED")
    .map((o) => ({ id: o.id, orderNumber: o.orderNumber }));
  const activeDeliveryOrders = allOpenOrders
    .filter((o) => o.type === "DELIVERY" && o.status !== "PAID" && o.status !== "CANCELLED")
    .map((o) => ({ id: o.id, orderNumber: o.orderNumber }));

  const handleSelectActiveOrder = (orderId: string) => {
    const found = allOpenOrders.find((o) => o.id === orderId);
    if (found) {
      setActiveCustomer(found.customer);
      setActiveOrder(found);
      setCartOpen(true);
      syncUrl(found.tableId, found.id);
      if (found.type === "TAKEAWAY" || found.type === "DELIVERY" || found.type === "DINE_IN") {
        setOrderType(found.type as PosOrderType);
      }
    }
  };

  const addLine = (
    menuItemId: string,
    name: string,
    unitPrice: number,
    modifierIds: string[],
    modifierLabel: string,
    portion?: Portion,
  ) => {
    const key = cartLineKey(menuItemId, modifierIds, portion);
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { key, menuItemId, name, unitPrice, quantity: 1, modifierIds, modifierLabel, portion }];
    });
  };

  const handleSelect = (item: MenuItem) => {
    if (item.modifierGroups.length > 0 || item.halfPrice != null) {
      setPickerItem(item);
      return;
    }
    addLine(item.id, item.name, Number(item.price), [], "");
  };

  const handleModifierConfirm = (modifierIds: string[], modifierLabel: string, portion?: Portion) => {
    if (!pickerItem) return;
    const modifierTotal = modifierIds.reduce((sum, id) => {
      const mod = pickerItem.modifierGroups
        .flatMap((g) => g.modifierGroup.modifiers)
        .find((m) => m.id === id);
      return sum + (mod ? Number(mod.priceAdjustment) : 0);
    }, 0);
    const base =
      portion?.customPrice ??
      (portion?.kind === "HALF" ? Number(pickerItem.halfPrice) : Number(pickerItem.price));
    addLine(
      pickerItem.id,
      portion ? `${pickerItem.name} (${portionText(portion)})` : pickerItem.name,
      base + modifierTotal,
      modifierIds,
      modifierLabel,
      portion,
    );
  };

  const updateQuantity = (key: string, delta: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  };

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const handleSubmit = () => {
    if (checkingTable) return;
    const sentTableId = tableId;
    const items = lines.map((l) => ({
      menuItemId: l.menuItemId,
      quantity: l.quantity,
      modifierIds: l.modifierIds,
      ...(l.portion
        ? {
            portion: l.portion.kind,
            customPrice: l.portion.customPrice,
            ...(l.portion.kind === "CUSTOM" ? { customLabel: l.portion.customLabel } : {}),
          }
        : {}),
    }));

    if (existingOrder) {
      addOrderItems.mutate(
        { orderId: existingOrder.id, dto: { items } },
        {
          onSuccess: (order) => {
            setDrafts((d) => clearDraft(d, sentTableId));
            setActiveCustomer(existingOrder.customer);
            setActiveOrder(order);
            syncUrl(sentTableId, order.id);
            toast.success(`Added to order #${order.orderNumber} — sent to kitchen`);
          },
          onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not add items"),
        },
      );
      return;
    }

    createOrder.mutate(
      {
        type: orderType,
        tableId: orderType === "DINE_IN" ? tableId : undefined,
        ...(orderType === "DELIVERY" ? { delivery } : {}),
        ...(orderType !== "DINE_IN" && scheduledFor
          ? { scheduledFor: new Date(scheduledFor).toISOString() }
          : {}),
        items,
      },
      {
        onSuccess: (order) => {
          setDrafts((d) => clearDraft(d, sentTableId));
          setActiveCustomer(null);
          setActiveOrder(order);
          setCartOpen(true);
          syncUrl(orderType === "DINE_IN" ? sentTableId : null, order.id);
          toast.success(`Order #${order.orderNumber} sent to kitchen`);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not create order"),
      },
    );
  };

  const viewExistingOrder = () => {
    if (existingOrder) {
      setActiveCustomer(existingOrder.customer);
      setActiveOrder(existingOrder);
      setCartOpen(true);
      syncUrl(tableId, existingOrder.id);
    }
  };

  const handleBackFromCheckout = () => {
    setActiveOrder(null);
    syncUrl(tableId, null);
  };

  const resetForNewOrder = () => {
    setActiveOrder(null);
    setCartOpen(false);
    // The sent cart is gone; other tables' unsent drafts stay.
    setLines([]);
    setSelectedBillId(null);
    setTableIdRaw("");
    setActiveCustomer(null);
    setDelivery({ address: "", pincode: "", phone: "" });
    setScheduledFor("");
    syncUrl(null, null);
  };

  const handleTablePick = (table: RestaurantTable) => setTableId(table.id);

  // Click-to-order: for a fresh dine-in ticket, land on a visual table grid
  // first — the rest of the flow (menu, cart, bill-or-add-more) is
  // unchanged once a table's picked. Takeaway orders and orders already
  // mid-flow (tableId set, or viewing/paying an order) skip straight past
  // it, same as arriving here from the Tables page's own "New order" link
  // (?tableId=... pre-fills this and never shows the picker).
  const showTablePicker = orderType === "DINE_IN" && !tableId && !activeOrder;

  return (
    <div className="flex h-[calc(100dvh-10rem)] flex-col gap-4 lg:h-[calc(100dvh-8rem)]">
      <StatusNote note={note} onClear={clearNote} />
      <TableRequestsBar branchId={branchId} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <KitchenProgressWidget branchId={branchId} />
        </div>
        <a
          href="/customer-display"
          target="_blank"
          rel="noreferrer"
          onClick={() => publishDisplay(computeDisplayState())}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title="Opens the customer-facing screen in a new window — drag it to the second monitor"
        >
          <MonitorSmartphone className="h-3.5 w-3.5" />
          Customer display
        </a>
      </div>

      <BranchNotice />

      {showTablePicker ? (
        <Card className="flex-1 overflow-hidden p-5">
          <PosTablePicker
            floors={floors ?? []}
            onSelect={handleTablePick}
            isLoading={floorsQuery.isLoading || branchLoading}
            error={floorsQuery.isError ? floorsQuery.error : null}
            onRetry={() => void floorsQuery.refetch()}
            retrying={floorsQuery.isFetching}
          />
        </Card>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-[1fr_360px]">
          <Card className="min-h-0 overflow-hidden p-3 sm:p-5">
            <ProductGrid branchId={branchId} onSelect={handleSelect} />
          </Card>

          <Card
            className={cn(
              "min-h-0 overflow-hidden p-5",
              cartOpen
                ? "max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:rounded-none max-lg:p-4 max-lg:pt-[max(1rem,env(safe-area-inset-top))] max-lg:pb-[max(1rem,env(safe-area-inset-bottom))]"
                : "max-lg:hidden",
            )}
          >
            <button
              type="button"
              onClick={() => setCartOpen(false)}
              className="mb-3 -ml-1 flex items-center gap-1 text-sm font-medium text-muted-foreground lg:hidden"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to menu
            </button>
            {activeOrder ? (
              canAcceptPayment ? (
                <CheckoutPanel
                  order={activeOrder}
                  branchId={branchId}
                  initialCustomer={activeCustomer}
                  onDone={resetForNewOrder}
                  onBack={handleBackFromCheckout}
                />
              ) : (
                <div className="flex h-full flex-col gap-4 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="-ml-2 text-muted-foreground"
                      onClick={handleBackFromCheckout}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" /> Back to menu
                    </Button>
                    <Badge variant="secondary" className="font-normal text-xs">
                      Order in kitchen
                    </Badge>
                  </div>

                  <div className="rounded-xl border border-border bg-secondary/20 p-4">
                    <p className="text-lg font-bold text-foreground">
                      {tableId
                        ? `Table ${tables.find((t) => t.id === tableId)?.name ?? tables.find((t) => t.id === tableId)?.number ?? ""}`
                        : orderType.replace("_", " ")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Order #{activeOrder.orderNumber} · sent to kitchen
                    </p>
                    <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
                      <span className="text-xs text-muted-foreground font-medium">Bill Total:</span>
                      <span className="text-xl font-bold tabular-nums text-foreground">
                        {formatCurrency(activeOrder.totalAmount)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    Payment collection is handled by Cashier / Owner.
                  </p>

                  <div className="flex flex-col gap-2 mt-auto">
                    {tableId && (
                      <Button
                        type="button"
                        className={cn(
                          "h-11 w-full text-sm font-semibold shadow-sm",
                          tableRequests.some((r) => r.table.id === tableId && r.type === "BILL")
                            ? "bg-amber-600/80 hover:bg-amber-600 text-white cursor-default"
                            : "bg-amber-600 hover:bg-amber-700 text-white",
                        )}
                        disabled={
                          tableRequests.some((r) => r.table.id === tableId && r.type === "BILL") ||
                          createRequest.isPending
                        }
                        onClick={() => {
                          createRequest.mutate(
                            { tableId, type: "BILL" },
                            {
                              onSuccess: () => {
                                toast.success("Bill requested from Cashier / Owner");
                              },
                            },
                          );
                        }}
                      >
                        <Receipt className="mr-2 h-4 w-4" />
                        {tableRequests.some((r) => r.table.id === tableId && r.type === "BILL")
                          ? "Bill requested from Cashier"
                          : "Request Bill from Cashier"}
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 w-full"
                      onClick={handleBackFromCheckout}
                    >
                      Add items / round
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={resetForNewOrder}
                    >
                      New order
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <CartPanel
                lines={lines}
                orderType={orderType}
                onOrderTypeChange={setOrderType}
                tables={tables}
                tableId={tableId}
                onTableChange={setTableId}
                onIncrement={(key) => updateQuantity(key, 1)}
                onDecrement={(key) => updateQuantity(key, -1)}
                onRemove={removeLine}
                onSubmit={handleSubmit}
                isSubmitting={createOrder.isPending || addOrderItems.isPending}
                existingOrderNumber={existingOrder?.orderNumber}
                existingItems={existingOrderDetailQuery.data?.items}
                existingTotal={Number(existingOrderDetailQuery.data?.totalAmount ?? existingOrder?.totalAmount ?? 0)}
                onViewExistingOrder={existingOrder ? viewExistingOrder : undefined}
                openBills={existingOrders?.map((o) => ({ id: o.id, orderNumber: o.orderNumber }))}
                selectedBillId={existingOrder?.id ?? null}
                onSelectBill={setSelectedBillId}
                checkingTable={checkingTable}
                delivery={delivery}
                onDeliveryChange={setDelivery}
                scheduledFor={scheduledFor}
                onScheduledForChange={setScheduledFor}
                activeTakeawayOrders={activeTakeawayOrders}
                activeDeliveryOrders={activeDeliveryOrders}
                onSelectActiveOrder={handleSelectActiveOrder}
              />
            )}
          </Card>
        </div>
      )}

      {!showTablePicker && !cartOpen && (lines.length > 0 || activeOrder || existingOrder) && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex h-14 items-center justify-between rounded-2xl bg-primary px-4 text-primary-foreground shadow-lg active:scale-[0.98] lg:hidden"
          style={{ backgroundImage: "var(--gradient-primary)" }}
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart className="h-5 w-5" />
            {activeOrder
              ? `Order #${activeOrder.orderNumber} — pay`
              : lines.length > 0
                ? `View cart · ${lines.reduce((n, l) => n + l.quantity, 0)} items`
                : `Open bill #${existingOrder?.orderNumber} — view`}
          </span>
          {!activeOrder && lines.length > 0 && (
            <span className="text-sm font-semibold tabular-nums">
              {formatCurrency(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0))}
            </span>
          )}
        </button>
      )}

      <ModifierPickerDialog
        item={pickerItem}
        open={!!pickerItem}
        onOpenChange={(open) => !open && setPickerItem(null)}
        onConfirm={handleModifierConfirm}
        allowCustom
      />
    </div>
  );
}
