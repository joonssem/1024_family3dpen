"use client";

import { useEffect, useState } from "react";
import type { FamilyRecord } from "@/lib/family-record";
import { createRecordImage } from "@/lib/record-image";

export default function RecordImage({ record }: { record: FamilyRecord }) {
  const [image, setImage] = useState<{ url: string; file: File } | null>(null);
  const [message, setMessage] = useState("");
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    let disposed = false, url = "";
    setImage(null); setMessage(""); setCanShare(false);
    createRecordImage(record).then(blob => {
      if (disposed) return;
      url = URL.createObjectURL(blob);
      const file = new File([blob], "우리-가족-발명소-기록.png", { type: "image/png" });
      setImage({ url, file });
      setCanShare(Boolean(navigator.canShare?.({ files: [file] })));
    }).catch(() => { if (!disposed) setMessage("이미지를 만들지 못했어요. 잠시 후 페이지를 다시 열어 주세요."); });
    return () => { disposed = true; if (url) URL.revokeObjectURL(url); };
  }, [record]);

  async function share() {
    if (!image) return;
    try { await navigator.share({ files: [image.file], title: "우리 가족 발명소 기록" }); }
    catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) setMessage("공유가 어려우면 이미지 저장 버튼이나 이미지를 길게 눌러 저장해 주세요.");
    }
  }

  return <div className="record-image-area">
    {!image && !message && <p role="status">우리 가족의 기록 이미지를 만들고 있어요…</p>}
    {image && <>
      <div className="button-row">
        <a className="primary-button" href={image.url} download="우리-가족-발명소-기록.png">기록 이미지 저장 <span aria-hidden="true">↓</span></a>
        {canShare && <button className="secondary-button" onClick={share}>이미지 공유 / 사진에 저장</button>}
      </div>
      <p className="quiet-note">저장한 이미지는 휴대폰의 다운로드에서 확인하세요. 사진 앱에 담으려면 이미지를 길게 누르거나 공유 메뉴의 ‘이미지 저장’을 선택해 주세요.</p>
      {/* PNG 미리보기는 브라우저에서 만든 URL이며 외부 이미지 최적화를 사용하지 않습니다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="record-image-preview" src={image.url} alt="불편, 첫 생각, 발명품, 조각과 조립 순서, 가족 소감이 담긴 활동 기록" />
    </>}
    {message && <p role="status" className="notice">{message}</p>}
  </div>;
}
