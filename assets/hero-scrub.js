/* KG Auto Repair — HeroScrub, vanilla port of 21st.dev jean.duthil13/hero-scrub
   Same choreography constants as the original (GSAP/React removed):
   PIN 3.2 viewports · card 0.6→1→cover×1.04→0.6 · titles split ±60vw ·
   frames mapped to progress 0.15–0.78 · scrub smoothing 0.4s ·
   batched frame loading (20 eager, then 20 per 80ms) with nearest-frame fallback.
   CONFIG: set frameCount>0 + frameUrl to activate the canvas frame sequence
   (e.g. a licensed car X-ray teardown). With frameCount:0 the card shows the
   fallback <img> already in the markup. */
(() => {
  "use strict";
  const CONFIG = {
    // frameCount:0 => the card shows the real photograph in the markup and the
    // scrub choreography runs on it. Set a count + url only for genuine footage
    // (licensed sequence or video of the actual shop) — never placeholder art.
    frameCount: 0,
    frameUrl: (i) => `assets/frames/${String(i + 1).padStart(4, "0")}.webp`,
    defaultAspect: 16 / 9,
  };
  const PIN_VH_MULTIPLE = 3.2;
  const IMMERSE_OVERFILL = 1.04;
  const CARD_START_DESKTOP = 0.6;
  const CARD_START_MOBILE = 0.82;
  const SCRUB_SMOOTH = 0.4; // seconds, like GSAP scrub:0.4

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const section = document.querySelector(".hscrub");
  if (!section) return;
  section.style.height = `${(PIN_VH_MULTIPLE + 1) * 100}vh`;
  section.classList.add("hscrub-on");

  const card = section.querySelector(".hscrub-card");
  const tTop = section.querySelector(".hscrub-title-top");
  const tBot = section.querySelector(".hscrub-title-bottom");
  const canvas = section.querySelector(".hscrub-canvas");
  const fallbackImg = section.querySelector(".hscrub-fallback");
  let aspect = CONFIG.defaultAspect;
  if (fallbackImg) {
    const setAR = () => { if (fallbackImg.naturalWidth) { aspect = fallbackImg.naturalWidth / fallbackImg.naturalHeight; card.style.setProperty("--ar", aspect); } };
    fallbackImg.complete ? setAR() : fallbackImg.addEventListener("load", setAR, { once: true });
  }

  /* ---- frame sequence loader (verbatim strategy from source) ---- */
  const images = new Array(CONFIG.frameCount);
  let framesOk = CONFIG.frameCount > 0, lastDrawn = -1, errored = 0, sized = false;
  const isLoaded = (i) => { const m = images[i]; return !!m && m.complete && m.naturalWidth > 0; };
  const drawFrame = (index) => {
    if (!framesOk || !canvas) return;
    let u = index;
    if (!isLoaded(u)) {
      let found = -1;
      for (let d = 1; d < CONFIG.frameCount; d++) {
        if (u - d >= 0 && isLoaded(u - d)) { found = u - d; break; }
        if (u + d < CONFIG.frameCount && isLoaded(u + d)) { found = u + d; break; }
      }
      if (found === -1) return; u = found;
    }
    if (lastDrawn === u) return;
    const img = images[u], c = canvas.getContext("2d");
    if (!c || !img) return;
    /* Size the backing store to the frame's native pixels ONCE.
       (A canvas defaults to 300x150 — testing `!canvas.width` is always false,
       which silently downsampled every frame to 300px before upscaling it back.) */
    if (!sized && img.naturalWidth > 0) {
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      aspect = img.naturalWidth / img.naturalHeight;
      card.style.setProperty("--ar", aspect);
      sized = true;
    }
    c.drawImage(img, 0, 0, canvas.width, canvas.height);
    lastDrawn = u;
  };
  if (framesOk) {
    section.classList.add("hscrub-frames");
    const onErr = () => { if (++errored >= 5) { framesOk = false; section.classList.remove("hscrub-frames"); } };
    const loadOne = (i) => { const img = new Image(); img.decoding = "async"; if (i < 4) img.fetchPriority = "high"; img.onerror = onErr; if (i === 0) img.onload = () => drawFrame(0); img.src = CONFIG.frameUrl(i); images[i] = img; };
    const INITIAL = Math.min(20, CONFIG.frameCount);
    for (let i = 0; i < INITIAL; i++) loadOne(i);
    let cursor = INITIAL;
    const loadNext = () => { const end = Math.min(CONFIG.frameCount, cursor + 20); for (let i = cursor; i < end; i++) loadOne(i); cursor = end; if (cursor < CONFIG.frameCount) setTimeout(loadNext, 80); };
    setTimeout(loadNext, 200);
    setTimeout(() => { if (!images[0]?.complete) { framesOk = false; section.classList.remove("hscrub-frames"); } }, 4500);
  }

  /* ---- easings (GSAP equivalents) ---- */
  const cubicOut = (t) => 1 - Math.pow(1 - t, 3);            // power2.out
  const cubicIn = (t) => t * t * t;                           // power2.in
  const cubicInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // power2.inOut
  const quartInOut = (t) => (t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2); // power3.inOut
  const quadIn = (t) => t * t;                                // power1.in
  const seg = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));
  const lerp = (a, b, t) => a + (b - a) * t;

  const startScale = () => (innerWidth < 768 ? CARD_START_MOBILE : CARD_START_DESKTOP);
  /* Measure the card's real layout size (offsetWidth ignores transforms) instead of
     re-deriving it from CSS numbers. Duplicated math drifts the moment the CSS changes,
     which over-magnifies the frame and destroys apparent sharpness. */
  const immerseScale = () => {
    const vw = innerWidth, vh = innerHeight;
    const baseW = card.offsetWidth, baseH = card.offsetHeight;
    if (baseW <= 0 || baseH <= 0) return 1.5;
    return Math.max(vw / baseW, vh / baseH) * IMMERSE_OVERFILL;
  };
  const titleX = () => (innerWidth < 768 ? 70 : 60); // vw

  /* ---- scrub loop (rAF; smoothed like scrub:0.4) ---- */
  let smooth = 0, last = performance.now(), raf = null;
  const apply = (p) => {
    const sS = startScale(), iS = immerseScale(), tx = titleX();
    let scale, x, tOp = 1, ls;
    if (p <= 0.15) {
      const t = seg(p, 0, 0.15);
      scale = lerp(sS, 1, cubicOut(t));
      x = lerp(0, tx, cubicInOut(t));
      ls = lerp(-0.04, 0.02, cubicInOut(t));
    } else if (p <= 0.78) {
      scale = lerp(1, iS, cubicIn(seg(p, 0.15, 0.78)));
      x = tx; ls = 0.02;
      tOp = 1 - quadIn(seg(p, 0.15, 0.37));
      if (framesOk) drawFrame(Math.min(CONFIG.frameCount - 1, Math.floor(seg(p, 0.15, 0.78) * CONFIG.frameCount)));
    } else {
      const t = seg(p, 0.78, 1);
      scale = lerp(iS, sS, quartInOut(t));
      x = lerp(tx, 0, cubicInOut(t));
      ls = lerp(0.02, -0.04, cubicInOut(t));
      tOp = cubicInOut(t);
    }
    card.style.transform = `scale(${scale})`;
    tTop.style.transform = `translateX(${-x}vw)`;
    tBot.style.transform = `translateX(${x}vw)`;
    tTop.style.opacity = tBot.style.opacity = tOp;
    tTop.style.letterSpacing = tBot.style.letterSpacing = ls + "em";
  };
  const tick = (now) => {
    const r = section.getBoundingClientRect();
    const total = r.height - innerHeight;
    const target = Math.min(1, Math.max(0, -r.top / total));
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    smooth += (target - smooth) * (1 - Math.exp(-dt / SCRUB_SMOOTH * 3));
    if (Math.abs(target - smooth) < 0.0005) smooth = target;
    apply(smooth);
    raf = requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (e.isIntersecting && raf === null) { last = performance.now(); raf = requestAnimationFrame(tick); }
      else if (!e.isIntersecting && raf !== null) { cancelAnimationFrame(raf); raf = null; }
    });
  });
  io.observe(section);
  apply(0);
})();
