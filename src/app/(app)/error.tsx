"use client";
import Link from "next/link";
import { Button, EmptyState } from "@/components/ui";

/** Catches a screen that fails to render, so the sidebar and the rest of the app stay usable. */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="py-10">
      <EmptyState title="This screen could not be shown" text="Changes you had not saved on this screen may be lost. Try again, or go back to Today."
        action={<div className="flex gap-2"><Button onClick={() => reset()}>Try again</Button><Link href="/overview"><Button variant="secondary">Go to Today</Button></Link></div>} />
    </div>
  );
}
