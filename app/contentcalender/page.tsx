import { redirect } from "next/navigation";
import { hasContentAccess } from "@/lib/contentCalendar/access";
import { APP_PATH } from "@/lib/contentCalendar/paths";
import ContentCalendarApp from "./ContentCalendarApp";

export const dynamic = "force-dynamic";

export default async function ContentCalendarPage() {
  if (!(await hasContentAccess())) redirect(`${APP_PATH}/login`);
  return <ContentCalendarApp />;
}
