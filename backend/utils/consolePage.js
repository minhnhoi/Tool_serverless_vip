// utils/consolePage.js
// Returns the HTML for the live PowerShell-style console served at "/".
// Single self-contained page: dark Windows-Terminal aesthetic, parses raw
// ANSI from the backend's stdout mirror, replays history on load and then
// streams new chunks via WebSocket. Includes a live status footer that
// listens for `metrics` events to render CPU / MEM / TEMP / UPTIME bars.
//
// NEW (sidebar): the right-hand panel mirrors the entire ping scheduler —
// job list (status / interval / last latency), a live ping feed, and a
// throughput / error-rate sparkline. Plus assorted "alive" details:
// matrix-rain background, animated heartbeat, packet flight on new pings.

function html() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Tool Ping Serverless \u2014 Console</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
<style>
  :root{
    --bg-deep:#06070a;
    --bg-term:#0c0c0c;
    --bg-term-alt:#101216;
    --chrome:#1b1d22;
    --chrome-line:#2a2d33;
    --fg:#e6e6e6;
    --fg-dim:#9aa0a6;
    --neon-cyan:#00e8ff;
    --neon-aqua:#19d2ff;
    --neon-green:#3bff8f;
    --neon-yellow:#ffe066;
    --neon-orange:#ff8a3d;
    --neon-pink:#ff5ec4;
    --neon-purple:#b58bff;
    --neon-red:#ff5577;
  }
  *{box-sizing:border-box}
  html,body{height:100%;margin:0}
  body{
    background:
      radial-gradient(1200px 700px at 20% -10%, rgba(0,232,255,.10), transparent 60%),
      radial-gradient(900px 600px at 110% 110%, rgba(181,139,255,.09), transparent 60%),
      radial-gradient(700px 500px at 50% 130%, rgba(255,90,196,.05), transparent 60%),
      var(--bg-deep);
    color:var(--fg);
    font-family:"JetBrains Mono","Cascadia Code",Consolas,Menlo,monospace;
    font-size:clamp(11px, 0.85vw, 14px);
    line-height:1.45;
    overflow:hidden;
    -webkit-font-smoothing:antialiased;
  }
  /* global vignette + film-grain noise + chromatic flicker */
  body::before{
    content:""; position:fixed; inset:0; z-index:2; pointer-events:none;
    background:
      radial-gradient(140% 110% at 50% 50%, transparent 70%, rgba(0,0,0,.45) 100%);
    mix-blend-mode:multiply;
  }
  body::after{
    content:""; position:fixed; inset:0; z-index:3; pointer-events:none;
    background-image:
      repeating-linear-gradient(0deg, rgba(255,255,255,.018) 0 1px, transparent 1px 3px);
    mix-blend-mode:overlay;
    opacity:.25;
    animation: gridShift 9s linear infinite;
  }
  @keyframes gridShift{
    from{ background-position:0 0; }
    to  { background-position:0 60px; }
  }
  /* matrix-rain canvas, soft, behind everything */
  #matrix{
    position:fixed; inset:0; z-index:0; pointer-events:none;
    opacity:.22; mix-blend-mode:screen;
  }
  /* RESPONSIVE STAGE — fills entire viewport, scales fluidly */
  #stage{
    position:fixed; inset:0;
    width:100vw; height:100vh;
    z-index:1;
    overflow:hidden;
  }
  .wrap{
    position:relative;
    width:100%; height:100%;
    padding:clamp(8px, 0.9vw, 18px);
    display:grid;
    grid-template-columns: minmax(0,1fr) clamp(260px, 19vw, 360px);
    gap:clamp(8px, 0.8vw, 14px);
  }
  @media (max-width: 980px){
    .wrap{ grid-template-columns: 1fr; grid-template-rows: 1fr auto; }
  }
  .powershell{
    min-height:0;
    display:grid;
    grid-template-columns: minmax(0,1fr) minmax(0,1fr);
    gap:clamp(8px, 0.8vw, 14px);
  }
  @media (max-width: 1280px){
    .powershell{ grid-template-columns: 1fr; }
  }

  /* ---- Demo panel (image 2 — fake server runtime visualisation) ---- */
  .term.demo .titlebar .crumbs b{ color:var(--neon-orange) }
  .demo-screen{
    flex:1; min-height:0;
    overflow:hidden;
    padding:12px 14px 12px;
    background:#050505;
    display:flex; flex-direction:column;
    color:#e6e6e6;
    gap:10px;
  }
  .demo-log{
    flex:0 0 auto;
    max-height:180px;
    overflow:hidden;
    margin:0;
    font-family:inherit;
    font-size:12.5px;
    line-height:1.55;
    white-space:pre;
    color:#bfbfbf;
  }
  .demo-log .ts{ color:#7a7a7a }
  .demo-log .ok{ color:var(--neon-green); font-weight:700 }
  .demo-log .ws{ color:var(--neon-purple); font-weight:700 }
  .demo-log .cron{ color:var(--neon-cyan); font-weight:700 }
  .demo-log .warn{ color:var(--neon-yellow); font-weight:700 }
  .demo-log .tag{ color:var(--neon-aqua) }
  .demo-log .msg{ color:#dcdcdc }

  /* Live counters strip — request totals & rate */
  .demo-stats{
    flex:0 0 auto;
    display:grid;
    grid-template-columns:repeat(5,1fr);
    gap:6px;
    padding:8px 4px;
    border-top:1px dashed #1a1d22;
    border-bottom:1px dashed #1a1d22;
  }
  .demo-stat{
    background:rgba(255,255,255,.012);
    border:1px solid #1a1d22;
    border-radius:6px;
    padding:6px 8px;
    display:flex; flex-direction:column;
    align-items:flex-start;
    gap:2px;
    position:relative; overflow:hidden;
  }
  .demo-stat .k{
    font-size:9.5px; letter-spacing:.16em; text-transform:uppercase;
    color:var(--neon-aqua); font-weight:700;
  }
  .demo-stat .v{
    font-size:15px; color:var(--neon-orange); font-weight:700;
    font-variant-numeric:tabular-nums;
    text-shadow:0 0 10px rgba(255,138,61,.35);
  }
  .demo-stat.ok .v{ color:var(--neon-green); text-shadow:0 0 10px rgba(59,255,143,.35) }
  .demo-stat.err .v{ color:var(--neon-red);  text-shadow:0 0 10px rgba(255,85,119,.4) }
  .demo-stat.rate .v{ color:var(--neon-cyan); text-shadow:0 0 10px rgba(0,232,255,.4) }
  .demo-stat.lat .v{ color:var(--neon-purple); text-shadow:0 0 10px rgba(181,139,255,.4) }
  .demo-stat::after{
    content:""; position:absolute; left:0; right:0; bottom:0; height:2px;
    background:linear-gradient(90deg, transparent, currentColor, transparent);
    color:var(--neon-orange);
    opacity:.4;
  }
  .demo-stat.ok::after{ color:var(--neon-green) }
  .demo-stat.err::after{ color:var(--neon-red) }
  .demo-stat.rate::after{ color:var(--neon-cyan) }
  .demo-stat.lat::after{ color:var(--neon-purple) }

  /* Scrollable realtime telemetry tail */
  .demo-tail-wrap{
    flex:1 1 auto; min-height:0;
    display:flex; flex-direction:column;
    border:1px solid #1a1d22;
    border-radius:6px;
    background:#08090c;
    overflow:hidden;
  }
  .demo-tail-head{
    flex:0 0 auto;
    display:grid;
    grid-template-columns: 64px 1fr 56px 1fr 56px 1fr 56px 1fr 52px;
    gap:6px;
    padding:6px 10px;
    font-size:10px; letter-spacing:.14em; text-transform:uppercase;
    color:var(--neon-aqua); font-weight:700;
    border-bottom:1px solid #1a1d22;
    background:linear-gradient(180deg,#0c0e12,#08090c);
  }
  .demo-tail-head span{ text-align:left }
  .demo-tail-head span.r{ text-align:right }
  .demo-tail{
    flex:1 1 auto; min-height:0;
    overflow-y:auto;
    scrollbar-width:thin;
    scrollbar-color:#2a2d33 transparent;
    padding:4px 6px 8px;
  }
  .demo-tail::-webkit-scrollbar{ width:8px }
  .demo-tail::-webkit-scrollbar-track{ background:transparent }
  .demo-tail::-webkit-scrollbar-thumb{
    background:linear-gradient(180deg,#2a2d33,#1a1d22); border-radius:8px;
  }
  .demo-tail::-webkit-scrollbar-thumb:hover{ background:#3a3d44 }
  .demo-row{
    display:grid;
    grid-template-columns: 64px 1fr 56px 1fr 56px 1fr 56px 1fr 52px;
    align-items:center;
    gap:6px;
    padding:3px 6px;
    font-size:11px;
    line-height:1;
    border-radius:4px;
    animation: rowIn .35s ease;
  }
  .demo-row:hover{ background:rgba(255,255,255,.025) }
  .demo-row:nth-child(odd){ background:rgba(255,255,255,.012) }
  @keyframes rowIn{
    from{ opacity:0; transform:translateY(-4px); background:rgba(0,232,255,.08) }
    to  { opacity:1; transform:translateY(0); }
  }
  .demo-row .tsv{
    color:#7a7a7a; font-variant-numeric:tabular-nums;
    font-size:10.5px;
  }
  .demo-row .blocks{
    display:flex; gap:2px; height:14px;
    overflow:hidden;
  }
  .demo-row .blocks i{
    flex:1 1 auto;
    background:var(--neon-orange);
    transition:opacity .25s linear;
  }
  .demo-row .blocks i.off{ opacity:.12 }
  .demo-row .blocks.cpu i{ background:#ff8a3d }
  .demo-row .blocks.cpu i.hot{ background:#ff5577 }
  .demo-row .blocks.mem i{ background:#ffd233 }
  .demo-row .blocks.mem i.hot{ background:#ff8a3d }
  .demo-row .blocks.req i{ background:#19d2ff }
  .demo-row .blocks.lat i{ background:#3bff8f }
  .demo-row .blocks.lat i.hot{ background:#ffd233 }
  .demo-row .val{
    color:var(--neon-orange);
    font-weight:700;
    text-align:right;
    font-variant-numeric:tabular-nums;
    font-size:11px;
  }
  .demo-row .val.cpu{ color:var(--neon-orange) }
  .demo-row .val.mem{ color:var(--neon-yellow) }
  .demo-row .val.req{ color:var(--neon-cyan) }
  .demo-row .val.lat{ color:var(--neon-green) }
  .demo-row.flash-req{
    animation: rowIn .35s ease, flashReq 1s ease;
  }
  @keyframes flashReq{
    0%   { box-shadow: inset 3px 0 0 var(--neon-cyan), 0 0 12px rgba(0,232,255,.25) }
    100% { box-shadow: inset 3px 0 0 transparent }
  }
  .demo-shutdown{
    flex:0 0 auto;
    font-size:12.5px;
    color:var(--neon-yellow);
    opacity:0; transition:opacity .4s;
  }
  .demo-shutdown.on{ opacity:1 }
  .demo-shutdown .ts{ color:#7a7a7a; margin-right:6px }
  .demo-shutdown .tag{ color:var(--neon-aqua); margin-left:4px }
  .term{
    min-height:0;
    background:linear-gradient(180deg,#0a0c10 0%,#0c0c0c 100%);
    border:1px solid var(--chrome-line);
    border-radius:10px;
    box-shadow:
      0 0 0 1px rgba(255,255,255,.02) inset,
      0 30px 80px rgba(0,0,0,.55),
      0 0 60px rgba(0,232,255,.04);
    display:flex;
    flex-direction:column;
    overflow:hidden;
    position:relative;
  }
  .term::before{
    content:"";
    position:absolute;inset:0;
    background:repeating-linear-gradient(
      to bottom,
      rgba(255,255,255,0) 0px,
      rgba(255,255,255,0) 2px,
      rgba(255,255,255,.018) 3px
    );
    pointer-events:none;
    mix-blend-mode:overlay;
  }
  .titlebar{
    display:flex;align-items:center;gap:14px;
    padding:10px 14px;
    background:linear-gradient(180deg,#16181d,#0f1115);
    border-bottom:1px solid var(--chrome-line);
    user-select:none;
  }
  .lights{display:flex;gap:8px}
  .dot{width:12px;height:12px;border-radius:50%;display:inline-block;box-shadow:0 0 0 1px rgba(0,0,0,.4) inset}
  .dot.r{background:#ff5f57}
  .dot.y{background:#febc2e}
  .dot.g{background:#28c840}
  .tab{
    display:flex;align-items:center;gap:8px;
    padding:5px 14px;
    border-radius:6px 6px 0 0;
    background:#0c0c0c;
    border:1px solid var(--chrome-line);
    border-bottom:none;
    color:var(--fg);
    font-weight:500;
    font-size:12.5px;
    transform:translateY(2px);
  }
  .tab .ico{
    width:14px;height:14px;border-radius:3px;
    background:linear-gradient(135deg,var(--neon-cyan),var(--neon-purple));
    box-shadow:0 0 8px rgba(0,232,255,.6);
  }
  .crumbs{
    margin-left:auto;
    color:var(--fg-dim);
    font-size:12px;
    letter-spacing:.06em;
  }
  .crumbs b{color:var(--neon-green);font-weight:600}
  .pulse{
    width:8px;height:8px;border-radius:50%;
    background:var(--neon-green);
    display:inline-block;margin-right:6px;
    box-shadow:0 0 10px var(--neon-green);
    animation:pulse 1.6s ease-in-out infinite;
    vertical-align:middle;
  }
  @keyframes pulse{
    0%,100%{opacity:1;transform:scale(1)}
    50%{opacity:.45;transform:scale(.85)}
  }
  .screen{
    flex:1;min-height:0;
    overflow:auto;
    padding:14px 18px 22px;
    background:var(--bg-term);
    color:#dcdcdc;
    scrollbar-width:thin;
    scrollbar-color:#2a2d33 transparent;
  }
  .screen::-webkit-scrollbar{width:10px;height:10px}
  .screen::-webkit-scrollbar-thumb{background:#2a2d33;border-radius:10px}
  .screen::-webkit-scrollbar-thumb:hover{background:#3a3d44}
  pre.out{
    margin:0;
    white-space:pre;
    font-family:inherit;
    font-size:13.5px;
    line-height:1.45;
    tab-size:4;
  }
  .caret{
    display:inline-block;
    width:.55em;height:1.05em;
    background:var(--neon-cyan);
    box-shadow:0 0 10px var(--neon-cyan);
    vertical-align:-2px;
    animation:blink 1.05s steps(1) infinite;
    margin-left:4px;
  }
  @keyframes blink{ 50%{opacity:0} }

  /* footer status bar */
  .statusbar{
    display:flex;align-items:center;gap:18px;
    padding:10px 14px;
    background:#0e1014;
    border-top:1px solid var(--chrome-line);
    font-size:12px;
    color:var(--fg-dim);
    flex-wrap:wrap;
  }
  .stat{display:flex;align-items:center;gap:8px}
  .stat .lbl{color:#cdd0d6;font-weight:500;letter-spacing:.05em}
  .stat .val{color:#fff;font-weight:600;min-width:48px;text-align:right}
  .bar{
    width:120px;height:8px;border-radius:4px;
    background:#1a1d22;overflow:hidden;position:relative;
  }
  .bar > i{
    display:block;height:100%;width:0%;
    background:linear-gradient(90deg,var(--neon-green),var(--neon-cyan));
    transition:width .4s ease;
  }
  .bar.warn > i{background:linear-gradient(90deg,var(--neon-yellow),var(--neon-orange))}
  .bar.crit > i{background:linear-gradient(90deg,var(--neon-orange),var(--neon-red))}
  .vital{
    display:grid;
    grid-template-columns: 60px 1fr 70px;
    align-items:center;
    gap:12px;
    padding:10px 4px;
  }
  .vital + .vital{ border-top:1px dashed #1a1d22 }
  .vital .lbl{
    font-size:12px; letter-spacing:.18em; text-transform:uppercase;
    color:#cdd0d6; font-weight:700;
  }
  .vital .bar{ width:100%; height:14px; border-radius:6px; background:#1a1d22; overflow:hidden; position:relative }
  .vital .bar > i{ display:block; height:100%; width:0%;
    background:linear-gradient(90deg,var(--neon-green),var(--neon-cyan));
    transition:width .4s ease;
    box-shadow:0 0 12px rgba(0,232,255,.35);
  }
  .vital .val{
    font-size:14px; color:#fff; font-weight:700;
    text-align:right; font-variant-numeric:tabular-nums;
  }
  .spacer{flex:1}
  .badge{
    display:inline-flex;align-items:center;gap:6px;
    padding:4px 10px;border-radius:999px;
    background:#0a1714;border:1px solid #14352b;color:var(--neon-green);
    font-weight:600;letter-spacing:.06em;font-size:11.5px;
  }
  .badge.off{background:#1a0d10;border-color:#3a1620;color:var(--neon-red)}
  .hint{
    position:absolute;right:14px;top:54px;z-index:5;
    color:var(--fg-dim);font-size:11px;
    background:rgba(12,12,12,.7);
    border:1px solid var(--chrome-line);
    padding:4px 8px;border-radius:6px;
    backdrop-filter:blur(6px);
  }
  .hint b{color:var(--neon-cyan)}

  /* ========== SIDEBAR (Ping Scheduler) ========== */
  .side{
    min-height:0;
    display:flex;
    flex-direction:column;
    gap:12px;
  }
  .panel{
    background:linear-gradient(180deg,rgba(14,16,20,.92),rgba(10,11,14,.92));
    border:1px solid var(--chrome-line);
    border-radius:10px;
    box-shadow:
      0 0 0 1px rgba(255,255,255,.02) inset,
      0 20px 50px rgba(0,0,0,.45),
      0 0 30px rgba(181,139,255,.05);
    backdrop-filter: blur(6px);
    display:flex; flex-direction:column;
    overflow:hidden;
    position:relative;
  }
  .panel::after{
    content:"";
    position:absolute; inset:0;
    background:repeating-linear-gradient(
      to bottom,
      rgba(255,255,255,0) 0px,
      rgba(255,255,255,0) 2px,
      rgba(255,255,255,.012) 3px);
    pointer-events:none;
  }
  .panel .head{
    display:flex; align-items:center; gap:10px;
    padding:9px 12px;
    background:linear-gradient(180deg,#16181d,#0f1115);
    border-bottom:1px solid var(--chrome-line);
    font-size:11.5px; letter-spacing:.18em; text-transform:uppercase;
    color:#cdd0d6;
  }
  .panel .head .heart{
    width:9px;height:9px;border-radius:50%;
    background:var(--neon-pink);
    box-shadow:0 0 12px var(--neon-pink);
    animation:beat 1.1s ease-in-out infinite;
  }
  @keyframes beat{
    0%,100%{transform:scale(1);opacity:1}
    25%    {transform:scale(1.35);opacity:.85}
    50%    {transform:scale(1);opacity:.6}
    75%    {transform:scale(1.2);opacity:.9}
  }
  .panel .head .ttl{ font-weight:700; color:#fff; letter-spacing:.18em }
  .panel .head .sub{ margin-left:auto; color:var(--fg-dim); font-size:11px; letter-spacing:.1em; text-transform:none }
  .panel .body{ padding:10px 12px; }

  /* Scheduler stats grid */
  .sgrid{
    display:grid; grid-template-columns:repeat(4,1fr); gap:8px;
  }
  .scell{
    background:#0a0c10;
    border:1px solid #1d2027;
    border-radius:8px;
    padding:8px 6px;
    text-align:center;
    position:relative; overflow:hidden;
  }
  .scell .n{ font-size:18px; font-weight:700; line-height:1.1 }
  .scell .l{ font-size:10px; color:var(--fg-dim); letter-spacing:.14em; margin-top:3px; text-transform:uppercase }
  .scell.act .n{ color:var(--neon-green); text-shadow:0 0 12px rgba(59,255,143,.45) }
  .scell.dead .n{ color:var(--neon-red); text-shadow:0 0 12px rgba(255,85,119,.45) }
  .scell.pau .n{ color:var(--neon-yellow); text-shadow:0 0 12px rgba(255,224,102,.4) }
  .scell.tot .n{ color:var(--neon-cyan); text-shadow:0 0 12px rgba(0,232,255,.4) }
  .scell::before{
    content:""; position:absolute; left:0; right:0; bottom:0; height:2px;
    background:linear-gradient(90deg, transparent, currentColor, transparent);
    opacity:.35;
  }
  .scell.act::before{ color:var(--neon-green) }
  .scell.dead::before{ color:var(--neon-red) }
  .scell.pau::before{ color:var(--neon-yellow) }
  .scell.tot::before{ color:var(--neon-cyan) }

  /* Throughput / error rate strip */
  .strip{
    display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px; margin-top:10px;
  }
  .kv{ background:#0a0c10; border:1px solid #1d2027; border-radius:8px; padding:8px 10px }
  .kv .k{ font-size:10px; color:var(--fg-dim); letter-spacing:.12em; text-transform:uppercase }
  .kv .v{ font-size:14px; font-weight:700; color:#fff; margin-top:2px }
  .kv .v small{ font-size:10px; color:var(--fg-dim); font-weight:400; margin-left:4px }

  /* sparkline */
  .spark{
    height:42px; margin-top:10px;
    background:#0a0c10; border:1px solid #1d2027; border-radius:8px;
    position:relative; overflow:hidden;
  }
  .spark canvas{ display:block; width:100%; height:100%; }
  .spark .cap{
    position:absolute; left:8px; top:6px; font-size:10px; color:var(--fg-dim);
    letter-spacing:.14em; text-transform:uppercase;
  }

  /* job list */
  .jobs{
    flex:1; min-height:0;
    overflow-y:auto;
    scrollbar-width:thin;
    scrollbar-color:#2a2d33 transparent;
    padding:6px 8px 8px;
  }
  .jobs::-webkit-scrollbar{ width:8px }
  .jobs::-webkit-scrollbar-thumb{ background:#2a2d33; border-radius:8px }
  .jobs .empty{ padding:18px 12px; color:var(--fg-dim); text-align:center; font-size:12px }
  .job{
    display:grid;
    grid-template-columns: 10px 1fr auto;
    gap:8px; align-items:center;
    padding:7px 8px;
    border:1px solid transparent;
    border-radius:6px;
    margin:3px 0;
    background:linear-gradient(90deg,rgba(255,255,255,.014),rgba(255,255,255,0));
    transition:background .25s, border-color .25s;
  }
  .job:hover{ background:rgba(255,255,255,.03); border-color:#222630 }
  .job .led{
    width:9px; height:9px; border-radius:50%;
    box-shadow:0 0 6px currentColor;
  }
  .job.act    .led{ color:var(--neon-green); background:var(--neon-green);  animation: blip 2.4s ease-in-out infinite }
  .job.dead   .led{ color:var(--neon-red);   background:var(--neon-red);    animation: blip 1.2s ease-in-out infinite }
  .job.paused .led{ color:var(--neon-yellow);background:var(--neon-yellow); opacity:.7 }
  .job.checking .led{ color:var(--neon-cyan);background:var(--neon-cyan);   animation: blip 1.6s ease-in-out infinite }
  @keyframes blip{ 0%,100%{box-shadow:0 0 4px currentColor} 50%{box-shadow:0 0 16px currentColor} }

  .job .meta{ min-width:0 }
  .job .name{
    font-size:12.5px; color:#fff; font-weight:600;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .job .url{
    font-size:10.5px; color:var(--fg-dim);
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .job .right{
    text-align:right;
    font-size:10.5px; color:var(--fg-dim);
    line-height:1.3;
  }
  .job .right .rt{ color:#fff; font-weight:600 }
  .job .right .iv{ color:var(--neon-aqua); font-size:10px }

  /* live ping feed */
  .feed{
    max-height:160px; overflow:hidden;
    border-top:1px solid var(--chrome-line);
    background:#08090c;
  }
  .feed .row{
    display:grid; grid-template-columns: 56px 1fr 56px;
    gap:6px; padding:5px 12px;
    font-size:11.5px;
    border-bottom:1px dashed #1a1d22;
    animation: slidein .35s ease;
  }
  @keyframes slidein{
    from{ transform:translateX(8px); opacity:0; background:rgba(0,232,255,.08) }
    to  { transform:translateX(0);   opacity:1; background:transparent }
  }
  .feed .row .t{ color:var(--fg-dim); font-variant-numeric:tabular-nums }
  .feed .row .u{ color:#dcdcdc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
  .feed .row .c{ text-align:right; font-weight:700; font-variant-numeric:tabular-nums }
  .feed .row.up   .c{ color:var(--neon-green) }
  .feed .row.down .c{ color:var(--neon-red) }

  /* ANSI palette spans (ALL inline style; classes only used for cursor/marker) */
  .ln-rewrite{display:contents}

  /* ===================================================================
   * CYBER ANIMATIONS  —  added: animated neon gradient borders, sweep
   * scanline, breathing glow, staggered panel entrance, holographic
   * sheen on the titlebar tab, corner brackets, packet pulses.
   * =================================================================*/

  /* breathing neon glow on every container */
  @keyframes neonBreath{
    0%,100%{
      box-shadow:
        0 0 0 1px rgba(255,255,255,.02) inset,
        0 30px 80px rgba(0,0,0,.55),
        0 0 22px rgba(0,232,255,.06),
        0 0 60px rgba(0,232,255,.04);
    }
    50%{
      box-shadow:
        0 0 0 1px rgba(0,232,255,.08) inset,
        0 30px 80px rgba(0,0,0,.55),
        0 0 38px rgba(0,232,255,.18),
        0 0 90px rgba(181,139,255,.12);
    }
  }
  .term{ animation: neonBreath 4.8s ease-in-out infinite; }
  .panel{ animation: neonBreath 5.6s ease-in-out infinite; }

  /* staggered panel entrance */
  @keyframes panelIn{
    from{ opacity:0; transform:translateY(10px) scale(.985); filter:blur(4px); }
    to  { opacity:1; transform:translateY(0)    scale(1);    filter:blur(0);   }
  }
  .term, .panel{
    animation-name: neonBreath, panelIn;
    animation-duration: 4.8s, .85s;
    animation-timing-function: ease-in-out, cubic-bezier(.22,1,.36,1);
    animation-iteration-count: infinite, 1;
  }
  .panel:nth-of-type(1){ animation-delay: 0s, .05s; }
  .panel:nth-of-type(2){ animation-delay: 0s, .18s; }
  .panel:nth-of-type(3){ animation-delay: 0s, .32s; }
  .panel:nth-of-type(4){ animation-delay: 0s, .46s; }

  /* sweeping scanline inside the terminal viewport */
  .term::after{
    content:"";
    position:absolute; left:0; right:0; top:0; height:90px;
    background:linear-gradient(
      to bottom,
      rgba(0,232,255,0) 0%,
      rgba(0,232,255,.06) 45%,
      rgba(181,139,255,.10) 55%,
      rgba(0,232,255,0) 100%);
    pointer-events:none;
    mix-blend-mode:screen;
    animation: scanSweep 6.5s linear infinite;
  }
  @keyframes scanSweep{
    0%   { transform: translateY(-15%);  opacity:0;   }
    8%   {                               opacity:.9;  }
    92%  {                               opacity:.9;  }
    100% { transform: translateY(110vh); opacity:0;   }
  }

  /* moving conic neon edge — applied as a subtle outline on focusables */
  @keyframes hueSpin{ to{ filter:hue-rotate(360deg) } }

  /* holographic sheen across the titlebar tab */
  .tab{ position:relative; overflow:hidden; }
  .tab::before{
    content:"";
    position:absolute; inset:0;
    background:linear-gradient(110deg,
      transparent 30%, rgba(0,232,255,.18) 50%, transparent 70%);
    transform:translateX(-100%);
    animation: tabSheen 5.5s ease-in-out infinite;
    pointer-events:none;
  }
  @keyframes tabSheen{
    0%,40% { transform: translateX(-100%); }
    60%    { transform: translateX(100%);  }
    100%   { transform: translateX(100%);  }
  }

  /* moving rainbow underline beneath the titlebar */
  .titlebar{ position:relative; }
  .titlebar::after{
    content:"";
    position:absolute; left:0; right:0; bottom:-1px; height:1px;
    background:linear-gradient(90deg,
      transparent, var(--neon-cyan), var(--neon-purple),
      var(--neon-pink), var(--neon-cyan), transparent);
    background-size:200% 100%;
    animation: rainSlide 6s linear infinite;
    opacity:.65;
  }
  @keyframes rainSlide{
    from{ background-position:0% 0; }
    to  { background-position:200% 0; }
  }
  .panel .head{ position:relative; }
  .panel .head::after{
    content:"";
    position:absolute; left:0; right:0; bottom:-1px; height:1px;
    background:linear-gradient(90deg,
      transparent, var(--neon-cyan), var(--neon-aqua), transparent);
    background-size:200% 100%;
    animation: rainSlide 7.5s linear infinite;
    opacity:.55;
  }

  /* corner brackets for each panel — adds a "HUD" look */
  .term, .panel{ --bk:var(--neon-cyan); }
  .term > .corner, .panel > .corner{
    position:absolute; width:14px; height:14px;
    border-color:var(--bk);
    pointer-events:none;
    opacity:.75;
  }
  .corner.tl{ top:6px;    left:6px;    border-top:1px solid;  border-left:1px solid;  }
  .corner.tr{ top:6px;    right:6px;   border-top:1px solid;  border-right:1px solid; }
  .corner.bl{ bottom:6px; left:6px;    border-bottom:1px solid;border-left:1px solid; }
  .corner.br{ bottom:6px; right:6px;   border-bottom:1px solid;border-right:1px solid;}
  .panel.sched{ --bk: var(--neon-pink); }
  .panel.jobs{  --bk: var(--neon-cyan); }
  .panel.feed{  --bk: var(--neon-green); }
  .panel.vit{   --bk: var(--neon-yellow); }

  /* boot ribbon — shown briefly while the preamble replays */
  .boot-ribbon{
    position:absolute; top:54px; left:50%; transform:translateX(-50%);
    z-index:6;
    padding:5px 14px;
    background:linear-gradient(90deg,rgba(0,232,255,.18),rgba(181,139,255,.18));
    border:1px solid rgba(0,232,255,.35);
    border-radius:999px;
    color:#fff; font-size:11px; letter-spacing:.18em; text-transform:uppercase;
    box-shadow:0 0 24px rgba(0,232,255,.35);
    animation: bootBob 1.6s ease-in-out infinite;
    backdrop-filter: blur(6px);
  }
  .boot-ribbon.gone{ opacity:0; transform:translate(-50%,-12px); transition:opacity .6s, transform .6s; }
  .boot-ribbon .dot{
    display:inline-block; width:6px; height:6px; border-radius:50%;
    background:var(--neon-cyan); box-shadow:0 0 10px var(--neon-cyan);
    margin-right:8px; vertical-align:1px;
    animation: pulse 1s ease-in-out infinite;
  }
  @keyframes bootBob{
    0%,100%{ transform:translate(-50%, 0) }
    50%    { transform:translate(-50%, -3px) }
  }

  /* vitals "beat" — bars subtly pulse when value is high */
  .vital .bar > i.beat{ animation: barBeat 1.4s ease-in-out infinite; }
  @keyframes barBeat{
    0%,100%{ box-shadow:0 0 12px rgba(0,232,255,.35) }
    50%    { box-shadow:0 0 22px rgba(255,138,61,.55) }
  }

  /* ===================================================================
   * RUNTIME PROBE  —  refined tech aesthetic, low-cost animations.
   * All filter/drop-shadow/blur/box-shadow loops on per-row/per-cell
   * elements were removed because they compounded across hundreds of
   * nodes (CPU/MEM/REQ/LAT bars × N rows × 60fps) and made the panel
   * feel blurry & laggy. We keep one quiet entry animation per row and
   * a single slow scanline for ambience.
   * =================================================================*/

  /* Header: static neon underline, no filter pulsing */
  .demo-tail-head{
    position:relative;
    color:var(--neon-aqua);
  }
  .demo-tail-head::after{
    content:""; position:absolute; left:0; right:0; bottom:-1px; height:1px;
    background:linear-gradient(90deg,
      transparent, rgba(0,232,255,.55), rgba(181,139,255,.55), transparent);
    opacity:.7;
  }

  /* Row entry: gentle slide-in, no blur / box-shadow burst */
  .demo-row{
    position:relative;
    animation: demoRowIn .25s ease-out;
    will-change:auto;
  }
  @keyframes demoRowIn{
    from{ opacity:0; transform:translateY(-3px); }
    to  { opacity:1; transform:translateY(0); }
  }

  /* Values: solid neon, no animated text-shadow */
  .demo-row .val{ text-shadow:none; }
  .demo-row .val.cpu{ color:#ff8a3d; }
  .demo-row .val.mem{ color:#ffd233; }
  .demo-row .val.req{ color:#19d2ff; }
  .demo-row .val.lat{ color:#3bff8f; }

  /* Tiles: subtle border-only emphasis, no glow loop */
  .demo-stat{ transition:border-color .2s ease; }
  .demo-stat:hover{ border-color:rgba(0,232,255,.35) }

  /* One slow ambience scan over the telemetry pane (cheap: only transform) */
  .demo-tail-wrap{ position:relative; overflow:hidden; }
  .demo-tail-wrap::after{
    content:""; position:absolute; left:0; right:0; top:0; height:32px;
    background:linear-gradient(to bottom,
      rgba(0,232,255,.08), rgba(0,232,255,0) 80%);
    pointer-events:none;
    animation: probeScan 8s linear infinite;
    will-change:transform;
  }
  @keyframes probeScan{
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(1200%); }
  }

  /* --- d) Background particle drift (CSS-only, on body) --- */
  #particles{
    position:fixed; inset:0; z-index:0; pointer-events:none;
    overflow:hidden;
  }
  #particles i{
    position:absolute; bottom:-12px;
    width:3px; height:3px; border-radius:50%;
    background:var(--neon-cyan);
    box-shadow:0 0 8px currentColor;
    opacity:0;
    animation: drift linear infinite;
  }
  @keyframes drift{
    0%   { transform: translate(0,0)  scale(.6); opacity:0; }
    8%   {                                       opacity:.9; }
    92%  {                                       opacity:.9; }
    100% { transform: translate(var(--dx,0px), calc(-100vh - 40px)) scale(1.2); opacity:0; }
  }


  .packet{
    position:absolute; left:-8px; top:50%;
    width:8px; height:8px; border-radius:50%;
    background:var(--neon-green);
    box-shadow:0 0 10px var(--neon-green);
    animation: packetFly 1.2s ease-out forwards;
  }
  .packet.down{ background:var(--neon-red); box-shadow:0 0 10px var(--neon-red); }
  @keyframes packetFly{
    0%   { left:-8px;  opacity:0;  transform:translateY(-50%) scale(.6); }
    20%  {             opacity:1;  }
    100% { left:104%;  opacity:0;  transform:translateY(-50%) scale(1.15); }
  }
  .feed{ position:relative; }
  .feed .row{ position:relative; }
</style>
</head>
<body>
  <canvas id="matrix"></canvas>
  <div id="particles" aria-hidden="true"></div>
  <div id="stage"><div class="wrap">
    <div class="powershell">
    <div class="term" id="term">
      <span class="corner tl"></span><span class="corner tr"></span>
      <span class="corner bl"></span><span class="corner br"></span>
      <div class="titlebar">
        <div class="lights">
          <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        </div>
        <div class="tab"><span class="ico"></span>PowerShell  \u2014  Tool Ping Serverless</div>
        <div class="crumbs"><span class="pulse"></span><b id="ws-state">connecting</b> \u00b7 mirror://process.stdout</div>
      </div>
      <div class="hint">Live mirror of the backend terminal. Press <b>End</b> to follow tail.</div>
      <div class="boot-ribbon" id="boot-ribbon"><span class="dot"></span>BOOT SEQUENCE \u00b7 INITIALISING</div>
      <div class="screen" id="screen"><pre class="out" id="out" data-testid="terminal-output"></pre></div>
    </div>

    <!-- ====== DEMO PANEL (image 2 style) ====== -->
    <div class="term demo" id="term-demo" data-testid="terminal-demo">
      <span class="corner tl"></span><span class="corner tr"></span>
      <span class="corner bl"></span><span class="corner br"></span>
      <div class="titlebar">
        <div class="lights">
          <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        </div>
        <div class="tab"><span class="ico" style="background:linear-gradient(135deg,var(--neon-orange),var(--neon-yellow));box-shadow:0 0 8px rgba(255,138,61,.6)"></span>PowerShell  \u2014  Runtime Probe</div>
        <div class="crumbs"><span class="pulse" style="background:var(--neon-orange);box-shadow:0 0 10px var(--neon-orange)"></span><b>runtime</b> \u00b7 demo://sysprobe</div>
      </div>
      <div class="demo-screen">
        <pre class="demo-log" id="demo-log"></pre>

        <div class="demo-stats" id="demo-stats" data-testid="demo-stats">
          <div class="demo-stat"><div class="k">Requests</div><div class="v" id="ds-total">0</div></div>
          <div class="demo-stat ok"><div class="k">OK</div><div class="v" id="ds-ok">0</div></div>
          <div class="demo-stat err"><div class="k">Errors</div><div class="v" id="ds-err">0</div></div>
          <div class="demo-stat rate"><div class="k">Req / s</div><div class="v" id="ds-rate">0.0</div></div>
          <div class="demo-stat lat"><div class="k">Avg Lat</div><div class="v" id="ds-lat">0<span style="font-size:9px;color:var(--fg-dim);margin-left:3px">ms</span></div></div>
        </div>

        <div class="demo-tail-wrap">
          <div class="demo-tail-head">
            <span>TIME</span>
            <span>CPU</span>
            <span class="r">%</span>
            <span>MEM</span>
            <span class="r">%</span>
            <span>REQ</span>
            <span class="r">N</span>
            <span>LAT</span>
            <span class="r">MS</span>
          </div>
          <div class="demo-tail" id="demo-tail" data-testid="demo-tail">
            <div style="padding:14px;text-align:center;color:var(--fg-dim);font-size:11px" id="demo-tail-empty">Waiting for first telemetry sample…</div>
          </div>
        </div>

        <div class="demo-shutdown" id="demo-shutdown">
          <span class="ts" id="demo-shut-ts"></span><span class="warn" style="color:var(--neon-yellow);font-weight:700">\u26a0 WARN</span><span class="tag">(proc)</span> Received SIGINT, shutting down\u2026
        </div>
      </div>
    </div>
    </div>

    <!-- ========== SIDEBAR ========== -->
    <aside class="side" data-testid="scheduler-side">

      <section class="panel sched" id="panel-sched">
        <span class="corner tl"></span><span class="corner tr"></span>
        <span class="corner bl"></span><span class="corner br"></span>
        <div class="head">
          <span class="heart"></span>
          <span class="ttl">Ping Scheduler</span>
          <span class="sub" id="sched-clock">--:--:--</span>
        </div>
        <div class="body">
          <div class="sgrid" data-testid="scheduler-summary">
            <div class="scell tot"><div class="n" id="sm-total">0</div><div class="l">jobs</div></div>
            <div class="scell act"><div class="n" id="sm-active">0</div><div class="l">active</div></div>
            <div class="scell dead"><div class="n" id="sm-dead">0</div><div class="l">dead</div></div>
            <div class="scell pau"><div class="n" id="sm-paused">0</div><div class="l">paused</div></div>
          </div>

          <div class="strip">
            <div class="kv"><div class="k">Throughput</div><div class="v"><span id="kv-tput">0.00</span><small>req/s</small></div></div>
            <div class="kv"><div class="k">Avg Latency</div><div class="v"><span id="kv-lat">0</span><small>ms</small></div></div>
            <div class="kv"><div class="k">Error rate</div><div class="v"><span id="kv-err">0.0</span><small>%</small></div></div>
          </div>

          <div class="spark" title="Ping latency \u2014 last 60s">
            <span class="cap">Latency \u00b7 60s</span>
            <canvas id="spark-lat"></canvas>
          </div>
        </div>
      </section>

      <section class="panel jobs" style="flex:1; min-height:0">
        <span class="corner tl"></span><span class="corner tr"></span>
        <span class="corner bl"></span><span class="corner br"></span>
        <div class="head">
          <span class="heart" style="background:var(--neon-cyan);box-shadow:0 0 12px var(--neon-cyan)"></span>
          <span class="ttl">Scheduled Jobs</span>
          <span class="sub" id="jobs-count">0</span>
        </div>
        <div class="jobs" id="jobs" data-testid="scheduler-jobs">
          <div class="empty">Waiting for scheduler\u2026</div>
        </div>
      </section>

      <section class="panel feed">
        <span class="corner tl"></span><span class="corner tr"></span>
        <span class="corner bl"></span><span class="corner br"></span>
        <div class="head">
          <span class="heart" style="background:var(--neon-green);box-shadow:0 0 12px var(--neon-green)"></span>
          <span class="ttl">Live Ping Feed</span>
          <span class="sub" id="feed-rate">0 req/s</span>
        </div>
        <div class="feed" id="feed" data-testid="scheduler-feed"></div>
      </section>

      <section class="panel vit">
        <span class="corner tl"></span><span class="corner tr"></span>
        <span class="corner bl"></span><span class="corner br"></span>
        <div class="head">
          <span class="heart" style="background:var(--neon-yellow);box-shadow:0 0 12px var(--neon-yellow)"></span>
          <span class="ttl">System Vitals</span>
          <span class="sub"><span class="badge" id="badge-status" data-testid="badge-status" style="padding:2px 8px;font-size:10px"><span class="pulse"></span>RUNNING</span></span>
        </div>
        <div class="body" data-testid="status-bar">
          <div class="vital"><span class="lbl">CPU</span><div class="bar" id="bar-cpu"><i></i></div><span class="val" id="val-cpu">--%</span></div>
          <div class="vital"><span class="lbl">MEM</span><div class="bar" id="bar-mem"><i></i></div><span class="val" id="val-mem">--%</span></div>
          <div class="vital"><span class="lbl">TEMP</span><div class="bar" id="bar-temp"><i></i></div><span class="val" id="val-temp">--\u00b0C</span></div>
          <div class="vital"><span class="lbl">UP</span><div class="bar" style="visibility:hidden"><i></i></div><span class="val" id="val-up">--s</span></div>
        </div>
      </section>
    </aside>
  </div></div>

<script>
/* ============================================================
 * Responsive stage — CSS handles all sizing now. JS only kicks
 * a resize event so canvas-based widgets (matrix rain, sparkline)
 * re-measure their backing store on viewport changes.
 * ============================================================ */
(function fitStage(){
  function apply(){ window.dispatchEvent(new Event("stage:resized")); }
  apply();
  window.addEventListener("resize", apply);
  window.visualViewport && window.visualViewport.addEventListener("resize", apply);
})();
/* ============================================================
 * Particle drift field — drifts neon dots upward across the bg
 * ============================================================ */
(function particleField(){
  const root = document.getElementById("particles");
  if (!root) return;
  const COLORS = ["#00e8ff","#b58bff","#3bff8f","#ff5ec4","#ffe066","#ff8a3d"];
  const N = 36;
  for (let i = 0; i < N; i++){
    const p = document.createElement("i");
    const dur = (8 + Math.random() * 14).toFixed(1) + "s";
    const delay = (-Math.random() * 18).toFixed(1) + "s";
    const left = (Math.random() * 100).toFixed(2) + "vw";
    const size = (2 + Math.random() * 3).toFixed(1) + "px";
    const dx = ((Math.random() - 0.5) * 200).toFixed(0) + "px";
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    p.style.cssText =
      "left:" + left + ";width:" + size + ";height:" + size +
      ";background:" + color + ";color:" + color +
      ";--dx:" + dx + ";animation-duration:" + dur +
      ";animation-delay:" + delay + ";";
    root.appendChild(p);
  }
})();
/* ============================================================
 * ANSI \u2192 HTML renderer
 * (unchanged from previous version)
 * ============================================================ */
const PALETTE_16 = [
  "#0c0c0c","#c50f1f","#13a10e","#c19c00",
  "#0037da","#881798","#3a96dd","#cccccc",
  "#767676","#e74856","#16c60c","#f9f1a5",
  "#3b78ff","#b4009e","#61d6d6","#f2f2f2"
];
function color256(n){
  if (n < 16) return PALETTE_16[n];
  if (n >= 232){
    const v = 8 + (n - 232) * 10;
    return "rgb("+v+","+v+","+v+")";
  }
  const i = n - 16;
  const r = Math.floor(i / 36);
  const g = Math.floor((i % 36) / 6);
  const b = i % 6;
  const conv = (x) => x === 0 ? 0 : 55 + x * 40;
  return "rgb(" + conv(r) + "," + conv(g) + "," + conv(b) + ")";
}

const out = document.getElementById("out");
const screen = document.getElementById("screen");
let lines = [""];
let style = freshStyle();
function freshStyle(){
  return { color:null, bold:false, dim:false, italic:false, underline:false };
}

function escapeHtml(s){
  return s.replace(/[&<>]/g, ch => ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : "&gt;");
}

function renderAll(){
  const html = lines.map(line => renderLine(line)).join("\\n");
  out.innerHTML = html + '<span class="caret"></span>';
}
function renderLine(line){
  let st = freshStyle();
  let html = "";
  let i = 0;
  let buf = "";
  const flush = () => {
    if (!buf) return;
    html += wrap(buf, st);
    buf = "";
  };
  while (i < line.length){
    const ch = line.charCodeAt(i);
    if (ch === 0x1b && line[i+1] === "["){
      flush();
      const end = line.indexOf("m", i + 2);
      const endK = line.indexOf("K", i + 2);
      const endJ = line.indexOf("J", i + 2);
      const endH = line.indexOf("H", i + 2);
      const candidates = [end, endK, endJ, endH].filter(x => x !== -1);
      if (!candidates.length) { i = line.length; break; }
      const term = Math.min.apply(null, candidates);
      const seq = line.slice(i + 2, term);
      const final = line[term];
      if (final === "m") applySgr(seq, st);
      i = term + 1;
    } else {
      buf += line[i];
      i++;
    }
  }
  flush();
  return html;
}
function applySgr(seq, st){
  const parts = (seq === "" ? "0" : seq).split(";").map(x => x === "" ? 0 : Number(x));
  for (let k = 0; k < parts.length; k++){
    const code = parts[k];
    if (code === 0){ Object.assign(st, freshStyle()); }
    else if (code === 1){ st.bold = true; }
    else if (code === 2){ st.dim = true; }
    else if (code === 3){ st.italic = true; }
    else if (code === 4){ st.underline = true; }
    else if (code === 22){ st.bold = false; st.dim = false; }
    else if (code === 23){ st.italic = false; }
    else if (code === 24){ st.underline = false; }
    else if (code === 39){ st.color = null; }
    else if (code >= 30 && code <= 37){ st.color = PALETTE_16[code - 30]; }
    else if (code >= 90 && code <= 97){ st.color = PALETTE_16[code - 90 + 8]; }
    else if (code === 38){
      const mode = parts[k+1];
      if (mode === 5){ st.color = color256(parts[k+2] || 0); k += 2; }
      else if (mode === 2){
        const r = parts[k+2]||0, g = parts[k+3]||0, b = parts[k+4]||0;
        st.color = "rgb("+r+","+g+","+b+")";
        k += 4;
      }
    }
  }
}
function wrap(text, st){
  let css = "";
  if (st.color)     css += "color:" + st.color + ";";
  if (st.bold)      css += "font-weight:700;";
  if (st.dim)       css += "opacity:.78;";
  if (st.italic)    css += "font-style:italic;";
  if (st.underline) css += "text-decoration:underline;";
  return css ? '<span style="'+css+'">'+escapeHtml(text)+'</span>' : escapeHtml(text);
}

function feed(chunk){
  let i = 0;
  while (i < chunk.length){
    const ch = chunk[i];
    if (ch === "\\x1b" && chunk[i+1] === "["){
      const m = chunk.slice(i).match(/^\\x1b\\[(?:\\d+(?:;\\d+)*)?[A-Za-z]/);
      if (m){
        const seq = m[0];
        const final = seq[seq.length - 1];
        if (final === "J" && (seq === "\\x1b[2J" || seq === "\\x1b[J")){
          lines = [""];
          i += seq.length;
          continue;
        }
        if (final === "H"){
          i += seq.length;
          continue;
        }
        lines[lines.length - 1] += seq;
        i += seq.length;
        continue;
      }
    }
    if (ch === "\\n"){ lines.push(""); i++; continue; }
    if (ch === "\\r"){ lines[lines.length - 1] = ""; i++; continue; }
    lines[lines.length - 1] += ch;
    i++;
  }
  if (lines.length > 4000){
    lines = lines.slice(lines.length - 3000);
  }
  scheduleRender();
}
let rafPending = false;
function scheduleRender(){
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const wasNearBottom =
      screen.scrollTop + screen.clientHeight >= screen.scrollHeight - 60;
    renderAll();
    if (wasNearBottom){
      screen.scrollTop = screen.scrollHeight;
    }
  });
}

/* ============================================================
 * BOOT REPLAY  —  animates the captured preamble chunks at their
 * original cadence so every page load feels like a fresh boot.
 * ============================================================ */
let BOOT_REPLAYING = false;
let BOOT_PENDING_LIVE = "";   // live chunks that arrive while we're replaying
const bootRibbon = document.getElementById("boot-ribbon");

function hideBootRibbon(){
  if (!bootRibbon) return;
  bootRibbon.classList.add("gone");
  setTimeout(() => bootRibbon.remove(), 700);
}

async function playPreamble(chunks){
  if (!chunks || !chunks.length){
    hideBootRibbon();
    return;
  }
  BOOT_REPLAYING = true;
  lines = [""];
  style = freshStyle();
  // total time budget: cap each delay so a long boot replays in <= ~6s.
  for (let i = 0; i < chunks.length; i++){
    const c = chunks[i];
    const dt = Math.max(0, Math.min(c.dt || 0, 60));
    if (dt) await new Promise(r => setTimeout(r, dt));
    feed(c.text);
  }
  BOOT_REPLAYING = false;
  hideBootRibbon();
  // flush anything that arrived during the replay
  if (BOOT_PENDING_LIVE){
    feed(BOOT_PENDING_LIVE);
    BOOT_PENDING_LIVE = "";
  }
}
function liveFeed(text){
  if (BOOT_REPLAYING){ BOOT_PENDING_LIVE += text; return; }
  feed(text);
}

/* ============================================================
 * Status footer (CPU / MEM / TEMP / UP)
 * ============================================================ */
function setBar(id, ratio){
  const el = document.getElementById(id);
  if (!el) return;
  const r = Math.max(0, Math.min(1, ratio));
  el.classList.remove("warn","crit");
  if (r >= .8) el.classList.add("crit");
  else if (r >= .55) el.classList.add("warn");
  el.firstElementChild.style.width = (r * 100).toFixed(1) + "%";
}
function applyMetrics(m){
  if (!m) return;
  setBar("bar-cpu", (m.cpu || 0) / 100);
  document.getElementById("val-cpu").textContent = (m.cpu || 0).toFixed(1) + "%";
  const memRatio = m.memory && m.memory.ratio ? m.memory.ratio / 100 : 0;
  setBar("bar-mem", memRatio);
  document.getElementById("val-mem").textContent =
    (m.memory && m.memory.ratio ? m.memory.ratio.toFixed(1) : "0") + "%";
  const tempRatio = Math.max(0, Math.min(1, ((m.temperature || 0) - 25) / 60));
  setBar("bar-temp", tempRatio);
  document.getElementById("val-temp").textContent = (m.temperature || 0).toFixed(1) + "\u00b0C";
  document.getElementById("val-up").textContent = (m.uptime || 0) + "s";
  // Also feed the live dashboard widget at the top of the middle panel.
  if (typeof window.applyDemoVitals === "function") window.applyDemoVitals(m);
}

/* ============================================================
 * SCHEDULER SIDEBAR
 * ============================================================ */
const $ = (id) => document.getElementById(id);
let LATENCY_HISTORY = []; // last 60 latency samples
let RECENT_PINGS = [];    // last 50 ping events
let JOB_BY_URL = new Map();

function fmtTime(ts){
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour12:false });
}
function shortUrl(u){
  if (!u) return "";
  try {
    const p = new URL(u);
    return p.host + (p.pathname === "/" ? "" : p.pathname);
  } catch { return u; }
}
function ago(ts){
  if (!ts) return "\u2014";
  const s = Math.max(0, Math.round((Date.now() - new Date(ts).getTime())/1000));
  if (s < 60) return s + "s";
  if (s < 3600) return Math.round(s/60) + "m";
  return Math.round(s/3600) + "h";
}
function applySchedulerSummary(s){
  if (!s) return;
  $("sm-total").textContent  = s.total  || 0;
  $("sm-active").textContent = s.active || 0;
  $("sm-dead").textContent   = s.dead   || 0;
  $("sm-paused").textContent = s.paused || 0;
  $("jobs-count").textContent = (s.total || 0) + " jobs";
}
function renderJobs(jobs){
  const root = $("jobs");
  if (!jobs || jobs.length === 0){
    root.innerHTML = '<div class="empty">No scheduled jobs yet.<br><span style="opacity:.6">Add one from the dashboard.</span></div>';
    return;
  }
  JOB_BY_URL.clear();
  jobs.forEach(j => JOB_BY_URL.set(j.url, j));
  const order = { active:0, checking:1, dead:2, paused:3 };
  const sorted = jobs.slice().sort((a,b) => (order[a.status]??9) - (order[b.status]??9));
  root.innerHTML = sorted.map(j => {
    const cls = j.status === "active" ? "act"
              : j.status === "dead"   ? "dead"
              : j.status === "paused" ? "paused"
              : "checking";
    const name = j.name || shortUrl(j.url);
    const rt = j.lastResponseTime ? j.lastResponseTime + "ms" : "\u2014";
    return ''
      + '<div class="job ' + cls + '" data-url="' + escapeHtml(j.url) + '">'
      +   '<span class="led"></span>'
      +   '<div class="meta">'
      +     '<div class="name">' + escapeHtml(name) + '</div>'
      +     '<div class="url">' + escapeHtml(shortUrl(j.url)) + '</div>'
      +   '</div>'
      +   '<div class="right">'
      +     '<div class="rt">' + escapeHtml(rt) + '</div>'
      +     '<div class="iv">' + (j.interval || 1) + 'm \u00b7 ' + ago(j.lastChecked) + '</div>'
      +   '</div>'
      + '</div>';
  }).join("");
}
function flashJob(url, status){
  const root = $("jobs");
  if (!root) return;
  const el = root.querySelector('.job[data-url="' + (window.CSS && CSS.escape ? CSS.escape(url) : url.replace(/"/g,'\\\\"')) + '"]');
  if (!el) return;
  el.style.transition = "background .2s, box-shadow .2s";
  el.style.background = status === "up" ? "rgba(59,255,143,.10)" : "rgba(255,85,119,.12)";
  el.style.boxShadow  = status === "up" ? "inset 0 0 0 1px rgba(59,255,143,.45)" : "inset 0 0 0 1px rgba(255,85,119,.45)";
  setTimeout(() => {
    el.style.background = "";
    el.style.boxShadow  = "";
  }, 700);
}
function pushFeed(p){
  const root = $("feed");
  if (!root) return;
  const cls = p.status === "up" ? "up" : "down";
  const code = p.statusCode ? p.statusCode : (p.status === "up" ? "OK" : "ERR");
  const row = document.createElement("div");
  row.className = "row " + cls;
  row.innerHTML =
      '<span class="t">' + fmtTime(p.timestamp) + '</span>'
    + '<span class="u" title="' + escapeHtml(p.url || "") + '">' + escapeHtml(shortUrl(p.url || "")) + '</span>'
    + '<span class="c">' + escapeHtml(String(code)) + '</span>';
  root.insertBefore(row, root.firstChild);
  while (root.children.length > 24) root.removeChild(root.lastChild);
}
function firePacket(status){
  const root = $("feed");
  if (!root) return;
  const p = document.createElement("span");
  p.className = "packet" + (status === "up" ? "" : " down");
  root.appendChild(p);
  setTimeout(() => p.remove(), 1200);
}
function applyLatencySample(sample){
  if (!sample) return;
  LATENCY_HISTORY.push(sample);
  if (LATENCY_HISTORY.length > 60) LATENCY_HISTORY = LATENCY_HISTORY.slice(-60);
  $("kv-tput").textContent = (sample.throughput || 0).toFixed(2);
  $("kv-lat").textContent  = sample.latency || 0;
  $("kv-err").textContent  = (sample.errorRate || 0).toFixed(1);
  $("feed-rate").textContent = (sample.throughput || 0).toFixed(2) + " req/s";
  drawSpark();
}

/* ----- sparkline canvas ----- */
const sparkCv = $("spark-lat");
const sparkCtx = sparkCv.getContext("2d");
function drawSpark(){
  const dpr = window.devicePixelRatio || 1;
  const w = sparkCv.clientWidth, h = sparkCv.clientHeight;
  if (sparkCv.width !== w*dpr || sparkCv.height !== h*dpr){
    sparkCv.width = w*dpr; sparkCv.height = h*dpr;
    sparkCtx.setTransform(dpr,0,0,dpr,0,0);
  }
  sparkCtx.clearRect(0,0,w,h);
  if (LATENCY_HISTORY.length < 2) return;
  const vals = LATENCY_HISTORY.map(s => s.latency || 0);
  const max = Math.max(50, ...vals);
  const stepX = w / (LATENCY_HISTORY.length - 1);
  // gradient line
  const grad = sparkCtx.createLinearGradient(0,0,w,0);
  grad.addColorStop(0,  "#3bff8f");
  grad.addColorStop(.6, "#00e8ff");
  grad.addColorStop(1,  "#b58bff");
  sparkCtx.beginPath();
  vals.forEach((v,i) => {
    const x = i * stepX;
    const y = h - (v / max) * (h - 8) - 4;
    if (i === 0) sparkCtx.moveTo(x,y); else sparkCtx.lineTo(x,y);
  });
  sparkCtx.lineTo(w, h);
  sparkCtx.lineTo(0, h);
  sparkCtx.closePath();
  sparkCtx.fillStyle = "rgba(0,232,255,.10)";
  sparkCtx.fill();
  sparkCtx.beginPath();
  vals.forEach((v,i) => {
    const x = i * stepX;
    const y = h - (v / max) * (h - 8) - 4;
    if (i === 0) sparkCtx.moveTo(x,y); else sparkCtx.lineTo(x,y);
  });
  sparkCtx.lineWidth = 1.6;
  sparkCtx.strokeStyle = grad;
  sparkCtx.shadowColor = "rgba(0,232,255,.4)";
  sparkCtx.shadowBlur = 6;
  sparkCtx.stroke();
  sparkCtx.shadowBlur = 0;
}
window.addEventListener("resize", drawSpark);

/* clock in panel header */
setInterval(() => {
  $("sched-clock").textContent = new Date().toLocaleTimeString("en-GB",{hour12:false});
}, 1000);

/* periodic refresh of scheduler snapshot (jobs change rarely) */
async function refreshScheduler(){
  try {
    const r = await fetch("/api/system/scheduler", { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    if (j.summary) applySchedulerSummary(j.summary);
    if (Array.isArray(j.jobs)) renderJobs(j.jobs);
    if (Array.isArray(j.pingsRecent)){
      // hydrate feed in chronological order (oldest first \u2192 prepend latest)
      const list = j.pingsRecent.slice().sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
      const root = $("feed");
      root.innerHTML = "";
      list.forEach(p => pushFeed(p));
      // Seed the Runtime Probe counters with real history exactly once.
      if (!window.__demoHydrated && typeof window.__demoHydratePings === "function"){
        window.__demoHydratePings(j.pingsRecent);
        window.__demoHydrated = true;
      }
    }
    if (Array.isArray(j.latency)){
      LATENCY_HISTORY = j.latency.slice(-60);
      const last = LATENCY_HISTORY[LATENCY_HISTORY.length-1];
      if (last){
        applyLatencySample(last);
        if (typeof window.__demoApplyLatency === "function") window.__demoApplyLatency(last);
      }
      drawSpark();
    }
  } catch (e) { /* offline; live WS will keep things flowing */ }
}
setInterval(refreshScheduler, 15000);

/* ============================================================
 * MATRIX-RAIN background (subtle, eye-candy)
 * ============================================================ */
(function matrixRain(){
  const cv = document.getElementById("matrix");
  const cx = cv.getContext("2d");
  let cols = 0, drops = [], W = 0, H = 0;
  const GLYPHS = "01\u2502\u2500\u250c\u2510\u2514\u2518PINGCRONv\u00b7\u22c5\u25cf\u2261\u2245\u2248";
  function size(){
    W = cv.width  = window.innerWidth;
    H = cv.height = window.innerHeight;
    cols = Math.floor(W / 14);
    drops = new Array(cols).fill(0).map(() => Math.random() * H / 14);
  }
  size();
  window.addEventListener("resize", size);
  function frame(){
    cx.fillStyle = "rgba(6,7,10,.18)";
    cx.fillRect(0,0,W,H);
    cx.font = "12px JetBrains Mono, monospace";
    for (let i = 0; i < cols; i++){
      const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      const x = i * 14;
      const y = drops[i] * 14;
      const t = (Math.sin((Date.now()/2000)+i) + 1) / 2;
      cx.fillStyle = "rgba(0,232,255," + (.18 + .35 * t) + ")";
      cx.fillText(ch, x, y);
      if (y > H && Math.random() > .975) drops[i] = 0;
      drops[i] += 1;
    }
    requestAnimationFrame(frame);
  }
  frame();
})();

/* ============================================================
 * Hydrate from /api/system/terminal then live-stream over WS
 * ============================================================ */
async function hydrate(){
  let preamble = null;
  let liveStr = null;
  try {
    const r = await fetch("/api/system/terminal");
    if (r.ok){
      const j = await r.json();
      if (Array.isArray(j.preamble)) preamble = j.preamble;
      if (typeof j.live === "string") liveStr = j.live;
      if (preamble == null && typeof j.terminal === "string"){
        // back-compat: flat string only
        liveStr = j.terminal;
      }
      if (j && j.metrics) applyMetrics(j.metrics);
      if (j && Array.isArray(j.pingsRecent)){
        j.pingsRecent.slice().sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp))
          .forEach(p => pushFeed(p));
        // Seed Runtime Probe counters from the public terminal endpoint
        // as well, in case the scheduler refresh hasn't fired yet.
        if (!window.__demoHydrated && typeof window.__demoHydratePings === "function"){
          window.__demoHydratePings(j.pingsRecent);
          window.__demoHydrated = true;
        }
      }
    }
  } catch (e){ /* page also hydrates from WS snapshot */ }

  // Play boot animation, then append the live rolling buffer.
  await playPreamble(preamble || []);
  if (liveStr) feed(liveStr);

  await refreshScheduler();
}

function connect(){
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const url = proto + "://" + location.host + "/ws";
  const ws = new WebSocket(url);
  const stateEl = document.getElementById("ws-state");
  const badge = document.getElementById("badge-status");

  ws.addEventListener("open", () => {
    stateEl.textContent = "live";
    badge.classList.remove("off");
    badge.innerHTML = '<span class="pulse"></span>RUNNING';
  });
  ws.addEventListener("close", () => {
    stateEl.textContent = "reconnecting\u2026";
    badge.classList.add("off");
    badge.innerHTML = '<span class="pulse"></span>OFFLINE';
    setTimeout(connect, 1500);
  });
  ws.addEventListener("error", () => { try { ws.close(); } catch(_){} });
  ws.addEventListener("message", async (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (m.type === "snapshot"){
      const d = m.data || {};
      // Don't reset terminal if we've already replayed a boot — the
      // WS snapshot arrives shortly after the HTTP hydrate.
      if (Array.isArray(d.preamble) || typeof d.live === "string"){
        if (Array.isArray(d.preamble) && d.preamble.length && !out.textContent.trim()){
          await playPreamble(d.preamble);
        }
        if (typeof d.live === "string" && d.live){
          // append live rolling buffer (avoid double-render if already there)
          if (out.textContent.indexOf(d.live.slice(-200)) === -1){
            feed(d.live);
          }
        }
      } else if (typeof d.terminal === "string" && !out.textContent.trim()){
        feed(d.terminal);
      }
      const lastMetric = d.metrics && d.metrics.length ? d.metrics[d.metrics.length-1] : null;
      if (lastMetric) applyMetrics(lastMetric);
      if (Array.isArray(d.latency)){
        LATENCY_HISTORY = d.latency.slice(-60);
        const last = LATENCY_HISTORY[LATENCY_HISTORY.length-1];
        if (last){
          applyLatencySample(last);
          if (typeof window.__demoApplyLatency === "function") window.__demoApplyLatency(last);
        }
        drawSpark();
      }
      if (Array.isArray(d.pings) && !window.__demoHydrated
          && typeof window.__demoHydratePings === "function"){
        window.__demoHydratePings(d.pings);
        window.__demoHydrated = true;
      }
    } else if (m.type === "terminal"){
      const d = m.data || {};
      if (typeof d.chunk === "string") liveFeed(d.chunk);
    } else if (m.type === "metrics"){
      applyMetrics(m.data);
    } else if (m.type === "ping"){
      const p = m.data || {};
      pushFeed(p);
      flashJob(p.url, p.status);
      firePacket(p.status);
      if (typeof window.__demoRecordPing === "function") window.__demoRecordPing(p);
    } else if (m.type === "latency"){
      applyLatencySample(m.data);
      if (typeof window.__demoApplyLatency === "function") window.__demoApplyLatency(m.data);
    }
  });
}

hydrate().then(connect);

/* ============================================================
 * DEMO RUNTIME PANEL  —  realtime telemetry tail
 * Top: scrolling event log (small).
 * Middle: live counters (total requests / ok / err / rate / avg latency).
 * Bottom: a scrollable list of telemetry rows. Each row is one snapshot
 *         containing CPU / MEM / REQ / LAT bars, appended on every metric
 *         tick (~1s). Auto-sticks to bottom unless the user scrolls up.
 * ============================================================ */
(function demoRuntime(){
  const logEl   = document.getElementById("demo-log");
  const tailEl  = document.getElementById("demo-tail");
  const emptyEl = document.getElementById("demo-tail-empty");
  const shutEl  = document.getElementById("demo-shutdown");
  const shutTs  = document.getElementById("demo-shut-ts");
  if (!logEl || !tailEl) return;

  function pad(n){ return String(n).padStart(2,"0") }
  function ts(d){
    d = d || new Date();
    return "[" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) + "]";
  }
  function fmtClock(d){
    d = d || new Date();
    return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }

  /* ---------- log scroller (top) ---------- */
  const LOG_CAP = 6;
  const logLines = [];
  function pushLog(html){
    logLines.push(html);
    while (logLines.length > LOG_CAP) logLines.shift();
    logEl.innerHTML = logLines.join("\\n");
  }
  const PORT = 4000 + Math.floor(Math.random()*2000);
  const seedEvents = [
    () => '<span class="ts">' + ts() + '</span> <span class="ok">\u2713 OK</span>   <span class="tag">(http)</span> <span class="msg">Server listening on port ' + PORT + '</span>',
    () => '<span class="ts">' + ts() + '</span> <span class="ws">\u21b3 ES</span>   <span class="tag">(ws)</span>   <span class="msg">WebSocket bus available at ws://localhost:' + PORT + '/ws</span>',
    () => '<span class="ts">' + ts() + '</span> <span class="ok">\u2713 OK</span>   <span class="tag">(ui)</span>   <span class="msg">Live console UI at http://localhost:' + PORT + '/</span>',
    () => '<span class="ts">' + ts() + '</span> <span class="cron">\u21ba CRON</span> <span class="tag">(cron)</span> <span class="msg">Per-job ping timers active \u2014 interval driven by frontend setup</span>',
  ];
  seedEvents.forEach((mk,i) => setTimeout(() => pushLog(mk()), 250 + i*420));
  setInterval(() => {
    if (DEMO_SHUTDOWN) return;
    const live = [
      () => '<span class="ts">' + ts() + '</span> <span class="ok">\u2713 OK</span>   <span class="tag">(http)</span> <span class="msg">GET /api/system/health \u2192 200 ' + (4 + Math.floor(Math.random()*40)) + 'ms</span>',
      () => '<span class="ts">' + ts() + '</span> <span class="cron">\u21ba CRON</span> <span class="tag">(cron)</span> <span class="msg">tick \u00b7 next sweep in ' + (15 + Math.floor(Math.random()*120)) + 's</span>',
      () => '<span class="ts">' + ts() + '</span> <span class="ws">\u21b3 ES</span>   <span class="tag">(ws)</span>   <span class="msg">broadcast metrics \u2192 ' + (1 + Math.floor(Math.random()*3)) + ' subscriber(s)</span>',
    ];
    pushLog(live[Math.floor(Math.random()*live.length)]());
  }, 2200);

  /* ---------- live counters (middle strip) ---------- */
  const dsTotal = document.getElementById("ds-total");
  const dsOk    = document.getElementById("ds-ok");
  const dsErr   = document.getElementById("ds-err");
  const dsRate  = document.getElementById("ds-rate");
  const dsLat   = document.getElementById("ds-lat");
  const PINGS_BUCKET = []; // {t, ok, lat}
  let totalReq = 0, totalOk = 0, totalErr = 0;
  let reqDeltaSinceTick = 0; // request count to push into next tail row

  function recordPing(p){
    if (!p) return;
    totalReq += 1;
    reqDeltaSinceTick += 1;
    const ok = p.status === "up";
    if (ok) totalOk += 1; else totalErr += 1;
    PINGS_BUCKET.push({ t: Date.now(), ok, lat: p.responseTime || 0 });
    refreshCounters();
  }
  // Hydrate counters & bucket from server-side ping history (chronological).
  // Called once on initial page load via /api/system/scheduler so the
  // panel reflects real activity instead of starting from zero.
  function hydratePings(list){
    if (!Array.isArray(list) || !list.length) return;
    const sorted = list.slice().sort(
      (a,b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
    for (const p of sorted){
      const ok = p.status === "up";
      totalReq += 1;
      if (ok) totalOk += 1; else totalErr += 1;
      const tms = new Date(p.timestamp).getTime() || Date.now();
      PINGS_BUCKET.push({ t: tms, ok, lat: p.responseTime || 0 });
    }
    refreshCounters();
  }
  window.__demoHydratePings = hydratePings;
  // Bind to the server-side latency aggregator so REQ/S and AVG LAT are
  // driven by the same numbers shown in the sidebar (instead of the
  // local 10s rolling window which is empty on a fresh load).
  function applyServerLatency(s){
    if (!s) return;
    if (typeof s.throughput === "number"){
      dsRate.textContent = s.throughput.toFixed(2);
    }
    if (typeof s.latency === "number" && s.latency > 0){
      dsLat.innerHTML = s.latency
        + '<span style="font-size:9px;color:var(--fg-dim);margin-left:3px">ms</span>';
    }
  }
  window.__demoApplyLatency = applyServerLatency;
  function refreshCounters(){
    const now = Date.now();
    while (PINGS_BUCKET.length && (now - PINGS_BUCKET[0].t) > 60000) PINGS_BUCKET.shift();
    const last10s = PINGS_BUCKET.filter(x => now - x.t <= 10000);
    const rate = last10s.length / 10;
    const lats = PINGS_BUCKET.filter(x => x.lat > 0).map(x => x.lat);
    const avgLat = lats.length ? Math.round(lats.reduce((a,b) => a+b, 0) / lats.length) : 0;
    dsTotal.textContent = totalReq;
    dsOk.textContent    = totalOk;
    dsErr.textContent   = totalErr;
    dsRate.textContent  = rate.toFixed(2);
    dsLat.innerHTML     = avgLat + '<span style="font-size:9px;color:var(--fg-dim);margin-left:3px">ms</span>';
  }
  setInterval(refreshCounters, 1000);
  // Hook into the global ping pipeline.
  const _origPushFeed = window.pushFeed;
  if (typeof _origPushFeed !== "function"){
    // pushFeed is declared in the outer scope (not on window); patch via
    // window.__onPing dispatched at the WS handler below as a safety net.
  }
  window.__demoRecordPing = recordPing;

  /* ---------- telemetry tail (scrollable list) ---------- */
  const TAIL_CAP = 240;
  const BLOCKS = 12;
  function buildBlockRow(parent){
    parent.innerHTML = "";
    for (let i=0;i<BLOCKS;i++) parent.appendChild(document.createElement("i"));
  }
  function setBlocks(parent, ratio, hotAt){
    const r = Math.max(0, Math.min(1, ratio));
    const filled = Math.round(r * BLOCKS);
    const kids = parent.children;
    for (let i=0;i<kids.length;i++){
      kids[i].classList.toggle("off", i >= filled);
      if (hotAt !== undefined){
        kids[i].classList.toggle("hot", r >= hotAt && i < filled);
      }
    }
  }

  let stickToBottom = true;
  tailEl.addEventListener("scroll", () => {
    stickToBottom = (tailEl.scrollTop + tailEl.clientHeight >= tailEl.scrollHeight - 12);
  });

  function appendTailRow(snap){
    if (emptyEl){ emptyEl.remove(); }
    const row = document.createElement("div");
    row.className = "demo-row" + (snap.flashReq ? " flash-req" : "");
    row.innerHTML =
        '<span class="tsv">' + fmtClock(new Date(snap.time)) + '</span>'
      + '<div class="blocks cpu"></div>'
      + '<span class="val cpu">' + snap.cpu.toFixed(1) + '%</span>'
      + '<div class="blocks mem"></div>'
      + '<span class="val mem">' + snap.mem.toFixed(1) + '%</span>'
      + '<div class="blocks req"></div>'
      + '<span class="val req">' + snap.req + '</span>'
      + '<div class="blocks lat"></div>'
      + '<span class="val lat">' + snap.lat + '</span>';
    tailEl.appendChild(row);
    row.querySelectorAll(".blocks").forEach(b => buildBlockRow(b));
    setBlocks(row.querySelector(".blocks.cpu"), snap.cpu/100, 0.85);
    setBlocks(row.querySelector(".blocks.mem"), snap.mem/100, 0.85);
    setBlocks(row.querySelector(".blocks.req"), Math.min(1, snap.req/8));
    setBlocks(row.querySelector(".blocks.lat"), Math.min(1, snap.lat/600), 0.7);
    while (tailEl.children.length > TAIL_CAP) tailEl.removeChild(tailEl.firstChild);
    if (stickToBottom) tailEl.scrollTop = tailEl.scrollHeight;
  }

  /* Append a tail row once per second from the latest real metrics + the
     request delta accumulated since the previous tick. */
  let lastSnap = { cpu:0, mem:0, temp:0, up:0 };
  window.applyDemoVitals = (m) => {
    if (!m) return;
    lastSnap = {
      cpu:  m.cpu || 0,
      mem:  (m.memory && m.memory.ratio) || 0,
      temp: m.temperature || 0,
      up:   m.uptime || 0,
    };
  };
  function tickTail(){
    if (DEMO_SHUTDOWN) return;
    const now = PINGS_BUCKET.length ? PINGS_BUCKET[PINGS_BUCKET.length-1] : null;
    const lat = now ? now.lat : 0;
    appendTailRow({
      time: Date.now(),
      cpu: lastSnap.cpu,
      mem: lastSnap.mem,
      req: reqDeltaSinceTick,
      lat: lat,
      flashReq: reqDeltaSinceTick > 0,
    });
    reqDeltaSinceTick = 0;
  }
  setInterval(tickTail, 1000);

  /* ---------- staged shutdown then auto-reboot loop ---------- */
  let DEMO_SHUTDOWN = false;
  function scheduleShutdown(){
    setTimeout(() => {
      DEMO_SHUTDOWN = true;
      shutTs.textContent = ts();
      shutEl.classList.add("on");
    }, 60000 + Math.random()*30000);
    setTimeout(() => {
      DEMO_SHUTDOWN = false;
      shutEl.classList.remove("on");
      logLines.length = 0;
      logEl.innerHTML = "";
      seedEvents.forEach((mk,i) => setTimeout(() => pushLog(mk()), 250 + i*420));
      scheduleShutdown();
    }, 90000 + Math.random()*15000);
  }
  scheduleShutdown();
})();

</script>
</body>
</html>`;
}

module.exports = { html };
