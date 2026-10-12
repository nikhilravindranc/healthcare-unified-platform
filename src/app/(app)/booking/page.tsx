"use client";
import { BookingAdmin } from "@/modules/booking/booking-admin";
import { MODULES } from "@/platform/modules";
import { RouteGuard } from "@/platform/route-guard";

const m = MODULES.find((x) => x.id === "booking")!;

/** Permission and module-switch checks happen here, so the direct URL follows the same rules as the menu. */
export default function BookingRoute() {
  return <RouteGuard title={m.label} perms={m.perms} module="booking"><BookingAdmin /></RouteGuard>;
}
