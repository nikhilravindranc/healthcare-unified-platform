import { redirect } from "next/navigation";

/** Front desk now lives in Today as the Patient flow view. */
export default function FrontDeskRedirect() {
  redirect("/overview?view=flow");
}
