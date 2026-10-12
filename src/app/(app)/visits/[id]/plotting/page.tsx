import { redirect } from "next/navigation";

/** Injection plotting now lives inside the visit workspace. */
export default async function PlottingRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/visits/${id}?tab=plotting`);
}
