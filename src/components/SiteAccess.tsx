"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import styles from "./SiteAccess.module.css";

export default function SiteAccess() {
  const [qr, setQr] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL("https://project-c9pas.vercel.app/", { width: 600, margin: 4, errorCorrectionLevel: "M" })
      .then(value => { if (active) setQr(value); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return <section className={styles.access} aria-label="가족 화면 접속 안내">
    <div><strong>가족 화면에 접속해요</strong><p>아이패드 카메라로 QR을 찍거나 아래 주소를 열어요.</p><a href="https://project-c9pas.vercel.app/">project-c9pas.vercel.app</a></div>
    <button className="primary-button" onClick={() => dialog.current?.showModal()}>접속 QR 크게 보기 ↗</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="site-access-title">
      <h2 id="site-access-title">아이패드로 QR을 찍어 주세요</h2>
      {qr ? <img src={qr} width="600" height="600" alt="가족 발명소 웹사이트 접속 QR 코드" /> : <p>QR을 준비하고 있어요. 아래 주소로도 접속할 수 있어요.</p>}
      <p>project-c9pas.vercel.app</p><button className="secondary-button" autoFocus onClick={() => dialog.current?.close()}>닫기</button>
    </dialog>
  </section>;
}
