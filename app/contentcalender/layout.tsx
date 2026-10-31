import type { Metadata } from "next";
import "./contentCalendar.css";

export const metadata: Metadata = {
  title: "Content Calendar · SequenceFlow",
  robots: { index: false, follow: false },
};

export default function ContentCalendarLayout({ children }: { children: React.ReactNode }) {
  return <div className="cc-root">{children}</div>;
}
