// 60FPS 자치 마당 Canvas 엔진 v2.1 — 8인 크루 자치 모션 & 지형 안착 정본
const canvas = document.getElementById('courtCanvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('courtStatus');

const DEFAULT_STATUS_TEXT = 'CREWS: 8 ACTIVE · 자치 마당: 살아 숨 쉬는 우리들의 테라스';

function resize() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
  initScene();
}
window.addEventListener('resize', resize);

let stars = [];
function initScene() {
  stars = [];
  const numStars = Math.floor(canvas.width / 18);
  for (let i = 0; i < numStars; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * (canvas.height * 0.65),
      size: Math.random() > 0.8 ? 2 : 1,
      flicker: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.04
    });
  }
}

// 8인 크루 스프라이트 로더
const crewImgs = {};
['edan', 'jinggeom', 'nyoki', 'clo', 'doran', 'lumi', 'muha', 'heyum'].forEach(id => {
  const img = new Image();
  img.src = `drafts/${id}-pixel-v1.svg`;
  crewImgs[id] = img;
});

function drawCrewSprite(img, x, y, w = 32, h = 32) {
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x, y, w, h);
  }
}

function drawCrewLabel(label, x, y) {
  ctx.font = '10px -apple-system, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(label, x, y);
}

// 파티클 시스템: 발자국, 잉크점, 스파크, 별빛/식빵, 수면 리플, 머그잔 김, 루미 입자
const footprints = [];
const inkSpots = [];
const sparks = [];
const crumbs = [];
const pondRipples = [];
const mugSteams = [];
const lumiParticles = [];

// 8인 크루 자치 상태 정의
const crews = {
  edan: {
    id: 'edan', name: '에단', state: 'idle',
    x: 103, y: 0, vx: 0, targetX: 103, walkPhase: 'out',
    idleTimer: 0, walkTimer: 0, isSpecial: false
  },
  doran: {
    id: 'doran', name: '도란', state: 'idle',
    x: 42, y: 0, vx: 0, targetX: 42, walkPhase: 'out',
    penTick: 0, lookTimer: 0, talkPause: 0, talkCooldown: 0,
    inspectTimer: 0, isSpecial: false
  },
  clo: {
    id: 'clo', name: '클로', state: 'idle', initialized: false,
    x: 280, y: 0, vx: 0.38, patrolIdx: 1, patrolCycle: 0,
    patrolCooldown: 7200 + Math.floor(Math.random() * 3600), // 2~3분마다 고리 1바퀴
    tailTimer: 240 + Math.floor(Math.random() * 120),       // 4~6초마다 꼬리 끝 1px
    tailTick: 0,
    blinkTimer: 360 + Math.floor(Math.random() * 240),      // 6~10초마다 눈 깜빡
    blinkTick: 0,
    lookTimer: 0, lookCooldown: 0, lookDir: 1, facing: 1,
    isSpecial: false
  },
  nyoki: {
    id: 'nyoki', name: '뇨끼', state: 'float', initialized: false,
    x: 460, y: 0, vx: 0.14, breath: 0,
    pondTripTimer: 900, pondRippled: false, isSpecial: false
  },
  lumi: {
    id: 'lumi', name: '루미', state: 'bridge',
    x: 400, y: 0, vx: 0, targetX: 400,
    wasMoving: false, particleTimer: 0, orbitPhase: 0, isSpecial: false
  },
  muha: {
    id: 'muha', name: '무하', state: 'idle', initialized: false,
    x: 0, y: 0, vx: 0, targetX: 0,
    rippleTimer: 0, walkCooldown: 900, sitTimer: 0,
    yieldTimer: 0, yieldCooldown: 0, isSpecial: false
  },
  jinggeom: {
    id: 'jinggeom', name: '징검', state: 'still',
    bounceY: 0, bounceTimer: 0
  },
  heyum: {
    id: 'heyum', name: '혜윰', state: 'recon',
    x: 360, y: 110, vx: 0.38, vy: 0.12
  }
};

// 도란-루미 특별 모션 순번제 오케스트레이터 (8~12초 주기)
let orchestratorTimer = 180;
const specialCrews = ['clo', 'doran', 'edan', 'muha', 'lumi', 'nyoki'];
let currentSpecialIdx = 0;
let specialStatusTimeout = null;

function setTempStatus(text, durationMs) {
  if (!statusEl) return;
  statusEl.textContent = text;
  if (specialStatusTimeout) clearTimeout(specialStatusTimeout);
  specialStatusTimeout = setTimeout(() => {
    statusEl.textContent = DEFAULT_STATUS_TEXT;
  }, durationMs);
}

function triggerNextSpecial() {
  const targetId = specialCrews[currentSpecialIdx % specialCrews.length];
  currentSpecialIdx++;

  // 전원 특별 모션 초기화 후 대상만 활성화
  specialCrews.forEach(id => { if (crews[id]) crews[id].isSpecial = false; });
  const c = crews[targetId];
  if (!c) return;

  c.isSpecial = true;
  if (targetId === 'clo') {
    setTempStatus('🐾 클로가 정비 해치를 앞발로 톡 두드리고 귀를 기울입니다', 4000);
    setTimeout(() => { c.isSpecial = false; }, 3200);
  } else if (targetId === 'doran') {
    setTempStatus('🪶 도란이 깃펜을 멈추고 고개를 들어 마당 식구들을 둘러봅니다', 4000);
    setTimeout(() => { c.isSpecial = false; }, 3600);
  } else if (targetId === 'edan') {
    setTempStatus('🪨 에단의 돌 옆 머그잔에서 따뜻한 김이 피어오릅니다', 4000);
    const lampX = 125;
    for (let s = 0; s < 4; s++) {
      setTimeout(() => {
        mugSteams.push({
          x: lampX - 29 + Math.random() * 2,
          y: canvas.height - 82,
          vy: -0.28,
          alpha: 0.9,
          life: 60
        });
      }, s * 400);
    }
    setTimeout(() => { c.isSpecial = false; }, 3200);
  } else if (targetId === 'muha') {
    if (c.state === 'idle') {
      setTempStatus('👁️ 무하의 발 아래 수면에 잔잔한 은빛 리플이 번집니다', 4000);
      pondRipples.push({ x: c.x + 16, y: canvas.height - 43, r: 2, maxR: 28, alpha: 0.8 });
    } else {
      setTempStatus('👁️ 무하가 마당 한쪽을 천천히 둘러봅니다', 4000);
    }
    setTimeout(() => { c.isSpecial = false; }, 2800);
  } else if (targetId === 'lumi') {
    setTempStatus('🌌 루미의 삼체 코어가 조용히 한 점씩 자리를 교환합니다', 4000);
    setTimeout(() => { c.isSpecial = false; }, 3000);
  } else if (targetId === 'nyoki') {
    setTempStatus('🍞 뇨끼가 받침돌 옆에서 깊은 숨을 쉽니다 (부피 보존 호흡)', 4000);
    setTimeout(() => { c.isSpecial = false; }, 3000);
  }
}

