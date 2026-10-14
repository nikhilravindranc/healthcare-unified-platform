"use client";
import { Suspense, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, EmptyState, PageTitle } from "@/components/ui";
import { Denied } from "@/components/patient/shared";
import { RouteGuard } from "@/platform/route-guard";
import { useRole } from "@/lib/hooks";
import { bySlug } from "@/components/insights/catalogue";
import { FilterBar, InsightsNav, useInsightFilters } from "@/components/insights/shell";
import { AppointmentsView, CapacityView, ClinicView, ContinuityView, FinancialView, MarketingView, PatientsView, ServicesView } from "@/components/insights/views";

export default function InsightPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params); const def = bySlug(slug);
  return <RouteGuard title={def?.title ?? "Analytics"} perms={def?.perms ?? ["reports", "insights"]}><Suspense><Detail slug={slug} /></Suspense></RouteGuard>;
}

function Detail({ slug }: { slug: string }) {
  const def = bySlug(slug); const f = useInsightFilters(); const { can } = useRole();
  const sp = useSearchParams(); const query = sp.toString() ? `?${sp}` : "";
  if (!def) return <EmptyState title="Insight not found" text="It may have moved." action={<Link href="/analytics"><Button variant="secondary">Back to Analytics</Button></Link>} />;
  if (def.needs && !can(def.needs)) return <Denied what={def.title.toLowerCase()} />;
  const show = { location: !["marketing", "financial"].includes(slug), provider: ["appointments", "clinic", "capacity"].includes(slug), service: ["appointments", "services"].includes(slug) };
  const body = def.state === "unavailable" ? <EmptyState title={`${def.title} is not available yet`} text={def.unavailableWhy} /> : (
    slug === "clinic" ? <ClinicView f={f} /> : slug === "appointments" ? <AppointmentsView f={f} /> : slug === "patients" ? <PatientsView f={f} /> : slug === "marketing" ? <MarketingView f={f} />
    : slug === "services" ? <ServicesView f={f} /> : slug === "capacity" ? <CapacityView f={f} /> : slug === "financial" ? <FinancialView f={f} /> : slug === "continuity" ? <ContinuityView f={f} /> : null);
  return (
    <>
      <PageTitle crumbs={[{ label: "Analytics", href: "/analytics" }, { label: def.title }]} title={def.title} description={def.question} />
      <InsightsNav active={def.category} query={query} />
      <FilterBar f={f} show={show} ranges={slug === "marketing" || slug === "financial" ? ["7", "30", "90"] : undefined} />
      {body}
    </>
  );
}
