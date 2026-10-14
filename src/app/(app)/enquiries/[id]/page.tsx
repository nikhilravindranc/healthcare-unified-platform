"use client";
import { Suspense, use, useState } from "react";
import Link from "next/link";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { RouteGuard } from "@/platform/route-guard";
import { useEnquiries } from "@/modules/enquiries/hooks";
import { EnquiryFormSheet } from "@/modules/enquiries/enquiry-form";
import { EnquiryDetailSheet } from "@/modules/enquiries/enquiry-detail";
import type { Enquiry } from "@/modules/enquiries/types";

export default function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  return <RouteGuard title="Enquiries" perms={["enquiries", "enquiries_view"]}><Suspense><Detail id={use(params).id} /></Suspense></RouteGuard>;
}

function Detail({ id }: { id: string }) {
  const { data, isLoading } = useEnquiries();
  const [form, setForm] = useState<{ open: boolean; enquiry?: Enquiry }>({ open: false });
  const e = data?.find((x) => x.id === id);
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!e) return <EmptyState title="Enquiry not found" text="It may have been removed, or your role may not include it." action={<Link href="/enquiries"><Button variant="secondary">Back to enquiries</Button></Link>} />;
  return (
    <>
      <EnquiryDetailSheet page enquiry={e} onClose={() => {}} onEdit={(x) => setForm({ open: true, enquiry: x })} />
      <EnquiryFormSheet open={form.open} enquiry={form.enquiry} onClose={() => setForm({ open: false })} />
    </>
  );
}
