import { demoEnquiries } from "@/lib/db";
import type { Enquiry } from "./types";

/** Sample enquiries. They are built with the shared demo seed (`lib/demo-seed.ts`) so the patients and appointments they link to exist from the start. */
export const enquiries: Enquiry[] = demoEnquiries;
