// src/services/exportService.ts
// REQ-V5-05: Export checklist + logs as PDF or CSV

import { Platform } from 'react-native';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Cat, Recipe, CheckRecord, DailyLog } from '../types';

interface ExportOptions {
  cats: Cat[];
  recipes: Recipe[];
  checks: CheckRecord[];
  logs: DailyLog[];
  startDate: string;
  endDate: string;
  householdName: string;
}

// ── CSV Export ────────────────────────────────────────────────────────────────

export async function exportAsCSV(opts: ExportOptions): Promise<void> {
  const rows: string[] = [
    '날짜,고양이,루틴항목,완료여부,완료시각,메모',
  ];

  opts.checks.forEach((c) => {
    const cat = opts.cats.find((cat) => cat.id === c.catId);
    const recipe = opts.recipes.find((r) => r.id === c.recipeId);
    rows.push(
      [
        c.date,
        cat?.name ?? '',
        recipe?.name ?? '',
        c.done ? '완료' : '미완료',
        c.doneAt ? format(new Date(c.doneAt), 'HH:mm', { locale: ko }) : '',
        c.memo ?? '',
      ]
        .map((v) => `"${v}"`)
        .join(',')
    );
  });

  rows.push('');
  rows.push('날짜,메모,사진여부');
  opts.logs.forEach((l) => {
    rows.push(
      [l.date, l.text, l.photoUri ? '있음' : '없음']
        .map((v) => `"${v}"`)
        .join(',')
    );
  });

  const csv = '\uFEFF' + rows.join('\n');
  const fileName = `CatCare_${opts.startDate}_${opts.endDate}.csv`;

  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const FileSystem = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const path = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(path, {
    mimeType: 'text/csv',
    dialogTitle: 'CatCare 기록 내보내기',
    UTI: 'public.comma-separated-values-text',
  });
}

// ── HTML → PDF Export ─────────────────────────────────────────────────────────

export async function exportAsPDF(opts: ExportOptions): Promise<void> {
  const html = buildReportHTML(opts);
  const fileName = `CatCare_Report_${opts.startDate}_${opts.endDate}.html`;

  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      // 약간 딜레이 후 인쇄 다이얼로그 (PDF로 저장 가능)
      setTimeout(() => win.print(), 500);
    }
    return;
  }

  const FileSystem = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const path = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(path, html, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(path, {
    mimeType: 'text/html',
    dialogTitle: 'CatCare 건강 리포트 공유',
  });
}

function buildReportHTML(opts: ExportOptions): string {
  const { cats, recipes, checks, logs, startDate, endDate, householdName } = opts;

  const dateRange = `${format(new Date(startDate), 'yyyy년 M월 d일')} ~ ${format(
    new Date(endDate), 'yyyy년 M월 d일'
  )}`;

  const catSections = cats
    .map((cat) => {
      const catChecks = checks.filter((c) => c.catId === cat.id && c.done);
      const catRecipes = recipes.filter((r) => r.catIds.includes(cat.id));
      const total = checks.filter((c) => c.catId === cat.id).length;
      const completionRate = total > 0 ? Math.round((catChecks.length / total) * 100) : 0;

      return `
      <section class="cat-section">
        <h2>${cat.name}</h2>
        <p class="meta">루틴 항목 ${catRecipes.length}개 · 완료율 ${completionRate}%</p>
        <table>
          <thead><tr><th>날짜</th><th>루틴</th><th>완료</th><th>메모</th></tr></thead>
          <tbody>
            ${catChecks.slice(0, 100).map((c) => `<tr>
              <td>${c.date}</td>
              <td>${recipes.find((r) => r.id === c.recipeId)?.name ?? '-'}</td>
              <td>✓</td>
              <td>${c.memo ?? ''}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </section>`;
    })
    .join('');

  const logSection = logs
    .map((l) => `<div class="log-row">
      <span class="log-date">${l.date}</span>
      <p>${l.text}</p>
    </div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="UTF-8">
<title>CatCare 건강 리포트</title>
<style>
  body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; color: #2C2420; padding: 32px; max-width: 800px; margin: auto; }
  h1 { color: #C4956A; } h2 { color: #6B4F3A; border-bottom: 2px solid #E8DDD0; padding-bottom: 6px; }
  .meta { color: #8C7B70; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; font-size: 13px; }
  th { background: #FAF6F0; padding: 8px; text-align: left; }
  td { padding: 7px 8px; border-bottom: 1px solid #E8DDD0; }
  .log-row { padding: 10px 0; border-bottom: 1px solid #E8DDD0; }
  .log-date { font-weight: bold; color: #C4956A; display: block; font-size: 12px; }
  @media print { body { padding: 0; } }
</style>
</head><body>
<h1>🐱 CatCare 건강 리포트</h1>
<p>${dateRange}</p>
${catSections}
<h2>📓 데일리 로그</h2>
${logSection || '<p style="color:#8C7B70">기록된 로그가 없습니다.</p>'}
</body></html>`;
}
