"use client";
import { ModuleSkeleton } from "@/platform/module-skeleton";

export default function BookingPage() {
  return <ModuleSkeleton id="booking" planned={["Public booking page per location", "Availability from Practice providers, services and rooms", "Booking requests create or match a Contact", "Confirmations and reminders"]} />;
}
