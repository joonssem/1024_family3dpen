"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { isLocalOnly, recordUrl, type FamilyRecord } from "@/lib/family-record";
import RecordImage from "./RecordImage";

export default function RecordShare({ record }: { record: FamilyRecord }) {
  const [snapshot, setSnapshot] = useState<FamilyRecord | null>(null);
  const [qr, setQr] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function prepare() {
    setBusy(true); setQr(""); setLink(""); setMessage(""); setSnapshot(record);
    try {
      if (isLocalOnly(window.location.hostname)) {
        setMessage("현재 주소는 이 기기에서만 열려요. 스마트폰 QR 전달은 배포 주소나 스마트폰에서도 열리는 학교 네트워크 주소에서 사용해 주세요. 이 기기에는 아래 이미지로 저장할 수 있어요.");
        return;
      }
      const url = recordUrl(record, window.location.origin);
      // 긴 기록도 내용 손실 없이 전달합니다. QR 용량 초과 시 이미지 저장을 제공합니다.
      const image = await QRCode.toDataURL(url, { errorCorrectionLevel: url.length < 1300 ? "M" : "L", width: 720, margin: 4 });
      setQr(image); setLink(url);
    } catch {
      setMessage("QR에 담기에는 기록이 너무 길거나 QR을 만들지 못했어요. 내용을 조금 줄여 다시 만들거나 아래 이미지를 이 기기에 저장해 전달해 주세요.");
    } finally { setBusy(false); }
  }

  return <section className="record-share" aria-label="우리 가족 기록 가져가기">
    <button className="primary-button" onClick={prepare} disabled={busy}>{busy ? "기록을 준비하고 있어요…" : snapshot ? "수정한 기록으로 QR 다시 만들기" : "우리 가족 기록 QR로 가져가기"}<span aria-hidden="true">↗</span></button>
    {snapshot && <div className="record-share-content">
      <h3>우리 가족의 오늘을 가져가세요.</h3>
      {qr && <div className="record-qr-layout">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="record-qr" src={qr} alt="보호자 스마트폰으로 활동 기록을 여는 QR코드" />
        <div><p><strong>1.</strong> 보호자 스마트폰 카메라로 QR을 비춰요.<br /><strong>2.</strong> 열린 화면에서 ‘기록 이미지 저장’을 눌러요.<br /><strong>3.</strong> 저장을 확인한 뒤 ‘새 가족으로 시작’을 눌러요.</p>
          <a className="secondary-button" href={link} target="_blank" rel="noreferrer">기록 저장 화면 열기</a>
          <p className="quiet-note">기록을 수정했다면 QR을 다시 만들어 주세요. QR과 링크를 받은 사람은 이 기록을 볼 수 있어요.</p></div>
      </div>}
      {message && <p className="notice" role="status">{message}</p>}
      <RecordImage record={snapshot} />
    </div>}
  </section>;
}
