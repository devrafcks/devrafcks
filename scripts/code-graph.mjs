// Generates the profile SVGs (contribution log and stats cards) from the GitHub GraphQL API.
// Usage: node scripts/code-graph.mjs (needs GITHUB_TOKEN and GH_USER). Preview with sample data: --demo
import { mkdirSync, writeFileSync } from "node:fs";

const THEMES = {
  dark: {
    bg: "#1e1416", panel: "#2b1e20", border: "#4a3a3c", text: "#fff6e0", muted: "#a8978a",
    zero: "#2f2224", levels: ["#2f2224", "#5a3b00", "#9a6500", "#e0a200", "#ffbc00"],
    accent: "#ffbc00", blue: "#ff7f1a", purple: "#ff9e4a", orange: "#ffd166", flash: "#ffffff",
  },
  light: {
    bg: "#fffbf2", panel: "#fff1d6", border: "#ecd9b0", text: "#2b1e20", muted: "#7a6a5d",
    zero: "#efe2c4", levels: ["#efe2c4", "#ffe08a", "#ffbc00", "#e08a00", "#b45309"],
    accent: "#b45309", blue: "#d9480f", purple: "#9a3412", orange: "#c2410c", flash: "#2b1e20",
  },
};
const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
const MESES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// Monkey D. Luffy's current bounty (Gear 5 poster, since Wano). Update here if it changes.
const LUFFY_BOUNTY = 3_000_000_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function streakInfo(weeks) {
  const days = weeks.flatMap((w) => w.contributionDays);
  let best = 0, run = 0, active = 0, bestDay = 0;
  for (const d of days) {
    run = d.contributionCount > 0 ? run + 1 : 0;
    best = Math.max(best, run);
    if (d.contributionCount > 0) active++;
    bestDay = Math.max(bestDay, d.contributionCount);
  }
  let cur = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].contributionCount > 0) cur++;
    else if (i === days.length - 1) continue;
    else break;
  }
  const byDay = Array(7).fill(0);
  days.forEach((d) => { byDay[d.weekday] += d.contributionCount; });
  const total = byDay.reduce((x, y) => x + y, 0);
  return { cur, best, active, bestDay, busiest: WEEKDAYS[byDay.indexOf(Math.max(...byDay))], perWeek: (total / Math.max(1, weeks.length)).toFixed(1) };
}

