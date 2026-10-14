import { redirect } from "next/navigation";

export default async function InsightRedirect({ params }: { params: Promise<{ slug: string }> }) { redirect(`/analytics/${(await params).slug}`); }
