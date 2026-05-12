import { useEffect, useMemo, useRef, useState } from "react";

const FAKE_WINDOWS = [
  {
    title: "Windows Defender",
    headline: "⚠ THREAT DETECTED",
    body: "Trojan:Win32/Wacatac.B!ml — Severe risk found in C:\\Users\\You\\Documents\\private.zip",
    tone: "danger",
  },
  {
    title: "System32 — cmd.exe",
    headline: "rm -rf /  is running…",
    body: "Deleting C:\\Windows\\System32\\* … 38% complete\nDo NOT power off your machine.",
    tone: "terminal",
  },
  {
    title: "Norton 360",
    headline: "🦠 5 viruses detected",
    body: "We've blocked an attempt to access your webcam and bank credentials. Click OK to quarantine.",
    tone: "warn",
  },
  {
    title: "Google Chrome",
    headline: "Your data has been leaked",
    body: "1,243 passwords have been exposed in a recent data breach. Recommended action: change all passwords now.",
    tone: "danger",
  },
  {
    title: "Webcam access",
    headline: "📷 Camera is now recording",
    body: "An unknown process started recording your front camera. Smile, you're on candid camera!",
    tone: "warn",
  },
  {
    title: "BSOD — STOP 0x000000DEAD",
    headline: "A problem has been detected",
    body: ":(  Your PC ran into a problem and needs to restart.\nIf you call your IT guy, this is the part where he laughs.",
    tone: "bsod",
  },
  {
    title: "Bitcoin Miner",
    headline: "Mining started",
    body: "We're using 100% of your CPU to mine BTC for a stranger. Estimated profit for you: 0.000000 BTC.",
    tone: "warn",
  },
  {
    title: "Antivirus",
    headline: "Reformatting drive C:",
    body: "Format C:\\  …please wait, this may take 0.4 seconds.",
    tone: "danger",
  },
];

const MEMES = [
  "https://media.tenor.com/x8v1oNUOmg4AAAAC/rickroll-roll.gif",
  "https://media.tenor.com/cZHrA-c39ZkAAAAi/rickroll-rick-rolled.gif",
  "https://media.tenor.com/4PV0DDp4SMQAAAAC/rick-astley-rick-rolled.gif",
];

const TROLLFACE_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'>
  <defs>
    <radialGradient id='g' cx='50%' cy='40%' r='60%'>
      <stop offset='0%' stop-color='#fff8e7'/>
      <stop offset='100%' stop-color='#d9c79a'/>
    </radialGradient>
  </defs>
  <circle cx='120' cy='120' r='110' fill='url(#g)' stroke='#1a1208' stroke-width='5'/>
  <ellipse cx='85' cy='95' rx='14' ry='9' fill='#1a1208'/>
  <ellipse cx='155' cy='95' rx='14' ry='9' fill='#1a1208'/>
  <circle cx='85' cy='93' r='2' fill='#fff'/>
  <circle cx='155' cy='93' r='2' fill='#fff'/>
  <path d='M55 145 Q120 215 185 145 Q170 175 120 175 Q70 175 55 145 Z'
        fill='#1a1208' stroke='#1a1208' stroke-width='3' stroke-linejoin='round'/>
  <path d='M70 152 Q120 175 170 152' stroke='#fff8e7' stroke-width='4' fill='none' stroke-linecap='round'/>
