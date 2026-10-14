"use client";
import { use } from "react";
import Link from "next/link";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { ContactDetailSheet } from "@/modules/crm/contact-detail";
import { useCrmContacts } from "@/modules/crm/hooks";
import { MODULES } from "@/platform/modules";
import { RouteGuard } from "@/platform/route-guard";

const crm = MODULES.find((m) => m.id === "crm")!;

/**
 * A contact page. The address holds the patient or enquiry record id, because a contact has no id of its own yet and the
 * directory's display keys must never be stored or bookmarked. A role that cannot see those ids cannot match a record here.
 */
export default function ContactPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  return <RouteGuard title={crm.label} perms={crm.perms} module="crm"><Detail {...use(params)} /></RouteGuard>;
}

function Detail({ kind, id }: { kind: string; id: string }) {
  const { contacts, loading, access } = useCrmContacts();
  if (loading) return <Skeleton className="h-96 w-full" />;
  const c = contacts.find((x) => (kind === "patient" ? x.kind === "patient" && x.patientId === id : kind === "enquiry" && x.kind === "enquiry-only" && x.enquiries[0]?.id === id));
  if (!c) return <EmptyState title="Contact not found" text="It may not exist, or your role may not include this record." action={<Link href="/crm"><Button variant="secondary">Back to contacts</Button></Link>} />;
  return <ContactDetailSheet page contact={c} access={access} onClose={() => {}} />;
}
