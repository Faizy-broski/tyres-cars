"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";
import EditCustomerModal from "./EditCustomerModal";
import CreateAddressModal from "./CreateAddressModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  Address,
  CustomerListItem,
} from "@/types/admin.types";
import type {
  CustomerOrder,
  OrderStats,
} from "@/app/admin/customers/[customerId]/page";
import {
  BACKEND_API_URL,
  createBackendHeaders,
  readBackendError,
} from "@/lib/backend-api";
import { toastSuccess, toastError } from "@/lib/toast";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMoney(n: number) {
  return `$${n.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function AccountBadge({ isGuest }: { isGuest: boolean }) {
  return (
    <Badge
      className={`inline-flex h-auto items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        isGuest
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-green-200 bg-green-50 text-green-700"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isGuest ? "bg-amber-500" : "bg-green-500"}`}
      />
      {isGuest ? "Guest" : "Registered"}
    </Badge>
  );
}

function PaymentDot({ status }: { status: string }) {
  const colMap: Record<string, string> = {
    paid: "bg-green-500",
    unpaid: "bg-amber-500",
    partially_paid: "bg-blue-500",
    refunded: "bg-zinc-400",
  };

  return (
    <span className="inline-flex items-center gap-1.5 text-xs capitalize text-zinc-600">
      <span className={`h-2 w-2 rounded-full ${colMap[status] ?? colMap.unpaid}`} />
      {(status ?? "unpaid").replace(/_/g, " ")}
    </span>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    fulfilled: "border-green-200 bg-green-50 text-green-700",
    processing: "border-amber-200 bg-amber-50 text-amber-700",
    paid: "border-blue-200 bg-blue-50 text-blue-700",
    pending: "border-zinc-200 bg-zinc-100 text-zinc-600",
    cancelled: "border-red-200 bg-red-50 text-red-700",
    refunded: "border-zinc-200 bg-zinc-100 text-zinc-600",
  };

  return (
    <Badge
      className={`h-auto whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${map[status] ?? map.pending}`}
    >
      {(status ?? "pending").replace(/_/g, " ")}
    </Badge>
  );
}

function DeliveryTypeCell() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-700">
      <Truck className="h-3.5 w-3.5 text-zinc-400" />
      Home Delivery
    </span>
  );
}

type Props = {
  accessToken: string;
  customer: CustomerListItem;
  orders: CustomerOrder[];
  orderStats: OrderStats;
  addresses: Address[];
  primaryAddress: Address | null;
  onRefresh?: () => void;
};

