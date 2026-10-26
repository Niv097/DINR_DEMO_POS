"use client";

import { useEffect, useState } from "react";
import {
  BellRing,
  CheckCircle2,
  ChefHat,
  CreditCard,
  Printer,
  QrCode,
  Receipt,
  Search,
} from "lucide-react";
import { useBranch } from "@/hooks/use-branch";
import { useOpenOrders, type OpenOrder } from "@/hooks/use-orders";
import { useKdsProgress } from "@/hooks/use-kds";
import { useTableRequests, useResolveRequest } from "@/hooks/use-tables";
import { useSettings } from "@/hooks/use-settings";
import { CheckoutPanel } from "@/components/pos/checkout-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { openReceiptPrint } from "@/lib/print";
import { buildUpiUri } from "@/lib/upi";
import { publishDisplay } from "@/lib/customer-display";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";

type FilterType = "all" | "bill_requested" | "DINE_IN" | "TAKEAWAY" | "DELIVERY";

export default function PendingPaymentsPage() {
  const { branchId } = useBranch();
  const { data: openOrders = [], isLoading: ordersLoading } = useOpenOrders(branchId);
  const { data: kitchenTickets = [] } = useKdsProgress(branchId);
  const { data: tableRequests = [] } = useTableRequests(branchId);
  const resolveRequest = useResolveRequest(branchId);
  const { data: settings } = useSettings(branchId);

  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OpenOrder | null>(null);
  const [qrOrder, setQrOrder] = useState<OpenOrder | null>(null);

  // Unpaid orders awaiting settlement
  const pendingOrders = openOrders.filter(
    (o) => o.status !== "PAID" && o.status !== "CANCELLED",
  );

  // Map open bill requests by tableId
  const billRequestsByTable = new Map(
    tableRequests
      .filter((r) => r.type === "BILL")
      .map((r) => [r.table.id, r]),
  );

  // Map latest kitchen status by orderId
  const kitchenStatusByOrder = new Map(
    kitchenTickets.map((t) => [t.orderId, t.status]),
  );

  // Filtered orders
  const filtered = pendingOrders.filter((order) => {
    const matchesFilter =
      filter === "all"
        ? true
        : filter === "bill_requested"
          ? order.tableId ? billRequestsByTable.has(order.tableId) : false
          : order.type === filter;

    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      order.orderNumber.toLowerCase().includes(query) ||
      (order.customer?.name && order.customer.name.toLowerCase().includes(query));

    return matchesFilter && matchesSearch;
  });

  // Calculate totals
  const totalDue = pendingOrders.reduce(
    (sum, o) => sum + (Number(o.totalAmount) || 0),
    0,
  );
  const billRequestsCount = tableRequests.filter((r) => r.type === "BILL").length;

  const upiId = settings?.restaurant?.upiVpa?.trim() ?? "";
  const upiName = settings?.restaurant?.upiPayeeName?.trim() || settings?.restaurant?.name?.trim() || "Restaurant";

  // Broadcast UPI QR to customer display when opening the modal
  useEffect(() => {
    if (qrOrder && upiId) {
      const uri = buildUpiUri({
        vpa: upiId,
        name: upiName,
        amount: Number(qrOrder.totalAmount),
        note: `Order #${qrOrder.orderNumber}`,
      });
      publishDisplay({
        kind: "upi",
        total: Number(qrOrder.totalAmount),
        uri,
        payee: upiName,
        orderNumber: qrOrder.orderNumber,
        tableName: qrOrder.tableId ? `Table ${qrOrder.tableId}` : undefined,
      });
    }
  }, [qrOrder, upiId, upiName]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Pending Payments
          </h1>
          <p className="text-sm text-muted-foreground">
            Active orders awaiting payment. Settle bills via Cash, Card, or UPI QR code.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex flex-col gap-1 p-5 border-l-4 border-l-primary">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Unpaid Orders
          </span>
          <span className="text-3xl font-bold tabular-nums text-foreground">
            {pendingOrders.length}
          </span>
          <span className="text-xs text-muted-foreground">Ready for settlement</span>
        </Card>

        <Card className="flex flex-col gap-1 p-5 border-l-4 border-l-emerald-500">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Total Outstanding
          </span>
          <span className="text-3xl font-bold tabular-nums text-foreground">
            {formatCurrency(totalDue)}
          </span>
          <span className="text-xs text-muted-foreground">Pending collection</span>
        </Card>

        <Card
          className={cn(
            "flex flex-col gap-1 p-5 border-l-4",
            billRequestsCount > 0
              ? "border-l-amber-500 bg-amber-500/5 animate-pulse"
              : "border-l-muted",
          )}
        >
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <BellRing className="h-3.5 w-3.5 text-amber-500" /> Bill Requests
          </span>
          <span className="text-3xl font-bold tabular-nums text-foreground">
            {billRequestsCount}
          </span>
          <span className="text-xs text-muted-foreground">
            {billRequestsCount === 1 ? "Table asking for bill" : "Tables asking for bill"}
          </span>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All ({pendingOrders.length})
          </Button>
          {billRequestsCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant={filter === "bill_requested" ? "default" : "outline"}
              className={cn(
                filter !== "bill_requested" && "border-amber-500/40 text-amber-600 bg-amber-500/10",
              )}
              onClick={() => setFilter("bill_requested")}
            >
              <BellRing className="mr-1.5 h-3.5 w-3.5" />
              Bill Requests ({billRequestsCount})
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={filter === "DINE_IN" ? "default" : "outline"}
            onClick={() => setFilter("DINE_IN")}
          >
            Dine-in
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filter === "TAKEAWAY" ? "default" : "outline"}
            onClick={() => setFilter("TAKEAWAY")}
          >
            Takeaway
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filter === "DELIVERY" ? "default" : "outline"}
            onClick={() => setFilter("DELIVERY")}
          >
            Delivery
          </Button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search order # or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Orders List */}
      {ordersLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-24 animate-pulse bg-secondary/30" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3 opacity-80" />
          <p className="text-base font-semibold text-foreground">All payments collected!</p>
          <p className="text-sm">There are no pending payments matching this filter.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((order) => {
            const hasBillRequest = order.tableId
              ? billRequestsByTable.get(order.tableId)
              : null;
            const kStatus = kitchenStatusByOrder.get(order.id);

            return (
              <Card
                key={order.id}
                className={cn(
                  "flex flex-col justify-between gap-4 p-5 transition-all hover:shadow-md",
                  hasBillRequest && "border-amber-500/80 bg-amber-500/[0.03] ring-1 ring-amber-500/40",
                )}
              >
                <div className="flex flex-col gap-2.5">
                  {/* Top Bar: Table / Type & Status Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-bold text-foreground">
                        {order.tableId ? "Dine-in Table" : order.type.replace("_", " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Order #{order.orderNumber}
                        {order.customer?.name && ` · ${order.customer.name}`}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {hasBillRequest && (
                        <Badge className="bg-amber-500 text-white font-medium text-[11px] animate-pulse">
                          <BellRing className="mr-1 h-3 w-3" /> Bill Requested
                        </Badge>
                      )}
                      {kStatus && (
                        <Badge variant="secondary" className="text-[11px] font-normal">
                          <ChefHat className="mr-1 h-3 w-3 text-muted-foreground" />
                          {kStatus === "SERVED"
                            ? "Food Served"
                            : kStatus === "READY"
                              ? "Ready to serve"
                              : "In Kitchen"}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Amount Due Display */}
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground font-medium">Total Due:</span>
                      <span className="text-xl font-bold tabular-nums text-foreground">
                        {formatCurrency(order.totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    className="h-10 w-full text-sm font-semibold shadow-sm"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <CreditCard className="mr-2 h-4 w-4" /> Collect Payment
                  </Button>

                  <div className="flex items-center gap-2">
                    {upiId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => setQrOrder(order)}
                        title="Show dynamic UPI QR Code on screen"
                      >
                        <QrCode className="mr-1.5 h-3.5 w-3.5 text-primary" /> UPI QR
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => branchId && openReceiptPrint(order.id, branchId)}
                      title="Print guest check"
                    >
                      <Printer className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" /> Print Bill
                    </Button>
                    {hasBillRequest && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        disabled={resolveRequest.isPending}
                        onClick={() => resolveRequest.mutate(hasBillRequest.id)}
                        title="Dismiss bill request"
                      >
                        Dismiss
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Checkout Modal */}
      {selectedOrder && (
        <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Pay Order #{selectedOrder.orderNumber}</DialogTitle>
            </DialogHeader>
            <CheckoutPanel
              order={selectedOrder}
              branchId={branchId}
              initialCustomer={selectedOrder.customer}
              onDone={() => setSelectedOrder(null)}
              onBack={() => setSelectedOrder(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Dynamic UPI QR Code Modal */}
      {qrOrder && (
        <Dialog open={!!qrOrder} onOpenChange={(open) => !open && setQrOrder(null)}>
          <DialogContent className="max-w-xs text-center flex flex-col items-center">
            <DialogHeader>
              <DialogTitle className="text-lg">Scan to Pay</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground -mt-2">
              Order #{qrOrder.orderNumber}
            </p>
            <div className="my-3 rounded-2xl bg-white p-4 shadow-sm">
              <QRCodeSVG
                value={buildUpiUri({
                  vpa: upiId,
                  name: upiName,
                  amount: Number(qrOrder.totalAmount),
                  note: `Order #${qrOrder.orderNumber}`,
                })}
                size={200}
                marginSize={1}
              />
            </div>
            <div className="flex flex-col gap-1 text-center">
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {formatCurrency(qrOrder.totalAmount)}
              </span>
              <span className="text-xs text-muted-foreground font-mono">{upiId}</span>
            </div>
            <Button
              type="button"
              className="w-full mt-3"
              onClick={() => {
                const target = qrOrder;
                setQrOrder(null);
                setSelectedOrder(target);
              }}
            >
              Confirm Payment Received
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
