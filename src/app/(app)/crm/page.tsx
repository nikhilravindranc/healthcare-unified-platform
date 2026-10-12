"use client";
import { CrmDirectory } from "@/modules/crm/crm-directory";
import { MODULES } from "@/platform/modules";
import { RouteGuard } from "@/platform/route-guard";

const crm = MODULES.find((m) => m.id === "crm")!;

/** Permission and module-switch checks happen here, so opening the URL directly follows the same rules as the menu. */
export default function CrmPage() {
  return <RouteGuard title={crm.label} perms={crm.perms} module="crm"><CrmDirectory /></RouteGuard>;
}
