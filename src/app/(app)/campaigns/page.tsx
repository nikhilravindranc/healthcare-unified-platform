"use client";
import { ModuleSkeleton } from "@/platform/module-skeleton";

export default function CampaignsPage() {
  return <ModuleSkeleton id="campaigns" notice="No campaigns can be created or sent yet and no email or SMS provider is connected. To see how enquiries are generated, open Marketing Insights (demo data)." planned={["Audiences from Contact tags and consent", "Email and SMS campaigns", "Unsubscribe and consent enforcement", "Delivery and conversion reporting"]} />;
}
