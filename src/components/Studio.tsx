"use client";

import { useEffect, useRef, useState } from "react";
import { camp } from "@/lib/camp";
import { fallbackIdeas, ideasSchema, type Idea } from "@/lib/ideas";

type Part = { name: string; shape: string; owner: string; done: boolean };
const blankParts = (): Part[] => Array.from({ length: 3 }, () => ({ name: "", shape: "", owner: "함께", done: false }));
const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

function Geometry({ small = false }: { small?: boolean }) {
  return <svg className={small ? "geometry small" : "geometry"} viewBox="0 0 440 390" aria-hidden="true">
    <defs><pattern id="grid" width="44" height="39" patternUnits="userSpaceOnUse"><path d="M44 0H0V39" fill="none" stroke="currentColor" strokeWidth=".6" opacity=".15" /></pattern></defs>
    <rect width="440" height="390" fill="url(#grid)" />
    <path d="M44 273h132v78H44z" fill="#ed4a2c" />
    <path d="M44 273l66-39 132 0-66 39z" fill="#f27b60" />
    <path d="M176 273l66-39v78l-66 39z" fill="#b52e1a" />
    <circle cx="286" cy="117" r="78" fill="#1d302b" />
    <circle cx="270" cy="106" r="17" fill="#f5f3ec" />
    <path d="M242 351l66-117 88 117z" fill="#d8d79b" />
    <path d="M44 156L110 39l66 117z" fill="none" stroke="#1d302b" strokeWidth="2" />
    <path d="M110 156v78m66-78l66 78m66-39v39" fill="none" stroke="#1d302b" strokeWidth="1.5" strokeDasharray="4 5" />
    <path d="M22 20h18m-9-9v18M402 371h18m-9-9v18" stroke="#ed4a2c" strokeWidth="1.5" />
    <text x="44" y="380" fontSize="10" fontFamily="Pretendard, sans-serif" fill="#1d302b">IDEA → SHAPE → MEMORY</text>
  </svg>;
}

