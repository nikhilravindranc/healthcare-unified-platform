import { Suspense } from "react";
import { PublicBooking } from "@/modules/booking/public-booking";

export default function BookPage() {
  return <Suspense><PublicBooking /></Suspense>;
}
