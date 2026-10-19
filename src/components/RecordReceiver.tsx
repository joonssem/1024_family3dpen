"use client";

import { useEffect, useState } from "react";
import { decodeRecord, type FamilyRecord } from "@/lib/family-record";
import RecordImage from "./RecordImage";

export default function RecordReceiver() {
  const [record, setRecord] = useState<FamilyRecord | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    function read() {
      try { setRecord(decodeRecord(window.location.hash)); setError(false); }
      catch { setRecord(null); setError(true); }
    }
    read(); window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return <main className="record-receiver">
    <p className="eyebrow accent">FAMILY INVENTION STUDIO / OUR MEMORY</p>
    <h1>우리 가족의<br />발명 이야기.</h1>
    {record ? <><p>함께 나눈 생각과 도전을 이미지로 간직하세요.</p><RecordImage record={record} /></>
      : error ? <p role="alert" className="notice">기록 링크가 없거나 손상되었어요. 수업 화면에서 QR을 다시 만들고 스마트폰으로 찍어 주세요.</p>
        : <p role="status">우리 가족의 기록을 열고 있어요…</p>}
    <p className="quiet-note">QR과 링크를 받은 사람은 이 기록을 볼 수 있어요. 사진·이름은 입력하거나 수집하지 않아요.</p>
  </main>;
}