export default function Studio() {
  const [step, setStep] = useState(0);
  const [teacher, setTeacher] = useState(false);
  const [problem, setProblem] = useState("");
  const [firstIdea, setFirstIdea] = useState("");
  const [invention, setInvention] = useState("");
  const [change, setChange] = useState("");
  const [question, setQuestion] = useState(0);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [source, setSource] = useState("");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [safety, setSafety] = useState<boolean[]>(Array(6).fill(false));
  const [parts, setParts] = useState<Part[]>(blankParts);
  const [assembly, setAssembly] = useState("");
  const [childMemory, setChildMemory] = useState("");
  const [parentMemory, setParentMemory] = useState("");
  const [cleanup, setCleanup] = useState<boolean[]>(Array(3).fill(false));
  const [seconds, setSeconds] = useState(camp.steps[0].minutes * 60);
  const [running, setRunning] = useState(false);
  const [buildPhase, setBuildPhase] = useState(0);
  const [showSchedule, setShowSchedule] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const requestNumber = useRef(0);
  const allSafe = safety.every(Boolean);
  const current = camp.steps[step];

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setSeconds(value => {
      if (value <= 1) { setRunning(false); return 0; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  useEffect(() => {
    if (!cooldown) return;
    const id = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);
  useEffect(() => () => requestRef.current?.abort(), []);

  function go(index: number) {
    if (index < 0 || index >= camp.steps.length) return;
    if ((index === 4 || index === 5) && !allSafe && !teacher) {
      setNotice("펜을 쓰기 전에 보호자와 안전 약속 6가지를 확인해 주세요.");
      index = 3;
    } else { setNotice(""); }
    setStep(index); setRunning(false); setSeconds(camp.steps[index].minutes * 60); setBuildPhase(0);
    window.setTimeout(() => { titleRef.current?.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); }, 0);
  }

  async function ask(mode = "initial") {
    if (busy || cooldown) return;
    if (!problem.trim()) { setNotice("먼저 함께 발견한 불편을 한 가지 적어 주세요."); return; }
    setNotice(""); setBusy(true); setCooldown(10);
    const number = ++requestNumber.current;
    const controller = new AbortController(); requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/ideas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem: problem.trim(), mode, previous: ideas }), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error("unavailable");
      const parsed = ideasSchema.parse(data);
      if (number !== requestNumber.current) return;
      const preparedMessages: Record<string, string> = {
        limited: "AI 요청이 많아 준비된 예비 힌트를 보여드려요. 함께 이야기하며 바꿔 봐요.",
        expired: "오늘의 AI 이용 시간이 끝났어요. 준비된 힌트로 계속할 수 있어요.",
        unavailable: "AI 연결이 어려워 준비된 예비 힌트를 보여드려요.",
      };
      setIdeas(parsed.ideas); setSource(data.source === "ai" ? "AI가 제안한 힌트예요. 만들 수 있을지 함께 살펴봐요." : preparedMessages[data.reason] || "준비해 둔 예비 힌트예요. 우리 불편에 맞게 바꿔 봐요.");
    } catch {
      if (number !== requestNumber.current) return;
      setIdeas(fallbackIdeas(problem, mode, ideas.map(idea => idea.name))); setSource("AI 연결이 어려워 준비된 예비 힌트를 보여드려요.");
    } finally {
      window.clearTimeout(timeout);
      if (number === requestNumber.current) setBusy(false);
    }
  }

  function prepared() {
    ++requestNumber.current; requestRef.current?.abort(); setBusy(false);
    setIdeas(fallbackIdeas(problem)); setSource("준비된 예비 힌트 · 실제 제작 가능성은 선생님과 확인해요.");
  }
  function choose(idea: Idea) {
    setSelected(idea.name); setInvention(idea.name);
    setParts([...idea.parts.map(part => ({ name: part.name, shape: part.shape, owner: "함께", done: false })), ...blankParts()].slice(0, 3));
    setAssembly(idea.assembly);
  }
  function updatePart(index: number, key: keyof Part, value: string | boolean) {
    setParts(items => items.map((part, i) => i === index ? { ...part, [key]: value } : part));
  }
  function reset() {
    ++requestNumber.current; requestRef.current?.abort(); setBusy(false); setCooldown(0);
    setProblem(""); setFirstIdea(""); setInvention(""); setChange(""); setQuestion(0); setIdeas([]); setSource(""); setSelected("");
    setSafety(Array(6).fill(false)); setParts(blankParts()); setAssembly(""); setChildMemory(""); setParentMemory(""); setCleanup(Array(3).fill(false));
    setResetOpen(false); go(0);
  }

  const field = (label: string, value: string, setter: (value: string) => void, placeholder: string, max = 140) => <label className="field"><span>{label}</span><textarea maxLength={max} rows={2} value={value} onChange={event => setter(event.target.value)} placeholder={placeholder} /><small>{value.length}/{max} · 이름·연락처는 적지 않아요</small></label>;

  return <div className={`studio ${teacher ? "teacher" : ""}`}>
    <header className="site-header">
      <button className="brand" onClick={() => go(0)} aria-label="가족 발명소 처음 화면"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span>{camp.title}<small>FAMILY INVENTION STUDIO</small></span></button>
      <div className="header-meta"><span>{camp.date}</span><span>{camp.place}</span></div>
      <button className={`mode-button ${teacher ? "active" : ""}`} onClick={() => setTeacher(value => !value)} aria-pressed={teacher}>{teacher ? "가족 화면으로" : "교사 큰 화면"}<span aria-hidden="true">↗</span></button>
    </header>

    <div className="app-layout">
      <aside className="sidebar" aria-label="수업 길잡이">
        <div className="sidebar-heading"><span className="eyebrow">TODAY’S JOURNEY</span><span>오늘의 여정</span></div>
        <nav aria-label="수업 단계"><ol>{camp.steps.map((item, index) => <li key={item.id}><button aria-current={index === step ? "step" : undefined} onClick={() => go(index)} className={index === step ? "current" : ""}><span className="step-number">{String(index + 1).padStart(2, "0")}</span><span>{item.label}</span><span className="step-arrow" aria-hidden="true">↗</span></button></li>)}</ol></nav>
        <div className="sidebar-note"><span className="tiny-cross" aria-hidden="true">✳</span><p>아이의 생각이 먼저.<br />보호자의 질문이 다음.<br /><strong>발명은 함께.</strong></p></div>
        <button className="text-button schedule-toggle" onClick={() => setShowSchedule(value => !value)} aria-expanded={showSchedule}>전체 시간표 <span>{showSchedule ? "−" : "+"}</span></button>
        {showSchedule && <div className="schedule">{camp.steps.map(item => <p key={item.id}><span>{item.time}</span>{item.label}</p>)}<p className="schedule-rest">휴식·환기<br />09:40–09:50 / 10:30–10:40</p></div>}
      </aside>

      <main className="main-content" id="main-content">
        <div className="section-meta"><span><span className="status-dot" /> {teacher ? "TEACHER’S GUIDE" : "FAMILY WORKSHOP"}</span><span>{current.time} <span className="meta-divider">/</span> {String(step + 1).padStart(2, "0")} — 08</span></div>
        <section className={`stage-head ${step === 0 ? "welcome-head" : ""}`}>
          <div><p className="eyebrow accent">{current.english}</p><h1 ref={titleRef} tabIndex={-1}>{current.title}</h1><p className="stage-description">{current.description}</p></div>
          {step === 0 ? <div className="hero-art"><div className="art-caption"><span>작은 생각이 입체가 되는 시간</span><span>FIG. 01</span></div><Geometry /><p>서로 다른 모양이 만나, 하나의 발명이 됩니다.</p></div> : <div className="stage-index" aria-hidden="true">{String(step + 1).padStart(2, "0")}<span>/{String(camp.steps.length).padStart(2, "0")}</span></div>}
        </section>

        {notice && <p className="notice" role="status">{notice}</p>}
        {teacher && <section className="teacher-note"><span className="eyebrow">교사 진행 메모</span><p>{camp.teacherNotes[step]}</p><small>각 iPad는 가족이 직접 단계를 넘깁니다. 이 화면과 원격으로 동기화되지 않습니다.</small></section>}

        <div className="stage-body">
          {step === 0 && <>
            <div className="mission-strip"><span className="eyebrow">OUR MISSION</span><div><h2>{camp.mission}</h2><p>{camp.promise}</p></div><span className="mission-arrow" aria-hidden="true">↗</span></div>
            <div className="role-grid"><article><span className="eyebrow">01 / 어린이 발명가</span><h3>내 생각을 말해요.</h3><p>불편을 찾고, 무엇을 만들지 정해요.<br />완벽하지 않아도 내 생각이면 좋아요.</p></article><article><span className="eyebrow">02 / 보호자 동료</span><h3>좋은 질문을 건네요.</h3><p>아이의 이야기를 듣고, 함께 궁리해요.<br />안전을 살피고 만드는 손을 보태요.</p></article><article><span className="eyebrow">03 / AI 아이디어 도우미</span><h3>막힐 때 힌트를 줘요.</h3><p>꼭 사용하지 않아도 괜찮아요.<br />고르거나 바꾸는 것은 아이가 해요.</p></article></div>
            <div className="welcome-bottom"><span>{camp.audience}<br />{camp.time} · 쉬는 시간 두 번</span><button className="primary-button" onClick={() => go(1)}>우리 가족, 시작하기 <span aria-hidden="true">↗</span></button></div>
          </>}

          {step === 1 && <>
            <div className="conversation-card"><span className="eyebrow">잠깐, 화면에서 눈을 떼고</span><h2>“{camp.conversation[question].question}”</h2><p>{camp.conversation[question].hint}</p><div className="question-controls"><span>{question + 1} / {camp.conversation.length} 질문</span><button className="text-button" onClick={() => setQuestion((question + 1) % camp.conversation.length)}>다음 질문 <span aria-hidden="true">→</span></button></div></div>
            {field("우리 가족이 발견한 불편 한 가지", problem, setProblem, `${camp.theme}에서 어떤 일이 불편했나요?`, 50)}
            <div className="example-buttons">{camp.problemExamples.map(example => <button key={example} onClick={() => setProblem(example)}>{example} <span aria-hidden="true">↗</span></button>)}</div>
            {field("아이의 첫 생각", firstIdea, setFirstIdea, "이렇게 바뀌면 좋겠어!")}
            <p className="quiet-note">기록은 선택이에요. 대화한 내용을 종이 활동지에 적어도 좋아요.</p>
          </>}

          {step === 2 && <>
            <div className="limits-strip"><span>손바닥 크기 <strong>10cm 이내</strong></span><span>실제 만드는 조각 <strong>3개 이내</strong></span><span>방법 <strong>평면 → 세우기 → 붙이기</strong></span></div>
            {field("우리가 만들 발명품 이름", invention, setInvention, "아이가 정한 이름을 적어요", 40)}
            <details className="idea-drawer"><summary>함께 막혔나요? 아이디어 힌트 펼치기 <span aria-hidden="true">+</span></summary><div className="drawer-content"><p>아이의 생각을 먼저 들어 보셨나요? AI 답은 힌트예요. 우리 생각에 맞게 바꿔 주세요.</p>
              {field("힌트를 얻고 싶은 불편", problem, setProblem, "불편 한 가지만 적어요", 50)}
              <div className="button-row"><button className="primary-button" onClick={() => ask()} disabled={busy || cooldown > 0}>{busy ? "힌트를 생각하고 있어요…" : cooldown ? `${cooldown}초 후 다시 요청` : "아이디어 카드 3장 보기"}<span aria-hidden="true">↗</span></button><button className="secondary-button" onClick={prepared}>준비된 힌트 바로 보기</button></div>
              <p className="source-note" role="status" aria-live="polite">{busy ? "15초 안에 연결되지 않으면 예비 힌트를 보여드려요." : source}</p>
              {!!ideas.length && <><div className="idea-grid">{ideas.map((idea, index) => <article className={`idea-card ${selected === idea.name ? "selected" : ""}`} key={`${idea.name}-${index}`}><span className="eyebrow">IDEA {String(index + 1).padStart(2, "0")} · {idea.parts.length}조각</span><h3>{idea.name}</h3><p>{idea.problem}</p><h4>필요한 조각</h4><ul>{idea.parts.map((part, i) => <li key={i}>{part.name} — {part.shape}</li>)}</ul><h4>이어 붙이는 방법</h4><p>{idea.assembly}</p><button className="secondary-button" onClick={() => choose(idea)} aria-pressed={selected === idea.name}>{selected === idea.name ? "선택한 힌트 ✓" : "이 힌트를 바꿔 볼래요"}</button></article>)}</div><div className="retry-buttons">{[["simpler", "더 간단하게"], ["two", "부품 2개로"], ["different", "다른 아이디어"]].map(([mode, label]) => <button disabled={busy || cooldown > 0} key={mode} onClick={() => ask(mode)}>{label} ↗</button>)}</div></>}
            </div></details>
            {field("우리 생각으로 바꾸고 싶은 점", change, setChange, "모양, 쓰는 곳, 크기… 무엇을 바꿔 볼까요?")}
            <div className="paper-prompt"><span className="eyebrow">이제 종이에 그려요</span><h3>우리 발명의 모습을 스케치해요.</h3><p>활동지에 손바닥 크기로 그리고, 실제 만들 조각을 세 개 이내로 나눠요. 그림을 잘 그리는 것보다 서로 설명하는 게 중요해요.</p></div>
          </>}

          {step === 3 && <><div className="equipment-line"><span>오늘의 도구</span><strong>{camp.equipment.model}</strong><span>{camp.equipment.material}</span><strong className="accent">{camp.equipment.temperature}℃ 기준 · 뜨거워요</strong></div><div className="safety-grid">{camp.safety.map((item, index) => <label className={`safety-card ${safety[index] ? "checked" : ""}`} key={item.title}><input type="checkbox" checked={safety[index]} onChange={event => setSafety(items => items.map((value, i) => i === index ? event.target.checked : value))} /><span className="safety-number">{String(index + 1).padStart(2, "0")}</span><div><h3>{item.title}</h3><p>{item.detail}</p></div></label>)}</div><p className="safety-progress" role="status">함께 확인한 약속 {safety.filter(Boolean).length} / 6 · {allSafe ? "이제 선생님 안내에 따라 시작해요." : "모두 확인하면 펜 연습과 만들기를 시작할 수 있어요."}</p></>}

          {step === 4 && <><div className="practice-grid">{[{ n: "01", symbol: "·", title: "점과 선", text: "작은 점을 찍고, 천천히 선으로 이어 봐요." }, { n: "02", symbol: "≋", title: "평면 채우기", text: "도안 위에 선을 이어 빈 곳을 채워요." }, { n: "03", symbol: "⊥", title: "세워 붙이기", text: "식힌 평면 조각을 세우고, 연결 부분을 붙여요." }].map(item => <article key={item.n}><span className="eyebrow">TRY {item.n}</span><div className="practice-symbol" aria-hidden="true">{item.symbol}</div><h3>{item.title}</h3><p>{item.text}</p></article>)}</div><div className="paper-prompt"><h3>선생님이 보여 주면, 같이 따라 해요.</h3><p>필라멘트 넣기와 빼기는 실물 시연을 보고 해요. 잘 안 나오거나 펜이 이상하면 멈추고 도움을 요청해요.</p></div><div className="rest-strip"><span>PAUSE / 09:40–09:50</span><strong>우리도, 펜도 쉬어 가요.</strong><p>지정된 곳에 펜을 놓고 선생님 안내에 따라 쉬어요.</p></div></>}

          {step === 5 && <><div className="build-tabs" role="group" aria-label="만들기 과정">{["01 / 부품 나누고 그리기", "02 / 세우고 조립하기"].map((label, index) => <button key={label} aria-pressed={buildPhase === index} className={index === buildPhase ? "active" : ""} onClick={() => { setBuildPhase(index); setSeconds((index ? 23 : 25) * 60); setRunning(false); }}>{label}</button>)}</div>
            <div className="conversation-inline"><span className="eyebrow">서로에게 물어봐요</span><h2>“{buildPhase ? "어느 부분부터 붙이면 잘 설까?" : "어떤 조각을 함께 만들까?"}”</h2></div>
            {buildPhase === 0 ? <><p className="quiet-note">한 줄에 실제 조각 한 개를 적어요. 같은 벽 두 장이면 두 줄이에요. 빈 줄은 만들지 않아도 돼요.</p><div className="parts-table"><div className="parts-head"><span>조각</span><span>이름 / 모양</span><span>누가 만들까?</span><span>완료</span></div>{parts.map((part, index) => <div className="part-row" key={index}><span className="part-index">0{index + 1}</span><div><input aria-label={`${index + 1}번 조각 이름`} placeholder="조각 이름" value={part.name} maxLength={30} onChange={event => updatePart(index, "name", event.target.value)} /><input aria-label={`${index + 1}번 조각 모양`} placeholder="모양과 크기" value={part.shape} maxLength={60} onChange={event => updatePart(index, "shape", event.target.value)} /></div><select aria-label={`${index + 1}번 조각 담당`} value={part.owner} onChange={event => updatePart(index, "owner", event.target.value)}><option>함께</option><option>학생</option><option>보호자</option></select><input type="checkbox" aria-label={`${index + 1}번 조각 완성`} checked={part.done} onChange={event => updatePart(index, "done", event.target.checked)} /></div>)}</div><div className="rest-strip"><span>PAUSE / 10:30–10:40</span><strong>부품을 모으고, 잠깐 쉬어요.</strong><p>작품을 보며 서로 잘된 점을 하나씩 말해 주세요.</p></div></> : <>{field("우리의 조립 순서", assembly, setAssembly, "어떤 조각부터 세우고 붙일까요?", 200)}<div className="role-grid two"><article><span className="eyebrow">10:40–10:55</span><h3>먼저 튼튼하게 연결해요.</h3><p>평면 조각이 잘 서는지 함께 살펴요. 어려우면 조각 하나를 줄여도 좋아요.</p></article><article><span className="eyebrow">10:55–11:03</span><h3>마무리할 부분을 골라요.</h3><p>장식보다 가장 중요한 기능부터. 완성한 조각과 스케치만 소개해도 괜찮아요.</p></article></div></>}
            <div className="help-strip"><span className="help-dot" /><p>안전이 걱정되거나 펜이 이상하면 <strong>멈추고 빨간 도움 카드</strong>를 세워 주세요.</p></div>
          </>}

          {step === 6 && <><div className="presentation-card"><span className="eyebrow">우리 가족의 90초</span><h2>우리 발명품은<br /><em>{invention || "____________"}</em>이에요.</h2><p><strong>{problem || "____________"}</strong> 불편을 바꾸고 싶었어요.</p><p>우리는 <strong>{change || firstIdea || "____________"}</strong> 생각을 더했어요.</p></div><div className="role-grid two"><article><span className="eyebrow">학생이 먼저</span><h3>내가 결정한 것을 말해요.</h3><p>“내가 가장 마음에 드는 부분은…”<br />“다음에 바꾸고 싶은 부분은…”</p></article><article><span className="eyebrow">보호자가 한마디</span><h3>함께한 순간을 보태요.</h3><p>“아이가 이런 생각을 해서 놀랐어요.”<br />“이 질문을 나누면서 재미있었어요.”</p></article></div><p className="quiet-note">친구의 발표를 듣고, 잘한 점을 하나씩 찾아요. 미완성 작품도 도전한 이야기가 있어요.</p></>}

          {step === 7 && <>{field("학생의 한마디", childMemory, setChildMemory, "보호자와 함께해서 가장 좋았던 순간은?")}{field("보호자의 한마디", parentMemory, setParentMemory, "오늘 새롭게 발견한 아이의 모습은?")}<div className="finish-note"><span className="eyebrow">OUR BEST INVENTION</span><h2>함께 이야기하고,<br />함께 해낸 오늘.</h2><p>{camp.promise}</p></div><div className="cleanup-list"><h3>추억을 챙기고, 안전하게 마무리해요.</h3>{["선생님 안내에 따라 필라멘트를 정리했어요", "전원을 분리하고 지정된 곳에서 펜을 식혀요", "작품과 활동지를 챙겼어요"].map((label, index) => <label key={label}><input type="checkbox" checked={cleanup[index]} onChange={event => setCleanup(items => items.map((value, i) => i === index ? event.target.checked : value))} />{label}</label>)}</div><div className="button-row"><button className="primary-button" onClick={() => window.print()}>우리 가족 기록 인쇄 / PDF <span aria-hidden="true">↗</span></button><button className="secondary-button" onClick={() => setResetOpen(true)}>새 가족으로 시작</button></div><p className="quiet-note">입력은 현재 화면의 메모리에만 있어요. 새로고침하거나 닫으면 사라져요. 사진·이름은 수집하지 않아요.</p></>}
        </div>

        {step > 0 && <div className="stage-footer"><button className="text-button" onClick={() => go(step - 1)}>← 이전 단계</button><div className="timer"><span className="eyebrow">대화와 활동 시간</span><output aria-label="남은 활동 시간">{formatTime(seconds)}</output><button onClick={() => setRunning(value => !value)} aria-label={running ? "타이머 멈추기" : "타이머 시작"}>{running ? "멈춤" : seconds === 0 ? "완료" : "시작"}</button><button onClick={() => { setRunning(false); setSeconds((step === 5 ? buildPhase ? 23 : 25 : current.minutes) * 60); }} aria-label="타이머 초기화">↺</button>{seconds === 0 && <span role="status">함께 마무리해요</span>}</div>{step < 7 ? <button className="primary-button" onClick={() => go(step + 1)}>{camp.steps[step + 1].label}<span aria-hidden="true">→</span></button> : <span className="end-label">수고했어요, 발명가 가족! ↗</span>}</div>}
        <footer className="page-footer"><span>FAMILY INVENTION STUDIO</span><span>정답보다 대화, 완성보다 함께.</span></footer>
      </main>
    </div>
    {resetOpen && <div className="dialog-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="reset-title" className="reset-dialog"><h2 id="reset-title">새 가족으로 시작할까요?</h2><p>지금 적은 기록과 안전 확인이 모두 지워져요. 필요하면 먼저 인쇄해 주세요.</p><div className="button-row"><button autoFocus className="secondary-button" onClick={() => setResetOpen(false)}>계속 기록하기</button><button className="primary-button" onClick={reset}>지우고 시작</button></div></section></div>}
    <section className="print-record"><h1>{camp.title} · 우리 가족 기록</h1><p>{camp.date} / {camp.place}</p><h2>발견한 불편</h2><p>{problem || "종이 활동지에 기록했어요."}</p><h2>아이의 첫 생각</h2><p>{firstIdea || "함께 이야기했어요."}</p><h2>우리 발명품 · {invention || "이름을 붙여 주세요"}</h2><p>우리가 더한 생각: {change || "________________"}</p>{selected && <p>참고한 힌트: {selected}</p>}<h2>함께 만든 조각</h2>{parts.filter(part => part.name).map((part, index) => <p key={index}>{index + 1}. {part.name} / {part.shape} / {part.owner} / {part.done ? "완성" : "도전 중"}</p>)}<p>조립 순서: {assembly || "________________"}</p><h2>오늘의 한마디</h2><p>학생: {childMemory || "________________"}</p><p>보호자: {parentMemory || "________________"}</p><footer>{camp.promise}</footer></section>
  </div>;
}
