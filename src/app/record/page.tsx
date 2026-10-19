import type { Metadata } from "next";
import RecordReceiver from "@/components/RecordReceiver";

export const metadata: Metadata = {
  title: "우리 가족 발명소 기록",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function RecordPage() { return <RecordReceiver />; }
