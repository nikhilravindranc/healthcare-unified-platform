"use client";
import { ModuleSkeleton } from "@/platform/module-skeleton";

export default function CampaignsPage() {
  return <ModuleSkeleton id="campaigns" planned={["Audiences from Contact tags and consent", "Email and SMS campaigns", "Unsubscribe and consent enforcement", "Delivery and conversion reporting"]} />;
}
