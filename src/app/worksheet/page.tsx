import styles from "./worksheet.module.css";

export default function WorksheetPage() {
  return <main className={styles.sheet}>
    <header className={styles.header}>
      <div><p className={styles.kicker}>FAMILY INVENTION STUDIO · IDEA SHEET</p><h1>우리 가족 발명 설계 활동지</h1><p>불편한 점을 찾고, 함께 생각한 아이디어를 실제로 만들 수 있게 그려 봐요.</p><small>인쇄하려면 브라우저 메뉴에서 인쇄를 선택해 주세요.</small></div>
      <div className={styles.names}><span>가족 이름</span><i /></div>
    </header>
    <section className={styles.problem}><h2><b>01</b> 무엇이 불편한가요?</h2><p>어디에서, 무엇을 할 때 불편한지 한 문장으로 적어 봐요.</p><div className={styles.writeLine} /></section>
    <section className={styles.ideas}><h2><b>02</b> 어떤 발명을 해 볼까요?</h2><p>서로의 생각을 듣고 아이디어를 간단히 적어요.</p><div className={styles.ideaLines}><div><span>아이디어 1</span><i /></div><div><span>아이디어 2</span><i /></div><div><span>아이디어 3</span><i /></div></div></section>
    <section className={styles.sketch}><div><h2><b>03</b> 발명품을 크게 그려요</h2><p>손바닥 크기로 그리고, 각 부분이 어떻게 붙는지 표시해요.</p></div><div className={styles.canvas}><span>그림을 그리는 곳</span></div></section>
    <section className={styles.parts}><h2><b>04</b> 만들 조각을 세 개 이내로 나눠요</h2><table><thead><tr><th>조각 이름</th><th>모양과 크기</th><th>누가 만들까요?</th></tr></thead><tbody>{[1, 2, 3].map(n => <tr key={n}><td>{n}.</td><td /><td /></tr>)}</tbody></table></section>
    <section className={styles.try}><h2><b>05</b> 어떻게 붙이고 확인할까요?</h2><div><span>조립 순서</span><i /></div><div><span>잘 작동하는지 이렇게 확인해요</span><i /></div></section>
    <footer className={styles.footer}><div><strong>안전하게 만들어요</strong><span>준비한 장갑을 사용해요 · 뜨거운 부분은 잡지 않아요 · 막히면 손을 들어 선생님께 요청해요</span></div><a href="/" target="_blank" rel="noreferrer">가족 발명소 웹앱 열기 ↗</a></footer>
  </main>;
}