export default function CustomerDetailClient({
  accessToken,
  customer,
  orders,
  orderStats,
  addresses,
  primaryAddress,
  onRefresh,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const modalParam = searchParams.get('modal');

  function closeModal() { router.replace(pathname) }

  const [addressPendingId, setAddressPendingId] = useState<string | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<string | null>(null);
  const [fulfilFilter, setFulfilFilter] = useState<string | null>(null);

  const fullName =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "—";
  const isGuest = !customer.profile_id;

  const filteredOrders = orders.filter((order) => {
    if (paymentFilter && order.payment_status !== paymentFilter) return false;
    if (fulfilFilter && order.order_status !== fulfilFilter) return false;
    return true;
  });

  const addressDisplay = primaryAddress
    ? [
        primaryAddress.address_line_1 ?? primaryAddress.address_line1,
        primaryAddress.address_line_2 ?? primaryAddress.address_line2,
        primaryAddress.suburb         ?? primaryAddress.city,
        primaryAddress.state,
        primaryAddress.postcode       ?? primaryAddress.postal_code,
        primaryAddress.country,
      ]
        .filter(Boolean)
        .join(", ")
    : "—";

  async function handleDeleteAddress(addressId: string) {
    setAddressPendingId(addressId);
    try {
      const res = await fetch(
        `${BACKEND_API_URL}/api/admin/customers/${customer.customer_id}/addresses/${addressId}`,
        {
          method: "DELETE",
          headers: createBackendHeaders(accessToken),
        },
      );
      if (!res.ok) {
        throw new Error(await readBackendError(res, "Failed to delete address"));
      }
      toastSuccess("Address deleted");
      onRefresh?.();
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "Failed to delete address");
    } finally {
      setAddressPendingId(null);
    }
  }

  return (
    <>
      {modalParam === 'add-address' && (
        <CreateAddressModal
          accessToken={accessToken}
          customerId={customer.customer_id}
          onClose={closeModal}
          onSuccess={() => { closeModal(); onRefresh?.() }}
        />
      )}

      {modalParam === 'edit' && (
        <EditCustomerModal
          accessToken={accessToken}
          customer={customer}
          onClose={closeModal}
          onSuccess={() => { closeModal(); onRefresh?.() }}
        />
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-primary">{fullName}</h1>
          <AccountBadge isGuest={isGuest} />
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`${pathname}?modal=add-address`)}
            className="flex items-center gap-2 rounded-lg border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Plus className="h-4 w-4" />
            Add Address
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`${pathname}?modal=edit`)}
            className="flex items-center gap-2 rounded-lg border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Pencil className="h-4 w-4" />
            Edit Profile
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-5">
          <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
            <div className="grid grid-cols-1 divide-y divide-zinc-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="px-5 py-4">
                <p className="mb-1 text-xs text-zinc-400">Customer ID</p>
                <p className="font-mono text-sm font-medium text-zinc-800">
                  {customer.customer_id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="mb-1 text-xs text-zinc-400">Email</p>
                <p className="truncate text-sm text-zinc-800">{customer.email}</p>
              </div>
              <div className="px-5 py-4">
                <p className="mb-1 text-xs text-zinc-400">Full Name</p>
                <p className="text-sm text-zinc-800">{fullName}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 divide-y divide-zinc-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="px-5 py-4">
                <p className="mb-1 text-xs text-zinc-400">Member Since</p>
                <p className="text-sm text-zinc-800">{fmtDate(customer.created_at)}</p>
              </div>
              <div className="px-5 py-4">
                <p className="mb-1 text-xs text-zinc-400">Phone</p>
                <p className="text-sm text-zinc-800">{customer.phone || "—"}</p>
              </div>
              <div className="px-5 py-4">
                <p className="mb-1 text-xs text-zinc-400">Auth Status</p>
                <AccountBadge isGuest={isGuest} />
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="mb-1 text-xs text-zinc-400">Primary Address</p>
              <p className="text-sm text-zinc-800">{addressDisplay}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Orders</h2>
              <div className="flex flex-wrap items-center gap-2">
                {(["unpaid", "paid", "partially_paid", "refunded"] as const).map(
                  (status) => (
                    <Button
                      key={status}
                      type="button"
                      onClick={() =>
                        setPaymentFilter(paymentFilter === status ? null : status)
                      }
                      className={`inline-flex h-auto items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                        paymentFilter === status
                          ? " bg-primary text-black"
                          : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500"
                      }`}
                    >
                      + {status}
                    </Button>
                  ),
                )}
                <div className="mx-1 h-4 w-px bg-zinc-200" />
                {(["pending", "processing", "fulfilled"] as const).map((status) => (
                  <Button
                    key={status}
                    type="button"
                    onClick={() =>
                      setFulfilFilter(fulfilFilter === status ? null : status)
                    }
                    className={`inline-flex h-auto items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                      fulfilFilter === status
                        ? " bg-primary text-black"
                        : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500"
                    }`}
                  >
                    + {status}
                  </Button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader>
                  <TableRow className="border-b border-zinc-200 bg-zinc-50 hover:bg-zinc-50 odd:bg-zinc-50 even:bg-zinc-50">
                    {[
                      "Order #",
                      "Delivery Type",
                      "Created ↓",
                      "Payment",
                      "Fulfillment",
                      "Items",
                      "Type",
                      "Order Total",
                    ].map((heading) => (
                      <TableHead key={heading}>
                        {heading}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-zinc-200">
                  {filteredOrders.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={8}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No orders found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => (
                      <TableRow key={order.order_id}>
                        <TableCell>
                          <Link
                            href={`/admin/orders/${order.order_id}`}
                            className="whitespace-nowrap font-medium text-primary hover:underline"
                          >
                            {order.order_number}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <DeliveryTypeCell />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {fmtDateTime(order.created_at)}
                        </TableCell>
                        <TableCell>
                          <PaymentDot status={order.payment_status} />
                        </TableCell>
                        <TableCell>
                          <OrderStatusBadge status={order.order_status} />
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {order.item_count}
                        </TableCell>
                        <TableCell className="text-xs capitalize text-muted-foreground">
                          {order.payment_method?.replace(/_/g, " ") ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium text-foreground">
                          {fmtMoney(order.total_amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-5 py-3 text-xs text-muted-foreground">
              <span>
                Showing {filteredOrders.length} of {orders.length} orders
              </span>
              <span>Page 1 of 1</span>
            </div>
          </div>

        </div>

        <div className="w-full flex-shrink-0 space-y-4 lg:w-64">
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-zinc-900">Orders</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Total Value</span>
                <span className="text-sm font-semibold text-zinc-900">
                  {fmtMoney(orderStats.totalValue)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Orders</span>
                <span className="text-sm font-semibold text-zinc-900">
                  {orderStats.count}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Avg. Order Value</span>
                <span className="text-sm font-semibold text-zinc-900">
                  {fmtMoney(orderStats.avgOrderValue)}
                </span>
              </div>
              {orderStats.lastOrderDate && (
                <div className="border-t border-zinc-100 pt-2">
                  <p className="text-xs text-zinc-400">Last Order</p>
                  <p className="mt-0.5 text-xs text-zinc-600">
                    {fmtDate(orderStats.lastOrderDate)}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-900">
                Addresses
                {addresses.length > 0 && (
                  <span className="ml-1.5 font-normal text-zinc-400">
                    ({addresses.length})
                  </span>
                )}
              </h3>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`${pathname}?modal=add-address`)}
                className="h-auto rounded-lg border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                Add
              </Button>
            </div>

            {addresses.length === 0 ? (
              <p className="py-2 text-center text-xs text-zinc-400">
                No addresses on file.
              </p>
            ) : (
              <div className="space-y-2">
                {addresses.map((address) => (
                  <div
                    key={address.address_id}
                    className="rounded-lg border border-zinc-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-medium text-zinc-700">
                        {address.address_name}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteAddress(address.address_id)}
                        disabled={addressPendingId === address.address_id}
                        aria-label={`Delete ${address.address_name} address`}
                        className="text-zinc-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {[
                        address.address_line_1 ?? address.address_line1,
                        address.suburb         ?? address.city,
                        address.state,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

