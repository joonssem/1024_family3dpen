import { recordSections, type FamilyRecord } from "./family-record";

export async function createRecordImage(record: FamilyRecord): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");
  const width = 1080, margin = 76, contentWidth = width - margin * 2;
  const font = 'Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  function lines(value: string, size: number, weight = 500) {
    ctx!.font = `${weight} ${size}px ${font}`;
    return value.split("\n").flatMap(paragraph => {
      const result: string[] = []; let line = "";
      for (const character of Array.from(paragraph)) {
        if (line && ctx!.measureText(line + character).width > contentWidth) { result.push(line); line = ""; }
        line += character;
      }
      result.push(line); return result;
    });
  }
  const titleLines = lines(record.title + " · 우리 가족 기록", 56, 800);
  const metaLines = lines(`${record.date} / ${record.place}`, 25);
  const sections = recordSections(record).map(section => ({ ...section, lines: lines(section.body, 32) }));
  const promiseLines = lines(record.promise, 28, 700);
  canvas.width = width;
  canvas.height = 260 + titleLines.length * 74 + metaLines.length * 36
    + sections.reduce((height, section) => height + 105 + section.lines.length * 48, 0) + promiseLines.length * 42;
  ctx.fillStyle = "#f5f3ec"; ctx.fillRect(0, 0, width, canvas.height);
  ctx.textBaseline = "top";
  let y = 70;
  function write(value: string[], size: number, lineHeight: number, color: string, weight = 500) {
    ctx!.font = `${weight} ${size}px ${font}`; ctx!.fillStyle = color;
    for (const line of value) { ctx!.fillText(line, margin, y); y += lineHeight; }
  }
  write(["FAMILY INVENTION STUDIO / OUR MEMORY"], 21, 52, "#ed4a2c", 700);
  write(titleLines, 56, 74, "#1c2825", 800);
  y += 12; write(metaLines, 25, 36, "#6b726b"); y += 35;
  for (const section of sections) {
    ctx.strokeStyle = "#d2d3c8"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(margin, y); ctx.lineTo(width - margin, y); ctx.stroke();
    y += 24; write([section.title], 23, 43, "#ed4a2c", 700);
    write(section.lines, 32, 48, "#1c2825"); y += 38;
  }
  write(promiseLines, 28, 42, "#1c2825", 700);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("image-unavailable")), "image/png"));
}
