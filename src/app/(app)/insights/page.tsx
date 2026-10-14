import { redirect } from "next/navigation";

/** Insights is now Analytics (trends) and Reports (records). Old links keep working. */
export default function InsightsRedirect() { redirect("/analytics"); }
