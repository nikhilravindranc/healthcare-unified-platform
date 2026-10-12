"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ManageBooking } from "@/modules/booking/manage-booking";

function Inner() {
  const ref = useSearchParams().get("ref") ?? "";
  return <ManageBooking initialReference={ref} />;
}
export default function ManagePage() {
  return <Suspense><Inner /></Suspense>;
}
