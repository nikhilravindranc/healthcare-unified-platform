"use client";
import { CampaignsPage } from "@/modules/campaigns/campaigns-page";
import { MODULES } from "@/platform/modules";
import { RouteGuard } from "@/platform/route-guard";

const m = MODULES.find((x) => x.id === "campaigns")!;

/** Permission and module-switch checks happen here, so the direct URL follows the same rules as the menu. */
export default function CampaignsRoute() {
  return <RouteGuard title={m.label} perms={m.perms} module="campaigns"><CampaignsPage /></RouteGuard>;
}