export function render(weeks, total, user, t) {
  const CELL = 17, SZ = 13, X0 = 40, Y0 = 84, nW = weeks.length;
  const W = X0 + nW * CELL + 30, H = Y0 + 7 * CELL + 78;
  const SCAN = 10, step = SCAN / nW;
  const days = weeks.flatMap((w) => w.contributionDays);
  const lvOf = (d) => LEVEL[d.contributionLevel] ?? (d.contributionCount > 0 ? 2 : 0);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

  const { cur, best, busiest } = streakInfo(weeks);
  const bounty = LUFFY_BOUNTY.toLocaleString("en-US");

  let cells = "", months = "", lastMonth = -1;
  weeks.forEach((w, i) => {
    const m = new Date(w.contributionDays[0].date + "T00:00:00Z").getUTCMonth();
    if (m !== lastMonth && i < nW - 3) { months += `<text x="${X0 + i * CELL}" y="${Y0 - 12}" class="m">${MESES[m]}</text>`; lastMonth = m; }
    w.contributionDays.forEach((d) => {
      const lv = lvOf(d), x = X0 + i * CELL, y = Y0 + d.weekday * CELL;
      const delay = (i * step).toFixed(2);
      cells += lv === 0
        ? `<rect x="${x}" y="${y}" width="${SZ}" height="${SZ}" rx="4" fill="${t.zero}"/>`
        : `<rect x="${x}" y="${y}" width="${SZ}" height="${SZ}" rx="4" fill="${t.levels[lv]}" class="c" style="animation-delay:${delay}s"/>`;
    });
  });

  const lastWeek = weeks[nW - 1], today = lastWeek.contributionDays[lastWeek.contributionDays.length - 1];
  const tx = X0 + (nW - 1) * CELL, ty = Y0 + today.weekday * CELL;
  const HAT = ["..YYY..", ".YYYYY.", ".RRRRR.", "YYYYYYY"];
  let hat = "";
  HAT.forEach((row, r) => [...row].forEach((ch, k) => {
    if (ch !== ".") hat += `<rect x="${(tx + SZ / 2 - 8.4 + k * 2.4).toFixed(1)}" y="${(Y0 - 26 + r * 2.4).toFixed(1)}" width="2.4" height="2.4" fill="${ch === "R" ? "#e5484d" : "#ffbc00"}"/>`;
  }));

  const legend = t.levels.map((c, i) => `<rect x="${X0 + 34 + i * 16}" y="${H - 36}" width="11" height="11" rx="3.5" fill="${c}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>
text{font-family:'JetBrains Mono','Fira Code',Consolas,'Courier New',monospace}
.m{font-size:10.5px;fill:${t.muted}}.d{font-size:10.5px;fill:${t.muted}}
.c{transform-box:fill-box;transform-origin:center;animation:c ${SCAN}s ease-out infinite}
@keyframes c{0%{fill:${t.flash};transform:scale(1.35)}7%{fill:${t.accent};transform:scale(1)}100%{transform:scale(1)}}
.pulse{animation:p 1.6s ease-in-out infinite}@keyframes p{0%,100%{opacity:.15}50%{opacity:1}}
.cur{animation:bl 1s steps(1) infinite}@keyframes bl{50%{opacity:0}}
</style>
<text x="${X0}" y="30" style="font-size:13px"><tspan fill="${t.accent}">~/shipping.log</tspan><tspan fill="${t.muted}">   last 12 months</tspan></text>
<text x="${W - 30}" y="30" text-anchor="end" style="font-size:13px"><tspan fill="${t.accent}" font-weight="700">${total}</tspan><tspan fill="${t.text}"> contributions</tspan><tspan fill="${t.muted}">  ·  </tspan><tspan fill="${t.accent}" font-weight="700">${cur}</tspan><tspan fill="${t.text}">-day streak</tspan><tspan fill="${t.muted}">  ·  best </tspan><tspan fill="${t.accent}" font-weight="700">${best}</tspan><tspan fill="${t.muted}">  ·  busiest </tspan><tspan fill="${t.accent}" font-weight="700">${busiest}</tspan></text>
<rect x="${X0}" y="44" width="${nW * CELL - 4}" height="1" fill="${t.border}"/>
${months}
<text x="${X0 - 10}" y="${Y0 + 1 * CELL + 10}" class="d" text-anchor="end">mon</text>
<text x="${X0 - 10}" y="${Y0 + 3 * CELL + 10}" class="d" text-anchor="end">wed</text>
<text x="${X0 - 10}" y="${Y0 + 5 * CELL + 10}" class="d" text-anchor="end">fri</text>
${cells}
<rect class="pulse" x="${tx - 2}" y="${ty - 2}" width="${SZ + 4}" height="${SZ + 4}" rx="6" fill="none" stroke="${t.accent}" stroke-width="1.6"/>
${hat}
<text x="${tx - 6}" y="${Y0 - 17}" text-anchor="end" style="font-size:10.5px;fill:${t.accent}">now</text>
<text x="${X0}" y="${H - 27}" class="d">less</text>${legend}<text x="${X0 + 34 + 5 * 16 + 4}" y="${H - 27}" class="d">more</text>
<text x="${W - 30}" y="${H - 27}" text-anchor="end" style="font-size:13px"><tspan fill="${t.accent}" font-weight="700">WANTED</tspan><tspan fill="${t.muted}">  ·  Monkey D. Luffy  ·  </tspan><tspan fill="${t.orange}" font-weight="700">฿ ${bounty}</tspan><tspan fill="${t.muted}">  ·  still shipping</tspan><tspan fill="${t.text}" class="cur">_</tspan></text>
</svg>`;
}


function frame(W, H, title, t) {
  return `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="12" fill="${t.bg}" stroke="${t.border}" stroke-width="2"/>
<path d="M1 13 a12 12 0 0 1 12 -12 H${W - 13} a12 12 0 0 1 12 12 V38 H1Z" fill="${t.panel}"/>
<rect x="1" y="38" width="${W - 2}" height="1" fill="${t.border}"/>
<circle cx="20" cy="20" r="5.5" fill="#ff5f57"/><circle cx="37" cy="20" r="5.5" fill="#febc2e"/><circle cx="54" cy="20" r="5.5" fill="#28c840"/>
<text x="${W / 2}" y="25" text-anchor="middle" style="font-size:12.5px;fill:${t.muted}">${title}</text>`;
}
const CSS = (t) => `<style>text{font-family:'JetBrains Mono','Fira Code',Consolas,'Courier New',monospace}
.l{opacity:0;animation:l .4s ease-out forwards}@keyframes l{to{opacity:1}}</style>`;
const esc2 = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function metricsCard(file, cmd, flag, rows, t) {
  const W = 440, H = 220;
  let body = `<text x="20" y="64" class="l" style="font-size:13px"><tspan fill="${t.accent}">$</tspan><tspan fill="${t.text}"> ${cmd} </tspan><tspan fill="${t.orange}">${flag}</tspan></text>`;
  rows.forEach(([k, v, c], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 20 + col * 210, y = 104 + row * 38;
    body += `<g class="l" style="animation-delay:${0.15 + i * 0.12}s">
<text x="${x}" y="${y}" style="font-size:12px;fill:${t.muted}">${k}:</text>
<text x="${x + 190}" y="${y}" text-anchor="end" style="font-size:18px;font-weight:700;fill:${c}">${esc2(v)}</text>
<rect x="${x}" y="${y + 9}" width="190" height="1" fill="${t.border}"/></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${CSS(t)}${frame(W, H, file, t)}${body}</svg>`;
}

export function statsCard(st, t) {
  return metricsCard("stats.sh", "git stats", "--last-year", [
    ["commits", st.commits, t.accent], ["pull_requests", st.prs, t.blue], ["issues", st.issues, t.purple],
    ["repositories", st.repos, t.orange], ["stars", st.stars, "#e3b341"], ["followers", st.followers, t.blue],
  ], t);
}

export function impactCard(st, t) {
  return metricsCard("impact.sh", "git impact", "--all-time", [
    ["merged_prs", st.merged, t.accent], ["code_reviews", st.reviews, t.blue], ["contributed_to", st.contributedTo, t.purple],
    ["following", st.following, t.orange], ["orgs", st.orgs, "#e3b341"], ["member_since", st.since, t.blue],
  ], t);
}

export function streakCard(si, t) {
  return metricsCard("streaks.sh", "git streak", "--last-year", [
    ["current_streak", si.cur + "d", t.accent], ["longest_streak", si.best + "d", t.blue], ["active_days", si.active, t.purple],
    ["best_day", si.bestDay, t.orange], ["busiest_day", si.busiest, "#e3b341"], ["avg_per_week", si.perWeek, t.blue],
  ], t);
}

export function langsCard(langs, t) {
  const W = 440, H = 220;
  const top = langs.slice(0, 6), total = top.reduce((a, b) => a + b.size, 0) || 1;
  let x = 20, bar = "";
  const BW = 400;
  top.forEach((l, i) => {
    const w = Math.max(3, (l.size / total) * BW);
    bar += `<rect x="${x.toFixed(1)}" y="78" width="${w.toFixed(1)}" height="10" fill="${l.color || t.muted}"/>`;
    x += w;
  });
  let legend = "";
  top.forEach((l, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const lx = 20 + col * 210, ly = 122 + row * 30;
    legend += `<g class="l" style="animation-delay:${0.15 + i * 0.1}s"><circle cx="${lx + 5}" cy="${ly - 4}" r="5" fill="${l.color || t.muted}"/>
<text x="${lx + 18}" y="${ly}" style="font-size:12.5px;fill:${t.text}">${esc2(l.name)}</text>
<text x="${lx + 190}" y="${ly}" text-anchor="end" style="font-size:12.5px;fill:${t.muted}">${((l.size / total) * 100).toFixed(1)}%</text></g>`;
  });
  if (!top.length) legend = `<text x="20" y="130" style="font-size:13px;fill:${t.muted}">// no language found yet</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${CSS(t)}${frame(W, H, "languages.json", t)}
<text x="20" y="62" class="l" style="font-size:13px"><tspan fill="${t.accent}">$</tspan><tspan fill="${t.text}"> linguist </tspan><tspan fill="${t.orange}">--top 6</tspan></text>
<clipPath id="bc"><rect x="20" y="78" width="${BW}" height="10" rx="5"/></clipPath><g clip-path="url(#bc)">${bar}</g>${legend}</svg>`;
}

function barsCard(file, cmd, flag, items, t) {
  const W = 440, H = 220, X0 = 20, CW = 400, BASE = 176, MAXH = 74;
  const n = items.length, slot = CW / n, bw = Math.min(40, slot * 0.64);
  const max = Math.max(1, ...items.map((i) => i.value));
  const top = items.findIndex((i) => i.value === max);
  let bars = "";
  items.forEach((it, i) => {
    const h = Math.max(3, (it.value / max) * MAXH), x = X0 + i * slot + (slot - bw) / 2, hot = i === top;
    bars += `<g><rect class="b" x="${x.toFixed(1)}" y="${(BASE - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="${hot ? t.accent : t.levels[3]}" fill-opacity="${hot ? 1 : 0.55}" style="animation-delay:${(0.1 + i * 0.07).toFixed(2)}s"/>
<text class="l" x="${(x + bw / 2).toFixed(1)}" y="${(BASE - h - 6).toFixed(1)}" text-anchor="middle" style="font-size:10.5px;font-weight:${hot ? 700 : 400};fill:${hot ? t.accent : t.muted};animation-delay:${(0.4 + i * 0.07).toFixed(2)}s">${it.value}</text>
<text x="${(x + bw / 2).toFixed(1)}" y="${BASE + 18}" text-anchor="middle" style="font-size:10.5px;fill:${hot ? t.text : t.muted}">${esc2(it.label)}</text></g>`;
  });
  const css = `<style>text{font-family:'JetBrains Mono','Fira Code',Consolas,'Courier New',monospace}.l{opacity:0;animation:l .4s ease-out forwards}@keyframes l{to{opacity:1}}.b{transform-box:fill-box;transform-origin:bottom;animation:g .7s cubic-bezier(.2,.8,.2,1) both}@keyframes g{from{transform:scaleY(0)}}</style>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${css}${frame(W, H, file, t)}
<text x="20" y="64" class="l" style="font-size:13px"><tspan fill="${t.accent}">$</tspan><tspan fill="${t.text}"> ${cmd} </tspan><tspan fill="${t.orange}">${flag}</tspan></text>
<rect x="${X0}" y="${BASE + 2}" width="${CW}" height="1" fill="${t.border}"/>${bars}</svg>`;
}

export function weekdaysCard(weeks, t) {
  const sums = Array(7).fill(0);
  weeks.forEach((w) => w.contributionDays.forEach((d) => { sums[d.weekday] += d.contributionCount; }));
  const order = [1, 2, 3, 4, 5, 6, 0];
  return barsCard("weekdays.sh", "git log", "--by-weekday", order.map((d) => ({ label: WEEKDAYS[d], value: sums[d] })), t);
}

export function monthsCard(weeks, t) {
  const byMonth = new Map();
  weeks.forEach((w) => w.contributionDays.forEach((d) => {
    const k = d.date.slice(0, 7);
    byMonth.set(k, (byMonth.get(k) || 0) + d.contributionCount);
  }));
  const items = [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-12)
    .map(([k, v]) => ({ label: MESES[Number(k.slice(5)) - 1], value: v }));
  return barsCard("months.sh", "git log", "--by-month", items, t);
}

async function main() {
  const user = process.env.GH_USER, token = process.env.GITHUB_TOKEN;
  const query = `query($login:String!){user(login:$login){
    followers{totalCount} following{totalCount} createdAt
    organizations{totalCount}
    pullRequests(states:MERGED){totalCount}
    repositoriesContributedTo(first:1, contributionTypes:[COMMIT,PULL_REQUEST,ISSUE,REPOSITORY]){totalCount}
    contributionsCollection{ totalPullRequestReviewContributions
      totalCommitContributions totalPullRequestContributions totalIssueContributions restrictedContributionsCount
      contributionCalendar{totalContributions weeks{contributionDays{date weekday contributionCount contributionLevel}}}}
    repositories(first:100, ownerAffiliations:OWNER, isFork:false, privacy:PUBLIC, orderBy:{field:PUSHED_AT,direction:DESC}){
      totalCount
      nodes{stargazerCount
        languages(first:10, orderBy:{field:SIZE,direction:DESC}){edges{size node{name color}}}}}}}`;
  const r = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { login: user } }),
  });
  const j = await r.json();
  if (!j.data?.user) throw new Error("Failed to fetch data: " + JSON.stringify(j));
  const u = j.data.user, cc = u.contributionsCollection, cal = cc.contributionCalendar, repos = u.repositories.nodes;

  const langMap = {};
  for (const rp of repos) for (const e of rp.languages.edges) {
    langMap[e.node.name] ??= { name: e.node.name, color: e.node.color, size: 0 };
    langMap[e.node.name].size += e.size;
  }
  const langs = Object.values(langMap).sort((a, b) => b.size - a.size);
  const stats = {
    year: new Date().getFullYear(),
    commits: cc.totalCommitContributions + cc.restrictedContributionsCount,
    prs: cc.totalPullRequestContributions, issues: cc.totalIssueContributions,
    repos: u.repositories.totalCount, stars: repos.reduce((a, b) => a + b.stargazerCount, 0),
    followers: u.followers.totalCount,
  };
  const impact = {
    merged: u.pullRequests.totalCount, reviews: cc.totalPullRequestReviewContributions,
    contributedTo: u.repositoriesContributedTo.totalCount, following: u.following.totalCount,
    orgs: u.organizations.totalCount, since: new Date(u.createdAt).getUTCFullYear(),
  };
  const si = streakInfo(cal.weeks);

  mkdirSync("dist", { recursive: true });
  for (const [suf, t] of [["", THEMES.light], ["-dark", THEMES.dark]]) {
    writeFileSync(`dist/code-contribution-graph${suf}.svg`, render(cal.weeks, cal.totalContributions, user, t));
    writeFileSync(`dist/stats${suf}.svg`, statsCard(stats, t));
    writeFileSync(`dist/langs${suf}.svg`, langsCard(langs, t));
    writeFileSync(`dist/impact${suf}.svg`, impactCard(impact, t));
    writeFileSync(`dist/streaks${suf}.svg`, streakCard(si, t));
    writeFileSync(`dist/weekdays${suf}.svg`, weekdaysCard(cal.weeks, t));
    writeFileSync(`dist/months${suf}.svg`, monthsCard(cal.weeks, t));
  }
  console.log(`OK: ${cal.totalContributions} contributions, ${langs.length} languages`);
}