</svg>
`);

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function FakeWindow({ data, index, total }) {
  const style = useMemo(() => {
    const left = rand(2, 70);
    const top = rand(4, 65);
    const rot = rand(-6, 6);
    const delay = (index * 0.12).toFixed(2);
    const z = 100 + index;
    return {
      left: `${left}%`,
      top: `${top}%`,
      transform: `rotate(${rot}deg)`,
      animationDelay: `${delay}s`,
      zIndex: z,
    };
  }, [index]);

  const headerColor =
    data.tone === "danger"
      ? "#ff3b3b"
      : data.tone === "bsod"
        ? "#0a52d6"
        : data.tone === "terminal"
          ? "#0d0d0d"
          : "#f59e0b";

  return (
    <div
      className={`troll-win troll-tone-${data.tone}`}
      style={style}
      data-testid={`troll-fake-window-${index}`}
    >
      <div className="troll-win-bar" style={{ background: headerColor }}>
        <span className="troll-win-title">{data.title}</span>
        <span className="troll-win-x">×</span>
      </div>
      <div className="troll-win-body">
        <div className="troll-win-head">{data.headline}</div>
        <pre className="troll-win-msg">{data.body}</pre>
        <div className="troll-win-btns">
          <button className="troll-win-btn primary">OK</button>
          <button className="troll-win-btn">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function TrollOverlay({ onClose }) {
  const [phase, setPhase] = useState("attack");
  const [memeIdx, setMemeIdx] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    let ctx, oscA, oscB, gain;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        ctx = new AC();
        oscA = ctx.createOscillator();
        oscB = ctx.createOscillator();
        gain = ctx.createGain();
        oscA.type = "square";
        oscB.type = "sawtooth";
        oscA.frequency.value = 880;
        oscB.frequency.value = 440;
        gain.gain.value = 0.05;
        oscA.connect(gain);
        oscB.connect(gain);
        gain.connect(ctx.destination);
        oscA.start();
        oscB.start();

        let t = 0;
        const wobble = setInterval(() => {
          if (!oscA || !oscB) return;
          t += 1;
          oscA.frequency.value = 700 + Math.sin(t / 2) * 220;
          oscB.frequency.value = 320 + Math.cos(t / 3) * 140;
        }, 120);
        audioRef.current = { ctx, oscA, oscB, gain, wobble };
      }
    } catch (_) {}

    const t1 = setTimeout(() => {
      setPhase("reveal");

      const a = audioRef.current;
      if (a) {
        try {
          clearInterval(a.wobble);
          a.oscA.stop();
          a.oscB.stop();
          a.ctx.close();
        } catch (_) {}
        audioRef.current = null;
      }
    }, 4000);

    return () => {
      clearTimeout(t1);
      const a = audioRef.current;
      if (a) {
        try {
          clearInterval(a.wobble);
          a.oscA.stop();
          a.oscB.stop();
          a.ctx.close();
        } catch (_) {}
      }
    };
  }, []);

  const handleMemeError = () => {
    setMemeIdx((i) => i + 1);
  };
  const memeSrc = memeIdx < MEMES.length ? MEMES[memeIdx] : TROLLFACE_SVG;

  return (
    <div
      className={`troll-root troll-phase-${phase}`}
      data-testid="troll-overlay"
    >
      {phase === "attack" && (
        <>
          <div className="troll-glitch" />
          <div className="troll-scanlines" />
          <div className="troll-noise" />
          <div className="troll-marquee" data-testid="troll-marquee">
            <span>
              ⚠ SYSTEM COMPROMISED · ALL FILES ENCRYPTED · WEBCAM ACTIVATED ·
              BANK ACCOUNT EMPTIED · CAT PHOTOS LEAKED · ⚠ SYSTEM COMPROMISED ·
              ALL FILES ENCRYPTED · WEBCAM ACTIVATED ·
            </span>
          </div>
          <div className="troll-stage">
            {FAKE_WINDOWS.map((w, i) => (
              <FakeWindow
                key={i}
                data={w}
                index={i}
                total={FAKE_WINDOWS.length}
              />
            ))}
          </div>
        </>
      )}

      {phase === "reveal" && (
        <div className="troll-reveal" data-testid="troll-reveal">
          <div className="troll-confetti" aria-hidden="true">
            {Array.from({ length: 40 }).map((_, i) => (
              <span
                key={i}
                style={{
                  left: `${rand(0, 100)}%`,
                  animationDelay: `${(i * 0.08).toFixed(2)}s`,
                  background: [
                    "#ff7d5e",
                    "#fbc55e",
                    "#b3e066",
                    "#4fd1c5",
                    "#f59ec0",
                  ][i % 5],
                }}
              />
            ))}
          </div>
          <div className="troll-card">
            <div className="troll-eyebrow">PSYCH! 😈</div>
            <h1 className="troll-title">
              Tỉnh dậy đê, không ai cứu nổi em đâu !
            </h1>
            <p className="troll-sub">
              <code>admin / admin1234567</code> ? Thật sự bro tin đây là{" "}
              <code>Account</code> Admin hả 🤡
            </p>
            <div className="troll-meme-wrap">
              <img
                src={memeSrc}
                alt="You got trolled"
                className="troll-meme"
                onError={handleMemeError}
                data-testid="troll-meme"
              />
            </div>
            <button
              className="troll-close-btn"
              onClick={onClose}
              data-testid="troll-close-btn"
            >
              Ok, mình nguuuu … cho mình thử lại 😅
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