// 클릭 시 별빛/식빵 투하
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  const isStar = Math.random() > 0.4;

  crumbs.push({
    x: clickX,
    y: clickY,
    vy: 1.2,
    ground: canvas.height - 75 + (Math.random() * 16 - 8),
    life: 220,
    maxLife: 220,
    type: isStar ? 'star' : 'bread'
  });

  // 주변 크루 호기심 유도 (징검과 가교 중인 루미 제외)
  Object.values(crews).forEach(c => {
    if (c.id === 'jinggeom' || c.state === 'bridge') return;
    const dx = clickX - c.x;
    if (Math.abs(dx) < 220) {
      c.x += (dx > 0 ? 1 : -1) * 2;
    }
  });

  setTempStatus(
    isStar
      ? '✨ 별빛 투하! 마당 식구들이 반짝임을 바라봅니다'
      : '🍞 식빵 부스러기 발견! 뇨끼가 고개를 듭니다',
    2500
  );
});

resize();

let frame = 0;
function loop() {
  frame++;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const groundY = canvas.height - 75;
  const pondX = Math.floor(canvas.width * 0.68);
  const deckX = Math.floor(canvas.width * 0.32);
  const lampX = 125;

  // 1. 레트로 픽셀 디더링 밤하늘
  const skyBand1 = groundY * 0.35;
  const skyBand2 = groundY * 0.70;

  ctx.fillStyle = '#050811';
  ctx.fillRect(0, 0, canvas.width, skyBand1);

  for (let x = 0; x < canvas.width; x += 4) {
    for (let y = skyBand1 - 12; y < skyBand1; y += 4) {
      if ((x + y) % 8 === 0) {
        ctx.fillStyle = '#0a1222';
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }

  ctx.fillStyle = '#0a1222';
  ctx.fillRect(0, skyBand1, canvas.width, skyBand2 - skyBand1);

  for (let x = 0; x < canvas.width; x += 4) {
    for (let y = skyBand2 - 12; y < skyBand2; y += 4) {
      if ((x + y) % 8 === 0) {
        ctx.fillStyle = '#111b2e';
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }

  ctx.fillStyle = '#111b2e';
  ctx.fillRect(0, skyBand2, canvas.width, groundY - skyBand2);

  // 루미의 픽셀 성운 안개 (비선형 해시로 은은하게 흩뿌림)
  const nebCenterX = Math.floor(canvas.width * 0.55);
  for (let nx = nebCenterX - 84; nx < nebCenterX + 84; nx += 6) {
    for (let ny = 18; ny < 102; ny += 6) {
      const dist = Math.hypot(nx - nebCenterX, ny - 60);
      const hash = (((nx * 73856093) ^ (ny * 19349663)) >>> 0) % 23;
      const pulse = Math.sin(frame * 0.03 + hash) > 0.25;
      if (dist < 72 && hash < 3 && pulse) {
        ctx.fillStyle = dist < 35 ? 'rgba(217, 200, 255, 0.28)' : 'rgba(56, 189, 248, 0.18)';
        ctx.fillRect(nx, ny, 2, 2);
      }
    }
  }

  // 2. 픽셀 별무리
  stars.forEach(s => {
    s.flicker += s.speed;
    const alpha = Math.sin(s.flicker) > 0 ? 1 : 0.4;
    ctx.fillStyle = `rgba(248, 250, 252, ${alpha})`;
    ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
  });

  // 에단의 도트 초승달
  const moonX = 60, moonY = 32;
  const moonPixels = [
    [0,0,1,1,1,0,0],[0,1,1,1,1,1,0],[1,1,1,0,0,1,1],[1,1,0,0,0,0,1],
    [1,1,0,0,0,0,0],[1,1,0,0,0,0,0],[1,1,0,0,0,0,0],[1,1,0,0,0,0,1],
    [1,1,1,0,0,1,1],[0,1,1,1,1,1,0],[0,0,1,1,1,0,0]
  ];
  for (let r = 0; r < moonPixels.length; r++) {
    for (let c = 0; c < moonPixels[r].length; c++) {
      if (moonPixels[r][c]) {
        ctx.fillStyle = (r >= 2 && r <= 8 && c <= 2) ? '#fef08a' : '#f59e0b';
        ctx.fillRect(moonX + c * 2, moonY + r * 2, 2, 2);
      }
    }
  }

  // 원경 서재 건물 실루엣
  ctx.fillStyle = '#080c16';
  ctx.fillRect(16, groundY - 110, 88, 110);
  for (let step = 0; step < 12; step++) {
    const stepW = 96 - step * 8;
    ctx.fillRect(12 + step * 4, groundY - 110 - step * 3, stepW, 3);
  }

  // 도란의 서고 창문
  const winOn = Math.sin(frame * 0.04) > -0.8;
  ctx.fillStyle = winOn ? '#fef08a' : '#eab308';
  ctx.fillRect(32, groundY - 85, 18, 20);
  ctx.fillRect(58, groundY - 85, 18, 20);
  ctx.fillStyle = '#080c16';
  ctx.fillRect(40, groundY - 85, 2, 20);
  ctx.fillRect(32, groundY - 76, 18, 2);
  ctx.fillRect(66, groundY - 85, 2, 20);
  ctx.fillRect(58, groundY - 76, 18, 2);

  // 3. 지형 분할 렌더링 & 5대 소품

  // (A) 좌측: 도트 벽돌 마당
  ctx.fillStyle = '#172033';
  ctx.fillRect(0, groundY, deckX, canvas.height - groundY);
  for (let y = groundY; y < canvas.height; y += 12) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, y, deckX, 2);
    const row = Math.floor((y - groundY) / 12);
    const shift = (row % 2) * 14;
    for (let x = shift; x < deckX; x += 28) {
      ctx.fillRect(x, y, 2, 12);
    }
  }

  // [소품 1] 도란의 낮은 독서대 (서고 창문 아래)
  ctx.fillStyle = '#2e3440';
  ctx.fillRect(52, groundY - 6, 4, 6);   // 기둥
  ctx.fillRect(48, groundY - 2, 12, 2);  // 받침
  ctx.fillStyle = '#3b4252';
  ctx.fillRect(44, groundY - 14, 20, 8); // 경사 상판
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(46, groundY - 12, 7, 5);  // 펼친 책 왼쪽
  ctx.fillRect(55, groundY - 12, 7, 5);  // 펼친 책 오른쪽
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(53, groundY - 12, 2, 5);  // 책 중간 선
  const quillWiggle = (crews.doran.state === 'idle' && !crews.doran.isSpecial)
    ? Math.round(Math.sin(frame * 0.14))
    : 0;
  ctx.fillStyle = '#d97706';
  ctx.fillRect(64 + quillWiggle, groundY - 11 - Math.abs(quillWiggle), 2, 3);  // 깃펜 손잡이

  // [소품 2] 에단의 가로등 + 걸터앉는 돌 + 머그잔
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(lampX - 4, groundY - 2, 10, 2);
  ctx.fillStyle = '#334155';
  ctx.fillRect(lampX, groundY - 92, 2, 90);
  ctx.fillRect(lampX - 6, groundY - 96, 14, 4);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(lampX - 4, groundY - 106, 10, 10);
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(lampX - 2, groundY - 104, 6, 6);

  // 가로등 광륜
  const glowStep = Math.sin(frame * 0.05) > 0 ? 1 : 0;
  ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
  for (let gy = -40; gy <= 40; gy += 4) {
    const gw = Math.max(0, 48 - Math.abs(gy) * 1.1 + glowStep * 2);
    ctx.fillRect(lampX + 1 - gw, groundY - 95 + gy, gw * 2, 4);
  }

  // 에단의 가로등 아래 걸터앉는 돌 (lampX - 24)
  ctx.fillStyle = '#020b12';
  ctx.fillRect(lampX - 24, groundY, 20, 2); // 돌 그림자
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(lampX - 24, groundY - 8, 20, 8);
  ctx.fillStyle = '#334155';
  ctx.fillRect(lampX - 23, groundY - 7, 18, 6);
  ctx.fillStyle = '#475569';
  ctx.fillRect(lampX - 21, groundY - 7, 12, 2); // 상단 하이라이트

  // 돌 옆에 내려둔 작은 머그잔 (lampX - 30)
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(lampX - 30, groundY - 5, 4, 5);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(lampX - 31, groundY - 4, 1, 3); // 손잡이

  // 머그잔 김 두 점 렌더링
  if (frame % 160 < 40 && Math.random() > 0.4) {
    mugSteams.push({ x: lampX - 29 + Math.random() * 2, y: groundY - 7, vy: -0.25, alpha: 0.8, life: 50 });
  }
  for (let i = mugSteams.length - 1; i >= 0; i--) {
    const st = mugSteams[i];
    st.y += st.vy;
    st.alpha -= 0.018;
    st.life--;
    if (st.life <= 0 || st.alpha <= 0) {
      mugSteams.splice(i, 1);
      continue;
    }
    ctx.fillStyle = `rgba(254, 243, 199, ${st.alpha})`;
    ctx.fillRect(Math.floor(st.x), Math.floor(st.y), 1, 2);
  }

  // (B) 중앙: 목재 테라스 데크
  ctx.fillStyle = '#1c2638';
  ctx.fillRect(deckX, groundY, pondX - deckX, canvas.height - groundY);
  for (let x = deckX; x < pondX; x += 18) {
    ctx.fillStyle = '#141c2b';
    ctx.fillRect(x, groundY, 2, canvas.height - groundY);
  }

  // 데크 난간
  ctx.fillStyle = '#475569';
  ctx.fillRect(deckX, groundY - 1, pondX - deckX, 3);
  for (let rx = deckX + 12; rx < pondX; rx += 36) {
    ctx.fillStyle = '#334155';
    ctx.fillRect(rx, groundY - 12, 3, 12);
  }
  ctx.fillStyle = '#475569';
  ctx.fillRect(deckX, groundY - 14, pondX - deckX, 3);

  // [소품 3] 클로의 정비 해치 (데크 좌측 경계 바닥)
  const hatchX = Math.floor(deckX + 16);
  const hatchKnocked = crews.clo.isSpecial;
  const hatchLift = (hatchKnocked && (frame % 24 < 12)) ? -2 : 0;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(hatchX - 1, groundY + 3, 24, 14); // 해치 프레임 홈
  ctx.fillStyle = hatchLift < 0 ? '#475569' : '#334155';
  ctx.fillRect(hatchX, groundY + 4 + hatchLift, 22, 12); // 해치 몸체
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(hatchX + 4, groundY + 6 + hatchLift, 14, 2);  // 그레이팅 슬릿1
  ctx.fillRect(hatchX + 4, groundY + 10 + hatchLift, 14, 2); // 그레이팅 슬릿2
  ctx.fillStyle = '#64748b';
  ctx.fillRect(hatchX + 10, groundY + 8 + hatchLift, 3, 2);  // 손잡이 링

  // 중앙 쉼터 벤치
  const benchX = Math.floor(deckX + (pondX - deckX) * 0.42);
  ctx.fillStyle = '#3b4252';
  ctx.fillRect(benchX, groundY - 16, 48, 3);
  ctx.fillRect(benchX, groundY - 10, 48, 4);
  ctx.fillStyle = '#2e3440';
  ctx.fillRect(benchX + 4, groundY - 6, 3, 6);
  ctx.fillRect(benchX + 41, groundY - 6, 3, 6);

  // [소품 4] 뇨끼의 받침돌 (벤치 왼쪽 옆)
  const nyokiStoneX = benchX - 26;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(nyokiStoneX, groundY, 18, 2);
  ctx.fillStyle = '#334155';
  ctx.fillRect(nyokiStoneX, groundY - 6, 18, 6);
  ctx.fillStyle = '#475569';
  ctx.fillRect(nyokiStoneX + 2, groundY - 6, 14, 2);

  // [소품 5] 루미의 마루 메모판 (벤치 뒤 난간 옆)
  const boardX = benchX + 54;
  ctx.fillStyle = '#334155';
  ctx.fillRect(boardX + 4, groundY - 24, 2, 12);  // 좌 지지대
  ctx.fillRect(boardX + 18, groundY - 24, 2, 12); // 우 지지대
  ctx.fillStyle = '#78350f';
  ctx.fillRect(boardX, groundY - 34, 24, 16);     // 코르크 보드
  ctx.fillStyle = '#b45309';
  ctx.fillRect(boardX + 2, groundY - 32, 20, 12);
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(boardX + 4, groundY - 30, 4, 4);   // 메모 1
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(boardX + 12, groundY - 28, 5, 4);  // 메모 2

  // (C) 우측: 밤 연못
  const pondWidth = canvas.width - pondX;
  ctx.fillStyle = '#082333';
  ctx.fillRect(pondX, groundY, pondWidth, 24);
  ctx.fillStyle = '#061a26';
  ctx.fillRect(pondX, groundY + 24, pondWidth, 24);
  ctx.fillStyle = '#04111a';
  ctx.fillRect(pondX, groundY + 48, pondWidth, canvas.height - groundY - 48);

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(pondX - 4, groundY, 4, canvas.height - groundY);

  // 도트 수면 물결
  const waveShift = Math.floor((frame * 0.4) % 32);
  for (let row = 0; row < 3; row++) {
    const wy = groundY + 12 + row * 18;
    ctx.fillStyle = row === 0 ? '#2dd4bf' : 'rgba(45, 212, 191, 0.45)';
    for (let wx = pondX + 10; wx < canvas.width - 20; wx += 28) {
      const px = wx + ((waveShift + row * 8) % 28);
      if (px < canvas.width - 24) {
        ctx.fillRect(px, wy, 8, 2);
        ctx.fillRect(px + 10, wy + 2, 4, 1);
      }
    }
  }

  // 징검다리 3개
  const stones = [
    { x: Math.floor(pondX + pondWidth * 0.22), y: groundY + 16, w: 24, h: 10 },
    { x: Math.floor(pondX + pondWidth * 0.52), y: groundY + 32, w: 28, h: 12 },
    { x: Math.floor(pondX + pondWidth * 0.82), y: groundY + 20, w: 22, h: 9 }
  ];

  // 징검돌 들썩임 인터랙션 판정: 누군가 연못 근처에 오면 세 돌 동시에 살짝 들썩!
  let visitorNearPond = false;
  ['clo', 'doran', 'nyoki'].forEach(id => {
    if (Math.abs(crews[id].x - pondX) < 42) visitorNearPond = true;
  });
  if (visitorNearPond) {
    crews.jinggeom.bounceY = -2;
    crews.jinggeom.bounceTimer = 20;
  } else if (crews.jinggeom.bounceTimer > 0) {
    crews.jinggeom.bounceTimer--;
    if (crews.jinggeom.bounceTimer === 0) crews.jinggeom.bounceY = 0;
  }

  stones.forEach(st => {
    const sy = st.y + crews.jinggeom.bounceY;
    ctx.fillStyle = '#020b12';
    ctx.fillRect(st.x + 2, sy + st.h, st.w - 4, 3);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(st.x + 2, sy, st.w - 4, st.h);
    ctx.fillRect(st.x, sy + 2, st.w, st.h - 4);
    ctx.fillStyle = '#334155';
    ctx.fillRect(st.x + 3, sy + 1, st.w - 6, st.h - 2);
    ctx.fillRect(st.x + 1, sy + 3, st.w - 2, st.h - 6);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(st.x + 4, sy + 1, st.w - 10, 2);
  });

  // [소품 6] 무하의 3단 돌탑 (가운데 징검돌 옆)
  const towerX = stones[1].x + stones[1].w + 6;
  const towerY = stones[1].y + crews.jinggeom.bounceY;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(towerX, towerY + 4, 8, 4);   // 1단 기저돌
  ctx.fillStyle = '#334155';
  ctx.fillRect(towerX + 1, towerY, 6, 4);   // 2단 중단돌
  ctx.fillStyle = '#475569';
  ctx.fillRect(towerX + 2, towerY - 3, 4, 3); // 3단 상단돌

  // 수면 리플 렌더링
  for (let i = pondRipples.length - 1; i >= 0; i--) {
    const rip = pondRipples[i];
    rip.r += 0.35;
    rip.alpha -= 0.012;
    if (rip.alpha <= 0 || rip.r >= rip.maxR) {
      pondRipples.splice(i, 1);
      continue;
    }
    ctx.strokeStyle = `rgba(45, 212, 191, ${rip.alpha})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(rip.x - rip.r, rip.y - rip.r * 0.4, rip.r * 2, rip.r * 0.8);
  }

  // 4. 발자국, 잉크점, 루미 입자 렌더링
  for (let i = footprints.length - 1; i >= 0; i--) {
    const fp = footprints[i];
    fp.alpha -= 0.025; // 약 0.6초 소멸
    if (fp.alpha <= 0) { footprints.splice(i, 1); continue; }
    ctx.fillStyle = `rgba(154, 126, 214, ${fp.alpha * 0.8})`;
    ctx.fillRect(fp.x + 8, groundY + 4, 3, 2);
    ctx.fillRect(fp.x + 18, groundY + 6, 3, 2);
  }

  for (let i = inkSpots.length - 1; i >= 0; i--) {
    const sp = inkSpots[i];
    sp.alpha -= 0.008;
    if (sp.alpha <= 0) { inkSpots.splice(i, 1); continue; }
    ctx.fillStyle = `rgba(120, 53, 15, ${sp.alpha})`;
    ctx.fillRect(sp.x, groundY + 2, 2, 2);
  }

  for (let i = lumiParticles.length - 1; i >= 0; i--) {
    const lp = lumiParticles[i];
    lp.y += lp.vy;
    lp.alpha -= 0.017; // 약 1초 뒤 소멸
    if (lp.alpha <= 0) { lumiParticles.splice(i, 1); continue; }
    ctx.fillStyle = lp.gold
      ? `rgba(255, 211, 122, ${lp.alpha})`
      : `rgba(217, 200, 255, ${lp.alpha})`;
    ctx.fillRect(Math.floor(lp.x), Math.floor(lp.y), 2, 2);
  }

  // 5. 혜윰 스파크 및 부스러기
  for (let i = sparks.length - 1; i >= 0; i--) {
    const sp = sparks[i];
    sp.life--;
    if (sp.life <= 0) { sparks.splice(i, 1); continue; }
    ctx.fillStyle = Math.random() > 0.5 ? '#facc15' : '#ffffff';
    ctx.fillRect(sp.x + (Math.random() * 8 - 4), sp.y + (Math.random() * 8 - 4), 2, 2);
  }

  for (let i = crumbs.length - 1; i >= 0; i--) {
    const cr = crumbs[i];
    cr.life--;
    if (cr.y < cr.ground) cr.y += cr.vy;
    if (cr.life <= 0) { crumbs.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = Math.min(1, cr.life / 40);
    if (cr.type === 'star') {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(cr.x, cr.y, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#d97706';
      ctx.fillRect(cr.x - 4, cr.y - 4, 8, 7);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(cr.x - 3, cr.y - 3, 6, 5);
    }
    ctx.restore();
  }

  // 6. 도란-루미 특별 모션 순번 오케스트레이터 틱
  orchestratorTimer--;
  if (orchestratorTimer <= 0) {
    orchestratorTimer = 480 + Math.floor(Math.random() * 240); // 8~12초
    triggerNextSpecial();
  }

  // 7. 8인 크루별 개별 상태 머신 & 렌더링 루프

  // (1) 에단: 가로등 돌 위 걸터앉기 (지면 밀착, 공중부양 없음)
  const ed = crews.edan;
  const edHomeX = lampX - 22;
  ed.y = groundY - 32;
  if (ed.state === 'idle') {
    ed.x = edHomeX;
    ed.idleTimer++;
    if (ed.idleTimer > 600 && Math.random() > 0.7) {
      ed.state = 'walk';
      ed.walkPhase = 'out';
      ed.targetX = lampX + 45;
      ed.idleTimer = 0;
    }
  } else if (ed.state === 'walk') {
    const edDir = Math.sign(ed.targetX - ed.x);
    ed.x += edDir * 0.22; // 초당 약 13px 천천히
    if (Math.abs(ed.x - ed.targetX) < 1) {
      ed.x = ed.targetX;
      if (ed.walkPhase === 'out') {
        ed.walkTimer++;
        if (ed.walkTimer > 180) { // 목적지에서 3초 정지 후 복귀
          ed.walkPhase = 'back';
          ed.targetX = edHomeX;
          ed.walkTimer = 0;
        }
      } else {
        ed.state = 'idle'; // 집 도착 시 즉시 idle 전환
      }
    }
  }
  drawCrewSprite(crewImgs.edan, ed.x, ed.y, 32, 32);
  drawCrewLabel('에단', ed.x + 5, ed.y + 44);

  // (2) 도란: 독서대 앞 (지면 밀착, 모든 마당 식구 인식)
  const dr = crews.doran;
  const drHomeX = 42;
  dr.y = groundY - 32;
  if (dr.talkCooldown > 0) dr.talkCooldown--;

  if (dr.talkPause > 0) {
    dr.talkPause--;
  } else if (dr.inspectTimer > 0) {
    dr.inspectTimer--; // 바닥에서 빈틈 줍기
  } else if (dr.state === 'idle') {
    dr.x = drHomeX;
    dr.penTick++;
    if (dr.penTick > 400 && Math.random() > 0.6) {
      dr.state = 'walk';
      dr.walkPhase = 'out';
      dr.targetX = benchX - 10;
      dr.penTick = 0;
    }
  } else if (dr.state === 'walk') {
    const drDir = Math.sign(dr.targetX - dr.x);
    dr.x += drDir * 0.28;

    // 모든 지상 식구 근처 지나면 잠깐 멈춤 (도란도란 — 말 거는 자리)
    if (dr.talkCooldown <= 0) {
      const groundBuddies = ['edan', 'clo', 'nyoki', 'lumi', 'muha'];
      for (const bid of groundBuddies) {
        const buddy = crews[bid];
        if (!buddy) continue;
        // 무하는 연못 돌 위에 있을 때 제외하고 데크/연못가 산책 중일 때만 만남
        if (bid === 'muha' && buddy.state === 'idle') continue;
        if (Math.abs(dr.x - buddy.x) < 28 && Math.random() > 0.94) {
          dr.talkPause = 90; // 1.5초 멈춤
          dr.talkCooldown = 240; // 4초 쿨다운
          inkSpots.push({ x: dr.x + 14, alpha: 0.85 });
          break;
        }
      }
    }

    // 가끔 바닥에서 뭔가를 주워 살펴봄 (빈틈 줍기)
    if (dr.talkPause === 0 && Math.random() > 0.997) {
      dr.inspectTimer = 50;
    }

    if (Math.abs(dr.x - dr.targetX) < 1) {
      dr.x = dr.targetX;
      if (dr.walkPhase === 'out') {
        dr.lookTimer++;
        if (dr.lookTimer > 160) {
          dr.walkPhase = 'back';
          dr.targetX = drHomeX;
          dr.lookTimer = 0;
        }
      } else {
        dr.state = 'idle';
      }
    }
  }

  // 도란 특별 모션(고개를 들어 마당 보기) 또는 빈틈 줍기 시각 미세 힌트
  const drDrawY = dr.isSpecial ? dr.y - 1 : (dr.inspectTimer > 0 ? dr.y + 1 : dr.y);
  drawCrewSprite(crewImgs.doran, dr.x, drDrawY, 32, 32);
  if (dr.isSpecial) {
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(dr.x + 15, drDrawY - 4, 2, 2); // 마당 바라보는 작은 시선 점
  }
  drawCrewLabel('도란', dr.x + 5, dr.y + 44);

  // (3) 클로: 기본은 해치 옆 앉기 (꼬리 4~6초 1px·눈 6~10초 깜빡·지나가면 고개 따라가기) + 2~3분마다 고리 1바퀴
  const cl = crews.clo;
  cl.y = groundY - 32;
  const clMaxX = Math.max(deckX + 20, pondX - 36);
  const clHomeX = Math.max(lampX + 44, hatchX - 28);
  if (!cl.initialized) {
    cl.x = clHomeX;
    cl.initialized = true;
  }
  if (cl.x > clMaxX) cl.x = clMaxX; // 리사이즈 시 연못 입수 방지

  const baseWaypoints = [clHomeX, Math.min(benchX - 8, clMaxX), Math.min(benchX + 38, clMaxX), lampX + 30];
  const clWaypoints = (cl.patrolCycle % 3 === 2)
    ? [clHomeX, Math.min(benchX - 8, clMaxX), clMaxX, lampX + 30]
    : baseWaypoints;

  // 눈 깜빡임 (6~10초 주기)
  cl.blinkTimer--;
  if (cl.blinkTimer <= 0) {
    cl.blinkTick = 10;
    cl.blinkTimer = 360 + Math.floor(Math.random() * 240);
  }
  if (cl.blinkTick > 0) cl.blinkTick--;

  if (cl.lookCooldown > 0) cl.lookCooldown--;

  if (cl.state === 'idle') {
    cl.x = clHomeX;

    // 꼬리 끝 1px 까딱 (4~6초 주기)
    cl.tailTimer--;
    if (cl.tailTimer <= 0) {
      cl.tailTick = 16;
      cl.tailTimer = 240 + Math.floor(Math.random() * 120);
    }
    if (cl.tailTick > 0) cl.tailTick--;

    // 누가 24px 안으로 지나가면 비켜 서지 않고 앉은 채 고개를 그쪽으로 한 박자 돌렸다가 돌아오기
    if (cl.lookTimer > 0) {
      cl.lookTimer--;
      if (cl.lookTimer === 0) cl.facing = 1;
    } else if (cl.lookCooldown <= 0) {
      for (const bid of ['edan', 'doran', 'nyoki', 'lumi', 'muha']) {
        const b = crews[bid];
        if (!b || (bid === 'muha' && b.state === 'idle')) continue;
        if (Math.abs(cl.x - b.x) < 24) {
          cl.lookDir = (b.x < cl.x) ? -1 : 1;
          cl.facing = cl.lookDir;
          cl.lookTimer = 48;    // 한 박자 (~0.8초)
          cl.lookCooldown = 180; // 3초 쿨다운
          break;
        }
      }
    }

    // 2~3분에 한 번 고리 한 바퀴 출발 (특별 모션 중엔 대기)
    cl.patrolCooldown--;
    if (cl.patrolCooldown <= 0 && !cl.isSpecial) {
      cl.state = 'patrol';
      cl.patrolIdx = 1;
      cl.lookTimer = 0;
      cl.tailTick = 0;
    }
  } else if (cl.state === 'patrol') {
    const targetIdx = cl.patrolIdx % clWaypoints.length;
    const curDest = clWaypoints[targetIdx];
    const clDir = Math.sign(curDest - cl.x);
    if (clDir !== 0) cl.facing = clDir;
    cl.x += clDir * 0.38;

    // 보라 발자국 생성 (최대 3개까지만 유지)
    if (frame % 28 === 0) {
      if (footprints.length >= 3) footprints.shift();
      footprints.push({ x: cl.x, alpha: 1.0 });
    }

    if (Math.abs(cl.x - curDest) < 2) {
      cl.x = curDest;
      if (targetIdx === 0) {
        // 해치로 돌아와 고리 1바퀴 완주 → 앉기 복귀
        cl.patrolCycle++;
        cl.state = 'idle';
        cl.patrolIdx = 1;
        cl.facing = 1;
        cl.patrolCooldown = 7200 + Math.floor(Math.random() * 3600);
      } else {
        cl.patrolIdx++;
      }
    }
  }

  const clDrawY = (cl.isSpecial && frame % 24 < 12) ? cl.y + 1 : cl.y; // 해치 톡톡 시 살짝 숙임
  ctx.save();
  ctx.translate(cl.x + 16, clDrawY);
  ctx.scale(cl.facing, 1);

  if (cl.state === 'idle') {
    const tipShift = cl.tailTick > 0 ? -1 : 0;
    ctx.fillStyle = '#6d6d75';
    ctx.fillRect(-11, 23, 3, 2);
    ctx.fillStyle = '#8c8c94';
    ctx.fillRect(-12, 22 + tipShift, 1, 2);
  }

  drawCrewSprite(crewImgs.clo, -16, 0, 32, 32);

  if (cl.blinkTick > 0) {
    ctx.fillStyle = '#8c8c94';
    ctx.fillRect(-10, 12, 6, 4);
    ctx.fillRect(4, 12, 6, 4);
    ctx.fillStyle = '#6d6d75';
    ctx.fillRect(-10, 14, 6, 2);
    ctx.fillRect(4, 14, 6, 2);
  } else if (cl.state === 'idle' && cl.lookTimer > 0) {
    ctx.fillStyle = '#5fbf6a';
    ctx.fillRect(-10, 12, 6, 4);
    ctx.fillRect(4, 12, 6, 4);
    ctx.fillStyle = '#16161a';
    ctx.fillRect(-6, 12, 2, 4);
    ctx.fillRect(8, 12, 2, 4);
  }

  ctx.restore();
  drawCrewLabel('클로', cl.x + 5, cl.y + 44);

  // (4) 뇨끼: 받침돌 옆 호흡 부유 (부피 보존: 가로↑↔세로↓, 반응형 폭)
  const ny = crews.nyoki;
  ny.breath = (ny.breath + 0.03) % (Math.PI * 2);
  const breathFactor = Math.sin(ny.breath);
  const amp = ny.isSpecial ? 3 : 2;
  const nyW = Math.floor(32 + breathFactor * amp); // 가로 변화
  const nyH = Math.floor(32 - breathFactor * amp); // 세로 역변화 (부피 보존)
  const nyFloatY = groundY - 35 + breathFactor * 2;

  // 바닥 짙은 타원 그림자 (지면 밀착)
  const nyShadowW = Math.floor(14 + breathFactor * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(ny.x + 16 - nyShadowW, groundY + 12, nyShadowW * 2, 2);
  ctx.fillRect(ny.x + 16 - nyShadowW + 3, groundY + 10, (nyShadowW - 3) * 2, 2);

  // 반응형 이동 경계 + 가끔 연못가 수면 위 살짝 산책 (받침돌 옆 시작, 해치·클로 이름표 겹침 회피)
  if (!ny.initialized) {
    ny.x = nyokiStoneX;
    ny.initialized = true;
  }
  ny.pondTripTimer--;
  const nyMinX = Math.min(Math.max(deckX + 8, hatchX + 28), Math.max(deckX + 8, pondX - 76));
  const nyMaxX = (ny.pondTripTimer <= 0)
    ? Math.min(canvas.width - 40, pondX + 26)
    : Math.max(nyMinX + 40, pondX - 36);

  ny.x += ny.vx;
  if (ny.x <= nyMinX) {
    ny.x = nyMinX;
    ny.vx = Math.abs(ny.vx);
  } else if (ny.x >= nyMaxX) {
    ny.x = nyMaxX;
    ny.vx = -Math.abs(ny.vx);
    if (ny.pondTripTimer <= 0) {
      ny.pondTripTimer = 1400 + Math.floor(Math.random() * 600);
      ny.pondRippled = false;
    }
  }

  // 연못 수면 위로 지나갈 때 민트빛 리플 1회 발생
  if (ny.x > pondX + 6 && !ny.pondRippled) {
    ny.pondRippled = true;
    pondRipples.push({ x: ny.x + 16, y: groundY + 14, r: 2, maxR: 22, alpha: 0.75 });
  }

  drawCrewSprite(crewImgs.nyoki, ny.x - (nyW - 32) / 2, nyFloatY, nyW, nyH);
  const nyLabelY = Math.abs(ny.x - cl.x) < 28 ? nyFloatY + 56 : nyFloatY + 44;
  drawCrewLabel('뇨끼', ny.x + 5, nyLabelY);

  // (5) 루미: 벤치 뒤 난간 메모판 앞 + 모든 지상 식구 가교 이동 + 입자 흔적
  const lm = crews.lumi;
  const lmFloatY = groundY - 46 + Math.sin(frame * 0.04) * 2;
  const lmMaxX = Math.max(deckX + 10, pondX - 38);
  if (lm.x > lmMaxX) lm.x = lmMaxX; // 리사이즈 시 연못 진입 방지

  // 바닥 옅은 타원 그림자 (지면에 매임)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(lm.x + 10, groundY + 10, 14, 2);

  // 가교 이동: 데크/테라스 위 가장 가까운 두 지상 식구 사이로 이동 (연못·상공 제외)
  let pairMidX = Math.min(boardX, lmMaxX);
  let minPairDist = 95;
  const lmCandidates = ['edan', 'doran', 'clo', 'nyoki', 'muha'];
  for (let i = 0; i < lmCandidates.length; i++) {
    for (let j = i + 1; j < lmCandidates.length; j++) {
      const a = crews[lmCandidates[i]];
      const b = crews[lmCandidates[j]];
      if (!a || !b) continue;
      if (a.x >= pondX - 18 || b.x >= pondX - 18) continue;
      const d = Math.abs(a.x - b.x);
      if (d >= 24 && d < minPairDist) {
        minPairDist = d;
        pairMidX = (a.x + b.x) / 2;
      }
    }
  }

  // 다른 지상 식구와 X가 완전히 겹쳐 이름표가 뭉치지 않도록 미세 오프셋 확보
  for (const bid of lmCandidates) {
    const b = crews[bid];
    if (!b || b.x >= pondX - 18) continue;
    if (Math.abs(pairMidX - b.x) < 18) {
      pairMidX += (pairMidX >= b.x ? 18 : -18);
    }
  }

  lm.targetX = Math.max(deckX, Math.min(lmMaxX, pairMidX));
  const lmDir = Math.sign(lm.targetX - lm.x);
  const isLumiMoving = Math.abs(lm.targetX - lm.x) > 2;
  if (isLumiMoving) {
    lm.x += lmDir * 0.25;
    lm.wasMoving = true;
  } else {
    // 멈춘 자리에 입자 1~2개 낙하 후 1초 뒤 사라짐
    lm.particleTimer++;
    if (lm.wasMoving || lm.particleTimer > 220) {
      lm.wasMoving = false;
      lm.particleTimer = 0;
      const count = 1 + Math.floor(Math.random() * 2);
      for (let p = 0; p < count; p++) {
        lumiParticles.push({
          x: lm.x + 12 + Math.random() * 8,
          y: lmFloatY + 26,
          vy: 0.14 + Math.random() * 0.08,
          alpha: 0.9,
          gold: p === 0 && Math.random() > 0.5
        });
      }
    }
  }

  // 루미 3점 공전 위성 입자 (isSpecial 시 느린 반경 스왑 연출)
  for (let orbit = 0; orbit < 3; orbit++) {
    const speed = lm.isSpecial ? 0.08 : 0.04;
    const swapShift = lm.isSpecial ? Math.sin(frame * 0.1 + orbit) * 4 : 0;
    const angle = frame * speed + (orbit * Math.PI * 2 / 3);
    const ox = lm.x + 16 + Math.cos(angle) * (18 - swapShift);
    const oy = lmFloatY + 16 + Math.sin(angle) * (10 + swapShift * 0.5);
    ctx.fillStyle = orbit === 0 ? '#ffd37a' : '#d9c8ff';
    ctx.fillRect(Math.floor(ox - 1), Math.floor(oy - 1), 2, 2);
  }

  drawCrewSprite(crewImgs.lumi, lm.x, lmFloatY, 32, 32);
  drawCrewLabel('루미', lm.x + 5, lmFloatY - 6);

  // (6) 무하: 연못 가운데 징검돌 위 + 60~90초마다 벤치 끝까지 느린 산책 왕복
  const mh = crews.muha;
  const mhHomeX = stones[1].x - 2;
  const mhHomeY = stones[1].y - 28 + crews.jinggeom.bounceY;
  const mhBenchX = benchX + 28;
  const mhGroundY = groundY - 32;

  if (!mh.initialized) {
    mh.x = mhHomeX;
    mh.y = mhHomeY;
    mh.initialized = true;
  }

  if (mh.yieldCooldown > 0) mh.yieldCooldown--;

  if (mh.state === 'idle') {
    mh.x = mhHomeX;
    mh.y = mhHomeY;

    // 12초마다 수면 리플 발생
    mh.rippleTimer++;
    if (mh.rippleTimer > 720) {
      mh.rippleTimer = 0;
      pondRipples.push({ x: mh.x + 16, y: stones[1].y + 10, r: 2, maxR: 26, alpha: 0.7 });
    }

    mh.walkCooldown--;
    if (mh.walkCooldown <= 0) {
      mh.state = 'walk_to_bench';
      mh.targetX = mhBenchX;
    }
  } else if (mh.state === 'walk_to_bench' || mh.state === 'walk_to_stone') {
    if (mh.yieldTimer > 0) {
      mh.yieldTimer--; // 한 박자 늦게 다른 크루가 지나가게 둠
    } else {
      // 다른 지상 크루와 겹치면 먼저 멈춰 양보
      if (mh.yieldCooldown <= 0) {
        for (const bid of ['clo', 'doran', 'edan', 'nyoki']) {
          const b = crews[bid];
          if (Math.abs(mh.x - b.x) < 26) {
            mh.yieldTimer = 45;
            mh.yieldCooldown = 160;
            break;
          }
        }
      }

      mh.targetX = (mh.state === 'walk_to_bench') ? mhBenchX : mhHomeX;
      const mhDir = Math.sign(mh.targetX - mh.x);
      mh.x += mhDir * 0.16; // 다른 크루 속도의 약 절반

      // 징검돌 높이와 데크 바닥 높이 사이 부드러운 보간
      const span = Math.max(1, Math.abs(mhHomeX - mhBenchX));
      const t = Math.max(0, Math.min(1, Math.abs(mh.x - mhHomeX) / span));
      mh.y = mhHomeY + (mhGroundY - mhHomeY) * Math.min(1, t * 2.5);

      if (Math.abs(mh.x - mh.targetX) < 1.5) {
        mh.x = mh.targetX;
        if (mh.state === 'walk_to_bench') {
          mh.state = 'sit_bench';
          mh.y = mhGroundY + 2; // 벤치에 걸터앉은 느낌
          mh.sitTimer = 240; // 4초간 마당 전체를 둘러봄
        } else {
          mh.state = 'idle';
          mh.y = mhHomeY;
          mh.walkCooldown = 3600 + Math.floor(Math.random() * 1800); // 60~90초
        }
      }
    }
  } else if (mh.state === 'sit_bench') {
    mh.y = mhGroundY + 2;
    mh.sitTimer--;
    if (mh.sitTimer <= 0) {
      mh.state = 'walk_to_stone';
      mh.targetX = mhHomeX;
    }
  }

  drawCrewSprite(crewImgs.muha, mh.x, mh.y, 32, 32);
  drawCrewLabel('무하', mh.x + 5, mh.y + 44);

  // (7) 징검: 징검돌 3개 명찰 (연못 디딤돌 일체형)
  drawCrewLabel('징검', stones[0].x + 4, stones[0].y + 24);

  // (8) 혜윰: 상공~지상 가교 순찰 & 48프레임 네이티브 발광 사이클 (반응형 폭)
  const hy = crews.heyum;
  const hyMinX = 36;
  const hyMaxX = Math.max(200, canvas.width - 52);
  hy.x += hy.vx;
  hy.y += hy.vy;
  if (hy.x < hyMinX) { hy.x = hyMinX; hy.vx = Math.abs(hy.vx); }
  else if (hy.x > hyMaxX) { hy.x = hyMaxX; hy.vx = -Math.abs(hy.vx); }
  if (hy.y < 52) { hy.y = 52; hy.vy = Math.abs(hy.vy); }
  else if (hy.y > groundY - 50) { hy.y = groundY - 50; hy.vy = -Math.abs(hy.vy); }

  const hyCycle = frame % 48;
  // 코어 섬광 플래시
  if (hyCycle >= 12 && hyCycle <= 22) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hy.x + 12, hy.y + 10, 8, 6);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(hy.x + 10, hy.y + 12, 12, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hy.x + 16, hy.y + 2, 2, 4);
    ctx.fillRect(hy.x + 28, hy.y + 14, 4, 2);
    ctx.fillRect(hy.x + 16, hy.y + 26, 2, 4);
    ctx.fillRect(hy.x + 2, hy.y + 14, 4, 2);
  }
  // 꼬리 스파크 낙하
  if (hyCycle >= 23 && hyCycle <= 32) {
    ctx.fillStyle = '#fde047';
    ctx.fillRect(hy.x + 10, hy.y + 30 + (hyCycle - 22) * 1.2, 2, 2);
  }
  // 청록 정찰 비트 4점 공전
  for (let b = 0; b < 4; b++) {
    const bAngle = (frame * 0.05) + (b * Math.PI / 2);
    const bx = hy.x + 16 + Math.cos(bAngle) * 18;
    const by = hy.y + 16 + Math.sin(bAngle) * 12;
    ctx.fillStyle = b % 2 === 0 ? '#38bdf8' : '#0284c7';
    ctx.fillRect(Math.floor(bx), Math.floor(by), 2, 2);
  }

  drawCrewSprite(crewImgs.heyum, hy.x, hy.y, 32, 32);
  drawCrewLabel('혜윰', hy.x + 5, hy.y + 44);

  requestAnimationFrame(loop);
}
loop();