if (process.argv[2] === "--demo") {
  const weeks = []; const start = Date.UTC(2025, 10, 16);
  const lv = ["NONE", "FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"];
  for (let w = 0; w < 53; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start + (w * 7 + d) * 864e5).toISOString().slice(0, 10);
      const r = Math.random(); const L = r < 0.7 ? 0 : 1 + Math.floor(Math.random() * 4);
      days.push({ date, weekday: d, contributionCount: L, contributionLevel: lv[L] });
    }
    weeks.push({ contributionDays: days });
  }
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/demo-contributions-dark.svg", render(weeks, 128, "devrafcks", THEMES.dark));
  writeFileSync("dist/demo-contributions.svg", render(weeks, 128, "devrafcks", THEMES.light));
  const T = THEMES.dark;
  writeFileSync("dist/demo-stats.svg", statsCard({ year: 2026, commits: 42, prs: 3, issues: 1, repos: 3, stars: 2, followers: 15 }, T));
  writeFileSync("dist/demo-langs.svg", langsCard([{ name: "Python", color: "#3572A5", size: 50 }, { name: "JavaScript", color: "#f1e05a", size: 30 }, { name: "C++", color: "#f34b7d", size: 12 }, { name: "HTML", color: "#e34c26", size: 8 }, { name: "CSS", color: "#563d7c", size: 5 }], T));
  writeFileSync("dist/demo-impact.svg", impactCard({ merged: 9, reviews: 14, contributedTo: 6, following: 31, orgs: 2, since: 2021 }, T));
  writeFileSync("dist/demo-streaks.svg", streakCard(streakInfo(weeks), T));
  writeFileSync("dist/demo-weekdays.svg", weekdaysCard(weeks, T));
  writeFileSync("dist/demo-months.svg", monthsCard(weeks, T));
} else {
  main().catch((e) => { console.error(e); process.exit(1); });
}
