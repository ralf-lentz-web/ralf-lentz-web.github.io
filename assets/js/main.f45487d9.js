/* FAE ecoled – Verhalten der Seite (ohne Fremdbibliotheken)
   Erweitert auf Grundlage der Original-Skripte: Kopfzeile, Menü, Hero-Slider, Fakten-Karten,
   Lichtfarben-Umschalter, Projekt-Slider, Scroll-Zitate, Zähler, Cover-Slider. */
(function () {
  "use strict";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* Breite einer festen Bildlaufleiste (Maus statt Trackpad) als --sbw: 100vw zählt sie mit, Blöcke über die volle Breite ziehen sie ab */
  const bildlauf = () => document.documentElement.style.setProperty("--sbw", (window.innerWidth - document.documentElement.clientWidth) + "px");
  bildlauf(); window.addEventListener("resize", bildlauf);

  /* ---------- Kopfzeile: nach 45 % der Fensterhöhe wird sie dunkel ---------- */
  (function header() {
    const header = $(".site-header");
    if (!header) return;
    const update = () => header.classList.toggle("is-scrolled", window.scrollY > window.innerHeight * 0.45 || header.dataset.solid === "1");
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  })();

  /* ---------- Mobiles Menü ---------- */
  (function offcanvas() {
    const btn = $(".menu-toggle"), panel = $(".offcanvas"), header = $(".site-header");
    if (!btn || !panel) return;
    const set = (open) => { btn.setAttribute("aria-expanded", open); panel.classList.toggle("is-open", open); header.classList.toggle("has-offcanvas-open", open); };
    btn.addEventListener("click", () => set(btn.getAttribute("aria-expanded") !== "true"));
    panel.addEventListener("click", (e) => { if (e.target.closest("a") || e.target === panel) set(false); });   // e.target === panel: Tipp auf die Abdunklung
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
  })();

  /* ---------- Einfacher Schiebe-Slider (Hero + Projekt-Cover) ---------- */
  // loop: hinter der letzten Folie liegt eine Kopie der ersten. Der Slider schiebt immer vorwärts
  // dorthin und springt danach unsichtbar auf die echte erste Folie – kein Zurückspulen über alle Bilder.
  function slider(root, opts) {
    const track = $(opts.track, root), slides = $$(opts.slide, root), bullets = $$(opts.bullet, root);
    if (!track || slides.length < 2) return;
    const n = slides.length;
    if (opts.loop) { const c = slides[0].cloneNode(true); c.setAttribute("aria-hidden", "true"); track.appendChild(c); }
    // Bilder vorab dekodieren, damit das erste Hereinschieben nicht ruckelt
    $$("img", track).forEach((im) => { im.decoding = "async"; if (im.decode) im.decode().catch(() => {}); });
    let index = 0, pos = 0, timer = null, paused = false, settle = null, hidden = false;
    // Kamerafahrt (Ralf 08.10.2026): Jedes Foto zoomt über seine ganze Standzeit langsam auf seinen Fluchtpunkt zu – als würde
    // man in den Raum hineingezogen. Die Texte stehen still, dadurch entsteht die Tiefenwirkung. Dauer = Hereinschieben +
    // Stehen + Hinausschieben, weich an- und auslaufend (Easy Ease), nur 5 % – Ralf fand 10 % linear zu kräftig. Web Animations API: läuft auf der Grafikkarte, ohne Layout.
    const kb = opts.zoom && !reduceMotion ? { dauer: opts.autoplay + 2 * opts.speed, faktor: opts.zoom } : null;
    const kbBild = (el) => el && $("img", el);
    const kbUrsprung = (im) => {   // Fluchtpunkt im Bild -> Punkt im sichtbaren Ausschnitt (object-fit: cover, mittig)
      const f = (im.dataset.fokus || "0.5 0.5").split(" ").map(Number), W = im.clientWidth, H = im.clientHeight;
      const w = +im.getAttribute("width") || W, h = +im.getAttribute("height") || H, sk = Math.max(W / w, H / h);
      const x = (W - w * sk) / 2 + f[0] * w * sk, y = (H - h * sk) / 2 + f[1] * h * sk;
      // auf 20–80 % begrenzt: ein Ursprung am Bildrand wirkt wie ein seitliches Wegschieben statt wie ein Hineinfahren
      im.style.transformOrigin = `${Math.min(Math.max(x / W, .2), .8) * 100}% ${Math.min(Math.max(y / H, .2), .8) * 100}%`;
    };
    const kbStart = (el, ab = 0) => {
      const im = kbBild(el); if (!kb || !im || im.dataset.zoom === "aus") return null;   // data-zoom="aus": Bild soll nicht skaliert werden (Ralf)
      if (im._kb) im._kb.cancel();
      kbUrsprung(im);
      im._kb = im.animate([{ transform: "scale(1)" }, { transform: `scale(${kb.faktor})` }], { duration: kb.dauer, easing: "cubic-bezier(.33, 0, .67, 1)", fill: "forwards" }   /* „Easy Ease“ wie in After Effects (Ralf) */);
      im._kb.currentTime = ab; if (hidden) im._kb.pause();
      return im._kb;
    };
    const kbStopp = (el, nach) => { const im = kbBild(el); if (!im || !im._kb) return; const a = im._kb; setTimeout(() => { if (im._kb === a) { a.cancel(); im._kb = null; } }, nach); };
    const kbAlle = (fn) => $$(`${opts.slide} img`, track).forEach((im) => im._kb && fn(im._kb));
    const gap = parseFloat(getComputedStyle(track).gap) || 0;
    const step = () => slides[0].getBoundingClientRect().width + gap;
    const offset = () => (opts.centered ? (root.clientWidth - slides[0].getBoundingClientRect().width) / 2 : 0);
    const place = (p, animate) => {
      pos = p;
      track.style.transition = animate && !reduceMotion ? `transform ${opts.speed}ms cubic-bezier(.4,0,.2,1)` : "none";
      track.style.transform = `translate3d(${offset() - p * step()}px,0,0)`;
    };
    const go = (i, instant) => {
      const target = ((i % n) + n) % n;
      clearTimeout(settle);
      const alt = track.children[pos], weich = !(instant || reduceMotion);
      if (instant || reduceMotion) place(target, false);
      else if (opts.loop && index === n - 1 && target === 0) {
        // vorwärts auf die Kopie, danach unsichtbar auf die echte erste Folie
        place(n, true);
        const klon = track.children[n], a = kbStart(klon);
        settle = setTimeout(() => { place(0, false); kbStart(slides[0], a ? a.currentTime : 0); kbStopp(klon, 0); }, opts.speed + 30);
      } else if (opts.loop && index === 0 && target === n - 1 && i < 0) {
        // rückwärts: erst unsichtbar auf die Kopie, dann zur letzten Folie schieben
        place(n, false); void track.offsetWidth; place(n - 1, true);
      } else { place(target, true); kbStart(slides[target]); }
      if (instant || reduceMotion) kbStart(slides[target]);
      if (alt && alt !== track.children[pos] && alt !== slides[target]) kbStopp(alt, weich ? opts.speed + 60 : 0);   // erst nach dem Hinausschieben zurücksetzen
      index = target;
      bullets.forEach((b, k) => b.classList.toggle("is-active", k === index));
      root.classList.toggle("is-video-slide", slides[index].hasAttribute("data-video"));
      slides.forEach((s, k) => {
        const v = $("video", s); if (!v) return;
        // Video erst starten, wenn die Folie fertig hereingeschoben ist – so ist die Animation komplett zu sehen.
        if (k === index) { v.pause(); v.currentTime = 0; clearTimeout(v._t); v._t = setTimeout(() => { if (slides[index] === s) v.play().catch(() => {}); }, instant || reduceMotion ? 0 : opts.speed); }
        else { clearTimeout(v._t); if (!v.paused) v.pause(); if (k === (index + 1) % n && v.preload === "none") { v.preload = "auto"; v.load(); } }
      });
      if (timer) start();
    };
    // Video-Folie: kein Takt, das Video läuft einmal komplett und schiebt danach selbst weiter.
    const start = () => {
      stop();
      if (!opts.autoplay || reduceMotion || paused || hidden) return;
      if (slides[index].hasAttribute("data-video")) { timer = "video"; return; }
      timer = setTimeout(() => go(index + 1), opts.autoplay + opts.speed);
    };
    const stop = () => { if (timer && timer !== "video") clearTimeout(timer); timer = null; };
    slides.forEach((s) => { const v = $("video", s); if (v) v.addEventListener("ended", () => { if (s === slides[index] && opts.autoplay && !reduceMotion) go(index + 1); }); });
    bullets.forEach((b, k) => b.addEventListener("click", () => { go(k); start(); }));
    // Anhalten beim Drüberfahren nur, wo gewünscht – das Startbild füllt den Bildschirm, dort läge die Maus immer darüber
    if (opts.pauseOnHover !== false) {
      root.addEventListener("mouseenter", () => { paused = true; stop(); });
      root.addEventListener("mouseleave", () => { paused = false; start(); });
    }
    window.addEventListener("resize", () => { clearTimeout(settle); place(index, false); $$(`${opts.slide} img`, track).forEach((im) => im._kb && kbUrsprung(im)); });
    // Außerhalb des Bildes anhalten: ein unsichtbarer Slider würde alle paar Sekunden eine riesige Fläche neu zeichnen –
    // genau das ruckelt beim Lesen weiter unten. Die Klasse is-sichtbar steuert zudem will-change im CSS.
    if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => {
      hidden = !e.isIntersecting; root.classList.toggle("is-sichtbar", e.isIntersecting);
      const v = $("video", slides[index]);
      if (hidden) { stop(); if (v && !v.paused) v.pause(); kbAlle((a) => a.pause()); }
      else { if (v && v.paused && v.currentTime > 0 && v.currentTime < v.duration) v.play().catch(() => {}); kbAlle((a) => a.playState !== "finished" && a.play()); start(); }
    }, { rootMargin: "0px" }).observe(root);
    // Wischen
    let x0 = null;
    root.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
    root.addEventListener("pointerup", (e) => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) { go(index + (dx < 0 ? 1 : -1)); start(); } });
    go(0, true);
    start();
  }
  $$(".hero").forEach((h) => slider(h, { track: ".hero__track", slide: ".hero__slide", bullet: ".hero__bullets .bullet", speed: 1500, autoplay: 5000, loop: true, pauseOnHover: false, zoom: 1.05 }));
  // Projektseiten (Ralf 08.10.2026): Cover-Slider vollflächig wie das Startbild, gleiche Taktung und Kamerafahrt
  $$(".cover").forEach((c) => slider(c, { track: ".cover__track", slide: ".cover__slide", bullet: ".cover__bullets .bullet", speed: 1500, autoplay: 5000, loop: true, pauseOnHover: false, zoom: 1.05 }));
  // Bereichsseiten mit mehreren Kopfbildern (Ralf 09.10.2026, Health): derselbe Slider
  $$(".bs-hero--slider").forEach((c) => slider(c, { track: ".bs-hero__track", slide: ".bs-hero__slide", bullet: ".bs-hero__bullets .bullet", speed: 1500, autoplay: 5000, loop: true, pauseOnHover: false, zoom: 1.05 }));
  // Kopf mit Video (Ausgabe 10: Zeitraffer 3D-Drucker, Ralf 11.10.2026): läuft stumm in Schleife, solange der Kopf im Bild ist, und blendet
  // erst ein, wenn es wirklich läuft – bis dahin steht das gleiche Standbild. „Bewegung reduzieren“: nur das Standbild, nichts laden.
  // data-kopf="einmal" (Ausgabe 10 seit 11.10.2026: „läuft nicht im Loop, nur als Start beim Öffnen der Seite“): ohne Schleife; nach dem
  // Ende bleibt das letzte Bild stehen (das Abbremsen steckt im Video selbst), kein Neustart beim Zurückscrollen.
  $$(".bs-hero__film").forEach((v) => {
    if (reduceMotion) return;
    v.addEventListener("playing", () => v.classList.add("spielt"));
    let fertig = false;
    if (v.dataset.kopf === "einmal") v.addEventListener("ended", () => { fertig = true; v.classList.add("ist-fertig"); });
    const spielen = () => { if (fertig) return; if (v.preload !== "auto") v.preload = "auto"; v.play().catch(() => {}); };   // erst laden, wenn es wirklich losgeht
    // Erst nach dem Laden der Seite beobachten (Prüfung 11.10.2026): Mit Sprungmarke (#film) meldete der Beobachter den Kopf als sichtbar,
    // bevor der Browser hingesprungen war – das Video lief kurz an und lud 37 MB, obwohl man es nie sah.
    // Auch nach „load“ stand der Sprung noch aus (gemessen) – zeigt die Sprungmarke auf etwas unterhalb des Kopfs, zählt die erste Meldung nicht
    let ersteAuslassen = (() => { try { const z = location.hash && document.querySelector(location.hash); return !!z && !z.closest(".bs-hero"); } catch { return false; } })();
    const los = () => { if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { if (ersteAuslassen) { ersteAuslassen = false; return; } e.isIntersecting ? spielen() : v.pause(); }).observe(v); else spielen(); };
    if (document.readyState === "complete") requestAnimationFrame(los); else addEventListener("load", () => requestAnimationFrame(los), { once: true });
    // Gerät gedreht (Prüfung 11.10.2026): <source media> wird nur beim Laden gewählt – sonst bliebe das Hochkant-Video im Querrahmen.
    // Neu wählen lassen und an derselben Stelle weitermachen bzw. wieder auf dem letzten Bild stehen.
    matchMedia("(orientation: portrait)").addEventListener("change", () => {
      const t = v.currentTime, lief = !v.paused;
      v.classList.remove("spielt");
      v.load();
      v.addEventListener("loadedmetadata", () => {
        v.currentTime = fertig ? Math.max(0, v.duration - 0.05) : Math.min(t, v.duration || t);
        if (fertig) v.addEventListener("seeked", () => v.classList.add("spielt"), { once: true });
        else if (lief) v.play().catch(() => {});
      }, { once: true });
    });
  });
  // Kopfbild mit Anker (Refurbishment, Ralf 11.10.2026: „im goldenen Schnitt ausrichten – das weiße Logo auf der Maschine im goldenen Schnitt
  // mit der Schrift Refurbishment“): Ein Punkt im Bild (data-anker, Anteile) wird auf ein Ziel im Rahmen gelegt (data-ziel quer / data-ziel-hoch,
  // „x y“, y = „titel“ → Mitte der Überschrift). Maßstab so klein wie möglich, aber nie unter „cover“ und so, dass kein Rand frei wird.
  // Das Heranfahren beim Öffnen (bs-heran) dreht um den Anker – das Logo bleibt dabei stehen.
  $$(".bs-hero__bild[data-anker]").forEach((im) => {
    const [px, py] = im.dataset.anker.split(" ").map(Number);
    const rahmen = im.closest(".bs-hero__slide"), titel = im.closest(".bs-hero")?.querySelector(".bs-hero__titel");
    const hochkant = matchMedia("(orientation: portrait)");
    const setzen = () => {
      const W = rahmen.clientWidth, H = rahmen.clientHeight, w = +im.getAttribute("width"), h = +im.getAttribute("height");
      if (!W || !H || !w || !h) return;
      const [zx, zy] = (hochkant.matches ? im.dataset.zielHoch : im.dataset.ziel).split(" ");
      // Überschrift: Lage des Textblocks (mit seiner festen Zentrier-Verschiebung) + offsetTop darin – nicht das Rechteck der Überschrift
      // selbst, die fährt beim Öffnen ein (Animation mit Verschiebung)
      const mitteTitel = () => { const blk = titel.offsetParent || titel.parentElement; return blk.getBoundingClientRect().top + titel.offsetTop + titel.offsetHeight / 2 - rahmen.getBoundingClientRect().top; };
      const tx = +zx, ty = zy === "titel" && titel ? mitteTitel() / H : +zy;
      const s = Math.max(W / w, H / h, (tx * W) / (px * w), ((1 - tx) * W) / ((1 - px) * w), (ty * H) / (py * h), ((1 - ty) * H) / ((1 - py) * h));
      Object.assign(im.style, { width: `${w * s}px`, height: `${h * s}px`, left: `${tx * W - px * w * s}px`, top: `${ty * H - py * h * s}px`, transformOrigin: `${px * 100}% ${py * 100}%` });
      im.dataset.gesetzt = "";
    };
    setzen();
    addEventListener("resize", setzen, { passive: true });
    if (document.fonts) document.fonts.ready.then(setzen);   // Überschrift erst mit der Schrift in endgültiger Höhe
  });
  // Kamera zum einmal laufenden Kopfvideo (Ralf 11.10.2026: „leichter Parallax-Zoom-out-Effekt für das Video“):
  // Zoom-out 1,08 → 1 im Takt des Videos – Fortschritt wie in tools/einmal.swift (Echtzeit, die letzten `data-auslauf` s kubisch abgebremst),
  // so kommen Bild und Zoom gemeinsam zur Ruhe. Parallaxe: Beim Scrollen bleibt das Bild um 12 % des Weges zurück und wird um denselben
  // Anteil größer (Drehpunkt unten, CSS), damit oben im Rahmen keine Lücke aufgeht. Nur solange der Kopf im Bild ist.
  $$(".bs-hero__kamera").forEach((kam) => {
    if (reduceMotion) return;
    const zoom = kam.querySelector(".bs-hero__zoom"), v = kam.querySelector("video"), hero = kam.closest(".bs-hero");
    const Z = 0.08, F = 0.12, E = +(v.dataset.auslauf || 3);
    const fortschritt = () => {
      const T = v.duration; if (!T) return 0;
      const a = Math.max(0, T - E), t = Math.min(v.currentTime, T);
      const s = t <= a ? t : a + (E / 3) * (1 - Math.pow(1 - (t - a) / E, 3));   // Quellzeit wie im Video
      return Math.min(1, s / (a + E / 3));
    };
    let sichtbar = true, plan = 0, zLetzt = -1, pLetzt = -1;
    const zeichne = () => {
      plan = 0;
      const z = 1 + Z * (1 - fortschritt());
      const r = hero.getBoundingClientRect(), weg = Math.min(Math.max(-r.top, 0), r.height), p = F * weg;
      if (Math.abs(z - zLetzt) > 1e-5) { zoom.style.setProperty("--kopf-zoom", z.toFixed(5)); zLetzt = z; }
      if (Math.abs(p - pLetzt) > 0.1) { kam.style.transform = `translate3d(0, ${p.toFixed(1)}px, 0) scale(${(1 + p / kam.offsetHeight + 0.002).toFixed(5)})`; pLetzt = p; }   // Höhe der Ebene selbst (Rahmen, nicht Kopfbereich); +0,2 % gegen Rundung
      if (sichtbar && !v.paused && !v.ended) plan = requestAnimationFrame(zeichne);   // läuft das Video, jedes Bild nachführen
    };
    const anstossen = () => { if (!plan && sichtbar) plan = requestAnimationFrame(zeichne); };
    ["playing", "seeked", "ended", "loadedmetadata"].forEach((ev) => v.addEventListener(ev, anstossen));
    addEventListener("scroll", anstossen, { passive: true });
    addEventListener("resize", anstossen, { passive: true });
    if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { sichtbar = e.isIntersecting; anstossen(); }).observe(hero);
    anstossen();
  });

  /* ---------- Videos in Inhaltsblöcken: erst laden und abspielen, wenn sie ins Bild kommen ---------- */
  (function inviewVideos() {
    const vids = $$("video[data-inview]");
    if (!vids.length || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => entries.forEach(({ target: v, isIntersecting }) => {
      if (isIntersecting) {
        if (v.preload === "none") { v.preload = "auto"; v.load(); }
        if (!reduceMotion) v.play().catch(() => {});
      } else v.pause();
    }), { rootMargin: "200px 0px" });
    vids.forEach((v) => io.observe(v));
  })();

  /* ---------- Hauptmenü als Faltenbalg (Ralf 08.10.2026, Vorlage „BellowsCrumb“) ----------
     Natürliche Breiten aus einer unsichtbaren Kopie (nie aus der sichtbaren, schon abgeschnittenen Reihe). Gesamtbreite fest:
     breitester Punkt + je Falte FALTE px. Offen ist: überfahren ?? fokussiert ?? aktuell. Aktuell = die Seite (aria-current)
     bzw. auf der Startseite der Abschnitt, in dem man gerade liest (sonst der nächste darunter). Maus: nur echte Bewegung
     zählt (pointermove), nicht das Verschieben der Punkte unter dem stehenden Zeiger – sonst flackert es. Touch: erstes Tippen
     auf eine Falte öffnet sie, zweites folgt dem Link. */
  $$(".main-nav.balg").forEach(function faltenbalg(nav) {   // mehrere Menüs: Kopfzeile + Testseite Navigation
    const FALTE = 52, SEP = 26;
    const reihe = $(".balg__reihe", nav), segs = $$(".balg__seg", reihe), seps = $$(".balg__sep", reihe), links = segs.map((s) => s.firstElementChild);   // Link oder Titel (span)
    const n = segs.length;
    const geist = reihe.cloneNode(true); geist.classList.add("balg__geist"); geist.setAttribute("aria-hidden", "true"); geist.inert = true;
    nav.appendChild(geist);
    let natur = [], gesamt = 0, ueber = null, fokus = null, aktuell = 0, typ = "mouse", offenBeimDruck = -1;
    const breiten = (offen) => {   // wie computeWidths der Vorlage
      if (n === 1) return [gesamt];
      const offenB = Math.min(natur[offen], gesamt - FALTE * (n - 1)), extra = gesamt - offenB - FALTE * (n - 1);
      const rest = natur.reduce((sum, w, i) => (i === offen ? sum : sum + w), 0) || 1;
      return natur.map((w, i) => (i === offen ? offenB : FALTE + extra * (w / rest)));
    };
    const zeigen = () => {
      if (!natur.length) return;
      const offen = ueber ?? fokus ?? aktuell, b = breiten(offen);
      segs.forEach((s, i) => { s.style.flexBasis = b[i] + "px"; s.dataset.zustand = i === offen ? "offen" : "gefaltet"; });
      seps.forEach((sp, i) => sp.classList.toggle("nach-rechts", offen > i));
      // Ziel-Lage des offenen Punkts für Leuchte/Kapsel (Varianten b, c): gleiche Kurve wie die Falten, also immer deckungsgleich
      const x = reihe.offsetLeft + b.slice(0, offen).reduce((sum, w) => sum + w, 0) + offen * SEP;
      nav.style.setProperty("--balg-x", x.toFixed(2) + "px"); nav.style.setProperty("--balg-b", b[offen].toFixed(2) + "px");
    };
    const messen = () => {
      natur = $$(".balg__seg", geist).map((s) => s.getBoundingClientRect().width);
      if (natur.some((w) => !w)) { natur = []; return; }
      // Platz zwischen Logo und Kontakt-Knopf: lange Titel (Projekt-/Artikelseiten) werden gekürzt („…“), statt hineinzulaufen
      const platz = Math.max(FALTE * n + 60, innerWidth - 500) - SEP * (n - 1) - 24;
      gesamt = Math.min(Math.max(...natur) + FALTE * (n - 1), platz);
      reihe.style.width = gesamt + SEP * (n - 1) + "px";
      zeigen();
    };
    // aktueller Punkt
    const ziele = links.map((a) => { if (!a.href) return null; const u = new URL(a.href, location.href); return u.pathname === location.pathname && u.hash ? document.getElementById(u.hash.slice(1)) : null; });
    const seite = links.findIndex((a) => a.getAttribute("aria-current") === "page" || (a.href && new URL(a.href, location.href).href === location.href.split("#")[0]));
    aktuell = Math.max(0, seite);
    if (ziele.some(Boolean)) {
      let plan = 0;
      const lesen = () => {
        plan = 0;
        const linie = innerHeight * 0.4;
        const r = ziele.map((z) => (z ? z.getBoundingClientRect() : null));
        let i = r.findIndex((q) => q && q.top <= linie && q.bottom > linie);
        // zwischen zwei Menü-Abschnitten (z. B. Mehrwert, Zahlen, Unternehmen): der zuletzt durchlaufene bleibt offen; ganz oben der erste
        if (i < 0) { let best = -Infinity; r.forEach((q, k) => { if (q && q.top <= linie && q.top > best) { best = q.top; i = k; } }); }
        if (i < 0) { let best = Infinity; r.forEach((q, k) => { if (q && q.top > linie && q.top < best) { best = q.top; i = k; } }); }
        if (i >= 0 && i !== aktuell) { aktuell = i; zeigen(); }
      };
      addEventListener("scroll", () => { if (!plan) plan = requestAnimationFrame(lesen); }, { passive: true });
      lesen();
    }
    // Maus, Tastatur, Touch
    reihe.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const s = e.target.closest(".balg__seg"); if (!s) return;   // über einem Pfeil: nichts ändern (Durchgang zum Nachbarn)
      const i = segs.indexOf(s); if (i !== ueber) { ueber = i; zeigen(); }
    });
    reihe.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && ueber !== null) { ueber = null; zeigen(); } });
    // Zustand beim Drücken merken: das Antippen fokussiert den Link schon VOR dem click – der Fokus allein öffnet die Falte sonst
    reihe.addEventListener("pointerdown", (e) => { typ = e.pointerType; offenBeimDruck = segs.findIndex((s) => s.dataset.zustand === "offen"); });
    links.forEach((a, i) => {
      a.addEventListener("focus", () => { fokus = i; zeigen(); });
      a.addEventListener("blur", (e) => { if (!segs.some((s) => s.contains(e.relatedTarget))) { fokus = null; zeigen(); } });
      a.addEventListener("click", (e) => {
        if ((e.pointerType || typ) === "mouse" || !e.detail || i === offenBeimDruck) return;   // Maus, Tastatur (detail 0) oder schon offen: Link folgen
        e.preventDefault(); ueber = i; zeigen();   // Touch: erst aufziehen
      });
    });
    document.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" && ueber !== null && !nav.contains(e.target)) { ueber = null; zeigen(); } });
    messen();
    let neu = 0;   // Menü ist erst ab 1025 px sichtbar: wird das Fenster später breiter gezogen, jetzt messen
    addEventListener("resize", () => { if (!neu) neu = requestAnimationFrame(() => { neu = 0; messen(); }); });
    requestAnimationFrame(() => requestAnimationFrame(() => nav.classList.add("balg--an")));
    if (document.fonts) document.fonts.ready.then(() => { nav.classList.remove("balg--an"); messen(); requestAnimationFrame(() => requestAnimationFrame(() => nav.classList.add("balg--an"))); });
  });

  /* ---------- Videos, die genau einmal laufen (data-einmal, z. B. Schwimmhalle) ----------
     Start erst, wenn das Video zur Hälfte im Bild ist; aus dem Bild gescrollt pausiert es und läuft beim Zurückkommen
     weiter. Nach dem Ende bleibt das letzte Bild stehen – kein Neustart, keine Schleife. */
  (function einmalVideos() {
    $$("video[data-einmal]").forEach((v) => {
      let fertig = false;
      v.addEventListener("ended", () => { fertig = true; });
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { if (v.preload === "none") { v.preload = "auto"; v.load(); } }
        if (fertig) return;
        if (e.intersectionRatio >= 0.5 && !reduceMotion) v.play().catch(() => {});
        else if (!v.paused) v.pause();
      }, { threshold: [0, 0.5] }).observe(v);
      if (reduceMotion) { v.preload = "auto"; v.addEventListener("loadeddata", () => { v.currentTime = Math.max(0, v.duration - 0.05); }, { once: true }); }   // ohne Bewegung: gleich das Endbild
    });
  })();

  /* ---------- Videos mit weicher Überblendung am Ende (data-crossfade) ----------
     Eine zweite Kopie startet kurz vor Schluss von vorn und blendet über das Ende – kein harter Sprung zum Anfang. */
  (function crossfadeVideos() {
    const BLENDE = 2.5, KURVE = "cubic-bezier(.45, 0, .55, 1)";   // Sekunden; sanft an- und auslaufend
    $$("video[data-crossfade]").forEach((a) => {
      const b = a.cloneNode(true); b.removeAttribute("aria-label"); b.setAttribute("aria-hidden", "true");
      a.after(b);
      let vorn = a, hinten = b, blendet = false, sichtbar = false;
      [a, b].forEach((v) => { v.style.transition = `opacity ${BLENDE}s ${KURVE}`; });
      const tick = () => {
        if (blendet || !sichtbar || reduceMotion || !vorn.duration) return;
        if ((vorn.duration - vorn.currentTime) / (vorn.playbackRate || 1) > BLENDE + 0.3) return;   // timeupdate kommt nur ca. 4× pro Sekunde; Restzeit in echten Sekunden (Zeitlupe)
        blendet = true;
        const alt = vorn, neu = hinten;
        neu.currentTime = 0; neu.style.zIndex = 2; alt.style.zIndex = 1;
        neu.play().catch(() => {});
        requestAnimationFrame(() => { neu.style.opacity = 1; });
        setTimeout(() => {
          alt.pause(); alt.style.transition = "none"; alt.style.opacity = 0; alt.currentTime = 0;
          void alt.offsetWidth; alt.style.transition = `opacity ${BLENDE}s ${KURVE}`;   // sofort weg, ohne Animation
          vorn = neu; hinten = alt; blendet = false;
        }, BLENDE * 1000 + 60);
      };
      [a, b].forEach((v) => { v.addEventListener("timeupdate", tick); v.addEventListener("ended", () => { if (v === vorn && !blendet) { v.currentTime = 0; v.play().catch(() => {}); } }); });
      a.style.opacity = 1;
      new IntersectionObserver(([e]) => {
        sichtbar = e.isIntersecting;
        if (sichtbar) {
          [a, b].forEach((v) => { if (v.preload === "none") { v.preload = "auto"; v.load(); } });
          if (!reduceMotion) vorn.play().catch(() => {});
        } else { a.pause(); b.pause(); }
      }, { rootMargin: "200px 0px" }).observe(a.parentElement);
    });
  })();

  /* ---------- Zeitlupe (data-tempo="0.5"): läuft nach den Überblend-Kopien, damit auch die Kopie langsam läuft.
     defaultPlaybackRate überlebt load(), playbackRate allein würde beim Nachladen auf 1 zurückspringen. */
  $$("video[data-tempo]").forEach((v) => {
    const t = parseFloat(v.dataset.tempo) || 1;
    v.defaultPlaybackRate = t; v.playbackRate = t;
    v.addEventListener("play", () => { if (v.playbackRate !== t) v.playbackRate = t; });
  });

  /* ---------- Lichtschalter (WTC, Gemäldegalerie): Licht geht beim Scrollen an ----------
     Die Lichtquelle geht Stück für Stück an (Reihenfolge im Grünkanal der Kern-Textur); jede Stelle wird so hell, wie Licht der schon leuchtenden
     Bandstücke bei ihr ankommt (17 vorberechnete Stufen, dazwischen weich gemischt, in Lichtwerten statt Pixelwerten). */
  (function lichtschalter() {
    $$("[data-lichtschalter]").forEach((sec) => {
      const base = sec.dataset.lichtschalter, cfg = JSON.parse(sec.dataset.config);
      const canvas = $(".lichtschalter__canvas", sec), anImg = $(".lichtschalter__an", sec), stage = $(".lichtschalter__stage", sec);
      const ZOOM = 0.08;   // Zoom-out beim Einschalten: startet 8 % vergrößert, endet bei 100 % (Ralf: höchstens 10 %)
      const clamp = (v) => Math.min(1, Math.max(0, v));
      const ease = (t) => t * t * (3 - 2 * t);
      // 0–8 %: dunkel · 8–85 %: Licht läuft an · danach: hell
      const progressToS = (p) => ease(clamp((p - 0.08) / 0.77));
      let target = 0, shown = 0, running = false, visible = false, gl = null, draw = null;

      const fallback = (s) => { anImg.style.opacity = Math.pow(s, 1.6).toFixed(3); };

      // Film-Modus: Einzelbilder eines Videos (Tag -> Abend), je nach Scrollstand das passende Bild, zwischen zwei Bildern
      // weich überblendet. JPEG (entpackt doppelt so schnell wie WebP), Größe nach Bildschirm, Laden in der Leerlaufzeit.
      const film = cfg.film ? (() => {
        const breite = Math.min(screen.width, innerWidth) * Math.min(devicePixelRatio || 1, 2) > 1400 ? cfg.breiten.at(-1) : cfg.breiten[0];
        const bilder = new Array(cfg.bilder).fill(null), ctx = canvas.getContext("2d", { alpha: false });
        let geladen = 0, gestartet = false, letztes = -1;
        const groesse = () => { const r = canvas.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d); letztes = -1; };
        const cover = (bm) => {   // object-fit: cover mit fokusY
          const cw = canvas.width, ch = canvas.height, s = Math.max(cw / bm.width, ch / bm.height), w = bm.width * s, h = bm.height * s;
          return [(cw - w) / 2, (ch - h) * cfg.fokusY, w, h];
        };
        const naechstes = (i) => { for (let d = 0; d < bilder.length; d++) { if (bilder[i - d]) return bilder[i - d]; if (bilder[i + d]) return bilder[i + d]; } return null; };
        return {
          get bereit() { return geladen > 0 && bilder[0] && bilder[cfg.bilder - 1]; },
          laden() {
            if (gestartet) return; gestartet = true; groesse();
            addEventListener("resize", () => { groesse(); paint(shown); });
            // Reihenfolge: Anfang, Ende, dann die Mitte immer feiner – so ist früh der ganze Ablauf grob da
            const folge = [0, cfg.bilder - 1]; for (let step = cfg.bilder >> 1; step >= 1; step >>= 1) for (let i = step; i < cfg.bilder - 1; i += step) if (!folge.includes(i)) folge.push(i);
            let pos = 0;
            const holen = () => { const i = folge[pos++]; if (i === undefined) return;
              fetch(`${base}-${breite}-${String(i).padStart(2, "0")}.jpg?v=${cfg.v}`).then((r) => r.blob()).then((b) => createImageBitmap(b)).then((bm) => {
                bilder[i] = bm; geladen++; if (this.bereit) { sec.classList.add("is-gl"); letztes = -1; paint(shown); } holen(); }).catch(() => holen()); };
            holen(); holen(); holen();   // drei Downloads parallel
          },
          zeichne(s) {
            const f = s * (cfg.bilder - 1), i = Math.floor(f), t = f - i, schluessel = Math.round(f * 50);
            if (schluessel === letztes) return; letztes = schluessel;
            const a = naechstes(i), b = bilder[Math.min(i + 1, cfg.bilder - 1)];
            if (!a) return;
            ctx.globalAlpha = 1; ctx.drawImage(a, ...cover(a));
            if (b && t > 0.002) { ctx.globalAlpha = t; ctx.drawImage(b, ...cover(b)); ctx.globalAlpha = 1; }
          },
        };
      })() : null;

      function initGL() {
        const g = canvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false });
        if (!g) return false;
        const vs = "attribute vec2 a;varying vec2 v;void main(){v=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0.,1.);}";
        const fs = `precision highp float;varying vec2 v;
          uniform sampler2D uAus,uAn,uKern,uVerlauf;uniform float uS;uniform vec2 uScale,uOffset;
          const float ST=${cfg.stufen}.,SP=${cfg.spalten}.,ZE=${cfg.zeilen}.,RAMPE=${Number(cfg.rampe).toFixed(4)};
          float stufe(float k,vec2 uv){vec2 c=vec2(mod(k,SP),floor(k/SP));vec2 h=vec2(.5/${cfg.zw}.,.5/${cfg.zh}.);
            return texture2D(uVerlauf,(c+clamp(uv,h,1.-h))/vec2(SP,ZE)).r;}
          vec3 lin(vec3 c){return pow(c,vec3(2.2));}
          void main(){
            vec2 uv=v*uScale+uOffset;
            float k=uS*(ST-1.),k0=floor(k),k1=min(k0+1.,ST-1.);
            float f=pow(mix(stufe(k0,uv),stufe(k1,uv),k-k0),${Number(cfg.kurve ?? 1.9).toFixed(3)});
            vec2 q=texture2D(uKern,uv).rg;
            float m=mix(f,clamp((uS-q.g)/RAMPE,0.,1.),q.r);   // Leuchtfläche selbst: nur ihr eigener Schaltzustand, nicht die Raumaufhellung
            gl_FragColor=vec4(pow(mix(lin(texture2D(uAus,uv).rgb),lin(texture2D(uAn,uv).rgb),m),vec3(1./2.2)),1.);}`;
        const sh = (type, src) => { const o = g.createShader(type); g.shaderSource(o, src); g.compileShader(o); if (!g.getShaderParameter(o, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(o)); return o; };
        const prog = g.createProgram(); g.attachShader(prog, sh(g.VERTEX_SHADER, vs)); g.attachShader(prog, sh(g.FRAGMENT_SHADER, fs)); g.linkProgram(prog); g.useProgram(prog);
        const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
        const loc = g.getAttribLocation(prog, "a"); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
        const U = (n) => g.getUniformLocation(prog, n);
        // Bilddaten unverändert übernehmen (Kern-Grünkanal = Einschaltzeitpunkt, darf nicht farbkorrigiert werden)
        g.pixelStorei(g.UNPACK_COLORSPACE_CONVERSION_WEBGL, g.NONE); g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        const w = Math.min(screen.width, innerWidth) * Math.min(devicePixelRatio || 1, 2) > 1400 ? 2400 : 1280;
        const q = cfg.v ? `?v=${cfg.v}` : "";   // Versionskennung gegen veraltete Bilder im Browser-Cache
        const names = [["uAus", `${base}-aus-${w}.webp${q}`], ["uAn", `${base}-an-${w}.webp${q}`], ["uKern", `${base}-kern-${w}.webp${q}`], ["uVerlauf", `${base}-verlauf.png${q}`]];
        let ready = 0;
        // Uploads auf einzelne Bilder verteilen: vier 2400-px-Texturen im selben Moment waren eine spürbare Hängepause
        const queue = []; let pumping = false;
        const pump = () => { if (pumping) return; pumping = true; const step = () => { const job = queue.shift(); if (job) job(); if (queue.length) requestAnimationFrame(step); else pumping = false; }; requestAnimationFrame(step); };
        names.forEach(([u, src], i) => {
          const tex = g.createTexture(); g.activeTexture(g.TEXTURE0 + i); g.bindTexture(g.TEXTURE_2D, tex);
          g.texImage2D(g.TEXTURE_2D, 0, g.RGB, 1, 1, 0, g.RGB, g.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]));
          [g.TEXTURE_WRAP_S, g.TEXTURE_WRAP_T].forEach((p) => g.texParameteri(g.TEXTURE_2D, p, g.CLAMP_TO_EDGE));
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
          g.uniform1i(U(u), i);
          const im = new Image(); im.decoding = "async";
          im.onload = () => { queue.push(() => { g.activeTexture(g.TEXTURE0 + i); g.bindTexture(g.TEXTURE_2D, tex); g.texImage2D(g.TEXTURE_2D, 0, g.RGB, g.RGB, g.UNSIGNED_BYTE, im);
            if (++ready === names.length) { sec.classList.add("is-gl"); draw(shown); } }); pump(); };
          im.src = src;
        });
        const uS = U("uS"), uScale = U("uScale"), uOffset = U("uOffset");
        draw = (s) => {
          const dpr = Math.min(devicePixelRatio || 1, 2), cw = Math.round(canvas.clientWidth * dpr), ch = Math.round(canvas.clientHeight * dpr);
          if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; g.viewport(0, 0, cw, ch); }
          const ca = cw / ch, ia = cfg.aspect;   // wie object-fit: cover
          if (ca > ia) {   // Ausschnitt: feste Unterkante (Anteil der Bildhöhe) oder Fokus-Position
            const sy = ia / ca, oy = cfg.unterkante != null ? Math.min(Math.max(cfg.unterkante - sy, 0), 1 - sy) : (1 - sy) * cfg.fokusY;
            g.uniform2f(uScale, 1, sy); g.uniform2f(uOffset, 0, oy); }
          else { g.uniform2f(uScale, ca / ia, 1); g.uniform2f(uOffset, (1 - ca / ia) / 2, 0); }
          g.uniform1f(uS, s); g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
        };
        canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); gl = null; sec.classList.remove("is-gl"); });
        return true;
      }

      const paint = (p) => { const s = progressToS(p); if (!reduceMotion) stage.style.transform = `scale(${(1 + ZOOM * (1 - s)).toFixed(4)})`;
        if (film) { if (film.bereit) film.zeichne(s); else fallback(s); } else if (gl && sec.classList.contains("is-gl")) draw(s); else fallback(s); };
      const measure = () => { const r = sec.getBoundingClientRect(); target = clamp(-r.top / (r.height - innerHeight)); };
      const loop = () => {
        measure();   // Lesen vor dem Schreiben – sonst erzwingt jedes Scroll-Ereignis ein zusätzliches Layout
        shown += (target - shown) * (reduceMotion ? 1 : 0.12);   // weich nachziehen, damit Mausrad-Sprünge nicht ruckeln
        if (Math.abs(target - shown) < 0.0004) shown = target;
        paint(shown);
        if (shown !== target) requestAnimationFrame(loop); else running = false;
      };
      const kick = () => { if (!running) { running = true; requestAnimationFrame(loop); } };
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting; sec.classList.toggle("is-sichtbar", visible);
        if (visible && film) { film.laden(); anImg.loading = "eager"; }
        else if (visible && gl === null) { try { gl = initGL() || false; } catch (err) { gl = false; } if (!gl) anImg.loading = "eager"; }
        if (visible) kick();
      }, { rootMargin: "100% 0px" }).observe(sec);
      addEventListener("scroll", () => { if (visible) kick(); }, { passive: true });
      addEventListener("resize", () => { if (visible) { kick(); paint(shown); } });
      measure(); shown = target;
      // Einrichten in der Leerlaufzeit nach dem Laden, nicht erst mitten im Scrollen
      (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => {
        if (!film && gl === null) { try { gl = initGL() || false; } catch (err) { gl = false; } if (!gl) anImg.loading = "eager"; }
      }, { timeout: 4000 });
      // Film: erst laden, wenn der Bereich näher als drei Bildschirmhöhen ist – spart Datenvolumen, wenn niemand hinscrollt
      if (film) new IntersectionObserver(([e], io) => { if (e.isIntersecting) { film.laden(); io.disconnect(); } }, { rootMargin: "300% 0px" }).observe(sec);
    });
  })();

  /* ---------- Leuchtturmprojekte: Kreis-Rolle (Rechenweise wie „Circular Split Roll“) ----------
     Jedes Projekt sitzt auf zwei Kreisen; Scrollen dreht beide. Fokus = Punkt am Kreis, der zur Bildmitte zeigt. */
  (function projektRolle() {
    const wrap = $("[data-roll]");
    if (!wrap || reduceMotion) return;
    const titles = $$(".roll__title", wrap), cards = $$(".roll__card", wrap), dots = $$(".roll__dot", wrap), bgs = $$(".roll__bg", wrap);
    const n = titles.length, SLOTS = Math.max(n, 10);           // Abstand auf dem Kreis wie bei 10 Einträgen
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const mix = (a, b, t) => a + (b - a) * t;
    const focus = (str, start, power) => Math.pow(clamp((str - start) / (1 - start)), power);
    let target = 0, shown = 0, running = false, visible = false, last = -1, lastPlatz = 0;
    // Namen mit festen Zeilen (<br>) verkleinern, falls die längste Zeile nicht ins Namensfeld passt
    const fit = () => titles.forEach((t) => {
      if (!t.querySelector("br")) return;
      t.style.fontSize = "";
      const zuBreit = t.scrollWidth / t.clientWidth;
      if (zuBreit > 1) t.style.fontSize = parseFloat(getComputedStyle(t).fontSize) / zuBreit + "px";
    });
    const place = (el, x, y, scale, opacity, z, mitte = "") => {   // mitte: Namen um ihre eigene Höhe zentrieren
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)${mitte} scale(${scale.toFixed(3)})`;
      el.style.opacity = opacity.toFixed(3); el.style.zIndex = z;
    };
    const render = (f) => {                                       // f = Fokus-Index, 0 … n-1
      const w = innerWidth, k = w < 1200 ? w / 1200 : 1;
      const rT = 520 * k, rC = 860 * k;
      wrap.style.setProperty("--roll-card-w", 600 * k + "px");
      wrap.style.setProperty("--roll-card-h", 420 * k + "px");
      const platz = Math.max(200, 2 * Math.min(w * 0.28 - 32, (w * 0.68 - 300 * k - 40) - w * 0.28));   // Namen dürfen nicht ins Bild ragen
      if (platz !== lastPlatz) { lastPlatz = platz; wrap.style.setProperty("--roll-title-w", platz + "px"); fit(); }
      const xT = w * 0.03, xC = -w * 0.07;                         // Fokus: Name bei 28 %, Bild bei 68 % der Breite
      for (let i = 0; i < n; i++) {
        const a = ((i - f) / SLOTS) * Math.PI * 2;                 // 0 = im Fokus
        // Namen: Kreis links, Fokus am rechten Kreisrand
        const tStr = focus(clamp((Math.cos(a) + 1) / 2), 0.42, 2.6);
        place(titles[i], xT + (Math.cos(a) - 1) * rT, Math.sin(a) * rT, mix(0.68, 1, tStr), mix(0.18, 1, tStr), Math.round(mix(1, 30, tStr)), " translateY(-50%)");
        // Bilder: Kreis rechts, Fokus am linken Kreisrand
        const cStr = focus(clamp((Math.cos(a) + 1) / 2), 0.45, 3.2);
        place(cards[i], xC - (Math.cos(a) - 1) * rC, Math.sin(a) * rC, mix(0.58, 1, cStr), mix(0.14, 1, cStr), Math.round(mix(1, 40, cStr)));
        const istFokus = Math.abs(i - f) < 0.5;
        titles[i].classList.toggle("is-focus", istFokus); cards[i].classList.toggle("is-focus", istFokus);
        cards[i].tabIndex = istFokus ? 0 : -1;
      }
      bgs.forEach((bg, i) => { const o = clamp(1 - Math.abs(i - f)); bg.style.opacity = (o * o * (3 - 2 * o)).toFixed(3); });   // weiche Überblendung
      const aktiv = Math.round(f);
      if (aktiv !== last) { last = aktiv; dots.forEach((d, j) => d.classList.toggle("is-active", j === aktiv)); }
    };
    const measure = () => { const r = wrap.getBoundingClientRect(); target = clamp(-r.top / (r.height - innerHeight)) * (n - 1); };
    const loop = () => {
      measure();                                                   // lesen, dann schreiben (ein Layout pro Bild)
      shown += (target - shown) * 0.12;                            // weich nachziehen („scrub“)
      if (Math.abs(target - shown) < 0.001) shown = target;
      render(shown);
      if (shown !== target) requestAnimationFrame(loop); else running = false;
    };
    const kick = () => { if (!running) { running = true; requestAnimationFrame(loop); } };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; wrap.classList.toggle("is-sichtbar", visible); if (visible) kick(); }, { rootMargin: "0px" }).observe(wrap);
    addEventListener("scroll", () => { if (visible) kick(); }, { passive: true });
    addEventListener("resize", () => { measure(); render(shown); });
    measure(); shown = target; render(shown);
    if (document.fonts) document.fonts.ready.then(() => { fit(); render(shown); });   // nach dem Laden von Orbitron neu messen
  })();

  /* ---------- Fakten-Karten: auf Touch/Tablet per Klick aufklappen ---------- */
  (function factCards() {
    const cards = $$(".fact-card-wrapper");
    if (!cards.length) return;
    const mobile = () => window.matchMedia("(max-width: 1024px)").matches;
    cards.forEach((card) => {
      card.setAttribute("tabindex", "0");
      const toggle = () => {
        if (!mobile()) return;
        const on = !card.classList.contains("active");
        cards.forEach((c) => { c.classList.remove("active"); c.closest(".fact-card").classList.remove("active"); });
        if (on) { card.classList.add("active"); card.closest(".fact-card").classList.add("active"); }
      };
      card.addEventListener("click", (e) => { if (!e.target.closest("a, button")) toggle(); });   // Leuchten-Kacheln: Merken nicht aufklappen
      // Leuchten-Kacheln am Handy: das „+“ ist zugleich der Merkzettel-Knopf – zu getippt klappt es erst auf, offen merkt es
      card.addEventListener("click", (e) => {
        if (mobile() && !card.classList.contains("active") && e.target.closest(".fc-produkt__merk")) { e.stopPropagation(); e.preventDefault(); toggle(); }
      }, true);
      card.addEventListener("keydown", (e) => { if (e.target === card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(); } });
    });
  })();

  /* ---------- Lichtfarben-Umschalter ---------- */
  $$(".lichtfarbe").forEach((root) => {
    const switches = $$(".lichtfarbe__switch", root), lamps = $$(".lichtfarbe__lamp", root), bilder = $$(".lichtfarbe__bild", root), status = $("[data-lt-status]", root);
    let current = -1;
    const activate = (i, focus) => {
      if (i < 0 || i >= switches.length || i === current) return;
      current = i;
      switches.forEach((b, k) => { b.setAttribute("aria-checked", k === i); b.tabIndex = k === i ? 0 : -1; });
      lamps.forEach((img, k) => img.classList.toggle("is-active", k === i));
      bilder.forEach((img, k) => img.classList.toggle("is-active", k === i));   // Café-Hintergrund in derselben Lichtfarbe
      root.style.setProperty("--lt-glow", switches[i].dataset.ltColor);
      if (status) status.textContent = switches[i].dataset.ltLabel;
      if (focus) switches[i].focus();
    };
    activate(Number(root.dataset.start || 1) - 1, false);
    // Hinweis „Atmen“ (CSS) hört nach dem ersten eigenen Wechsel auf
    const benutzt = () => root.classList.add("lt-benutzt");
    switches.forEach((b, i) => b.addEventListener("click", () => { activate(i, false); benutzt(); }));
    root.addEventListener("keydown", (e) => {
      const last = switches.length - 1; let next = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = current >= last ? 0 : current + 1;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = current <= 0 ? last : current - 1;
      if (e.key === "Home") next = 0; if (e.key === "End") next = last;
      if (next !== null) { e.preventDefault(); activate(next, true); benutzt(); }
    });
  });

  /* ---------- Projekt-Center-Slider (5 sichtbare Kacheln, Mitte groß) ---------- */
  $$(".projekt-center-slider").forEach((slider) => {
    const track = $(".slider-track", slider), originals = $$(".slide", track), pagination = $(".slider-pagination", slider);
    const total = originals.length; if (!total) return;
    const autoplayDelay = Number(slider.dataset.autoplay) || 0;
    let all = [], index = total, base = 0, gap = 10, count = 5, factors = {}, busy = false, timer = null;
    const cfg = () => { const w = window.innerWidth; if (w <= 767) return { slides: 1, gap: 6 }; if (w <= 1024) return { slides: 3, gap: 8 }; return { slides: 5, gap: 10 }; };
    const buildFactors = (n) => { const side = [0.8, 0.6, 0.5]; const f = { "2": 1, "-1": 0.6 }; for (let d = 1; d <= Math.floor(n / 2); d++) { f[String(2 - d)] = side[d - 1] || 0.5; f[String(2 + d)] = side[d - 1] || 0.5; } return f; };
    const totalFactor = (n) => { const side = [0.8, 0.6, 0.5]; let t = 1; for (let d = 1; d <= Math.floor(n / 2); d++) t += 2 * (side[d - 1] || 0.5); return t; };
    const init = () => {
      originals.forEach((s) => { const a = s.cloneNode(true); a.classList.add("clone", "clone-before"); track.insertBefore(a, track.firstChild); });
      originals.forEach((s) => { const a = s.cloneNode(true); a.classList.add("clone", "clone-after"); track.appendChild(a); });
      // Reihenfolge der Vor-Klone korrigieren (prepend kehrt um)
      const before = $$(".clone-before", track); before.reverse().forEach((b) => track.insertBefore(b, track.firstChild));
      all = $$(".slide", track);
      dims(); render(false);
      if (pagination) { pagination.innerHTML = ""; originals.forEach((_, i) => { const d = document.createElement("button"); d.className = "pagination-dot"; d.setAttribute("aria-label", "Projekt " + (i + 1)); d.addEventListener("click", () => goTo(total + i)); pagination.appendChild(d); }); }
      updateDots();
    };
    const dims = () => { const c = cfg(); count = Math.max(1, c.slides); gap = c.gap; factors = buildFactors(count); base = (slider.clientWidth - (count - 1) * gap) / totalFactor(count); track.style.gap = gap + "px"; };
    const posOf = (i) => { const d = i - index; const p = 2 + d; return p >= 0 && p <= 4 && Math.abs(d) <= Math.floor(count / 2) ? String(p) : "-1"; };
    const render = (animate) => {
      track.classList.toggle("no-transition", !animate || reduceMotion);
      let left = 0; const widths = [];
      all.forEach((s, i) => { const p = posOf(i); s.dataset.position = p; const w = base * (factors[p] !== undefined ? factors[p] : factors["-1"] || 0.6); widths.push(w); $(".slide-container", s).style.width = w + "px"; });
      for (let i = 0; i < index; i++) left += widths[i] + gap;
      const centerOffset = slider.clientWidth / 2 - widths[index] / 2;
      track.style.transform = `translateX(${centerOffset - left}px)`;
    };
    const updateDots = () => { if (!pagination) return; const real = ((index - total) % total + total) % total; $$(".pagination-dot", pagination).forEach((d, i) => d.classList.toggle("active", i === real)); };
    const goTo = (i) => {
      if (busy) return; busy = true; index = i; render(true); updateDots();
      setTimeout(() => {
        if (index >= 2 * total) { index -= total; render(false); } else if (index < total) { index += total; render(false); }
        busy = false;
      }, reduceMotion ? 0 : 820);
    };
    $(".slider-nav-prev", slider)?.addEventListener("click", () => goTo(index - 1));
    $(".slider-nav-next", slider)?.addEventListener("click", () => goTo(index + 1));
    track.addEventListener("click", (e) => { const s = e.target.closest(".slide"); if (!s || e.target.closest("a")) return; const i = all.indexOf(s); if (i !== index) { e.preventDefault(); goTo(i); } });
    let x0 = null;
    slider.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
    slider.addEventListener("pointerup", (e) => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 50) goTo(index + (dx < 0 ? 1 : -1)); });
    window.addEventListener("resize", () => { dims(); render(false); });
    if (autoplayDelay && !reduceMotion) { const start = () => { timer = setInterval(() => goTo(index + 1), autoplayDelay); }; slider.addEventListener("mouseenter", () => clearInterval(timer)); slider.addEventListener("mouseleave", start); start(); }
    init();
  });

  /* ---------- Scroll-Zitate (Sticky-Sektion, Zeilen laufen ein) ---------- */
  $$(".ue-scroll-wrapper").forEach((wrapper) => {
    const bg = $(".ue-scroll-bg", wrapper), spacer = $(".ue-scroll-spacer", wrapper), pagination = $(".ue-scroll-pagination", wrapper), slides = $$(".ue-scroll-item", wrapper);
    // feste Sprecherzeile: fährt wie die letzte Zeile des ersten Zitats hoch, bleibt danach stehen (auch beim Wechsel)
    const festZeile = $(".ue-scroll-subline--fest .line", wrapper), festVersatz = slides.length ? $$(".line", slides[0]).length * 0.03 : 0;
    const n = slides.length; if (!n) return;
    const scrollHeight = 100 + n * 120;
    wrapper.style.minHeight = scrollHeight + "vh";
    if (spacer) spacer.style.height = (scrollHeight - 100 + 20) + "vh";
    if (pagination) { pagination.innerHTML = ""; slides.forEach(() => { const d = document.createElement("div"); d.className = "ue-scroll-pagination-dot"; pagination.appendChild(d); }); }
    let target = 0, current = 0, raf = null, lastDot = -1;
    const update = () => {
      current += (target - current) * 0.15;
      if (bg) bg.style.transform = `scale(${1 + current * 0.2}) translateY(${current * 50}px)`;
      const f = current * n;
      if (festZeile) festZeile.style.transform = `translateY(${100 - Math.max(0, Math.min(1, (f - festVersatz * 0.35) / 0.35)) * 100}%)`;
      const active = Math.min(Math.max(0, Math.floor(f)), n - 1);
      if (active !== lastDot && pagination) { lastDot = active; $$(".ue-scroll-pagination-dot", pagination).forEach((d, i) => d.classList.toggle("active", i === active)); }
      slides.forEach((slide, i) => {
        const lines = $$(".line", slide), last = i === n - 1, p = f - i;
        if (p >= 0 && p < 1) {
          slide.classList.add("active"); slide.style.opacity = 1;
          lines.forEach((line, k) => {
            const st = k * 0.03; let ty;
            if (p <= 0.35) ty = 100 - Math.max(0, Math.min(1, (p - st * 0.35) / 0.35)) * 100;
            else if (p <= 0.7) ty = -((p - 0.35) / 0.35) * 20;
            else if (!last) ty = -20 - Math.max(0, Math.min(1, (p - 0.7 - st * 0.3) / 0.3)) * 80;
            else ty = -Math.min((p - 0.35) / 0.35, 1) * 20;
            line.style.transform = `translateY(${ty}%)`;
          });
        } else {
          slide.classList.remove("active");
          if (p < 0) { slide.style.opacity = 0; lines.forEach((l) => (l.style.transform = "translateY(100%)")); }
          else if (!last) { slide.style.opacity = 0; lines.forEach((l) => (l.style.transform = "translateY(-100%)")); }
          else { slide.style.opacity = 1; lines.forEach((l) => (l.style.transform = "translateY(-20%)")); }
        }
      });
      if (Math.abs(target - current) > 0.001) raf = requestAnimationFrame(update); else raf = null;
    };
    const onScroll = () => {
      const r = wrapper.getBoundingClientRect(); const total = wrapper.offsetHeight - window.innerHeight;
      target = Math.max(0, Math.min(1, -r.top / total));
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll(); update();
  });

  /* ---------- Zähler ---------- */
  (function counters() {
    const nums = $$(".counter__number[data-to]");
    if (!nums.length) return;
    const run = (el) => {
      const jahr = el.dataset.format === "jahr";   // Jahreszahl: ohne Tausenderpunkt, läuft vom Startjahr (data-von) zurück (Ausgabe 06 / 2026)
      const fmt = (v) => jahr ? String(Math.round(v)) : Math.round(v).toLocaleString("de-DE");
      const to = Number(el.dataset.to), von = Number(el.dataset.von) || 0, dur = Number(el.dataset.duration) || 2000, t0 = performance.now();
      if (reduceMotion) { el.textContent = fmt(to); return; }
      el.textContent = fmt(Math.max(to, von)); el.style.display = "inline-block"; el.style.minWidth = el.offsetWidth + "px"; el.textContent = fmt(von);   // Platz für die Endzahl reservieren
      const tick = (t) => { const p = Math.min(1, (t - t0) / dur); el.textContent = fmt(von + (to - von) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    };
    // im Artikel blendet der Block gerade erst ein (artikelBewegung, .7 s) – erst danach zählen, sonst sieht man das Hochzählen halb durchsichtig
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { const el = e.target; setTimeout(() => run(el), el.closest(".article-body.ist-bereit") ? 550 : 0); io.unobserve(el); } }), { threshold: 0.4 });
    nums.forEach((el) => io.observe(el));
  })();

  /* ---------- „Zur FAE“-Button mit Lichtband (Ralf 08.10.2026): Animation auch ohne Maus ----------
     Maus: Drüberfahren spielt die Animation, Klick öffnet sofort. Tastatur: Fokus spielt sie, Enter öffnet sofort.
     Finger: Antippen startet die Animation, der neue Tab öffnet nach 0,75 s (wenn der Pfeil steht) – sonst sähe man sie am Handy nie.
     Am Handy spielt jeder Button sie zusätzlich einmal vor, sobald er ganz zu sehen ist.
     Der umlaufende Lichtpunkt läuft nur, solange der Button im Bild ist (.is-sichtbar). */
  (function zurFae() {
    const knoepfe = $$(".zf");
    if (!knoepfe.length) return;
    const ohneMaus = window.matchMedia("(hover: none)").matches;
    knoepfe.forEach((a) => {
      let finger = false, laeuft = 0;
      const aus = () => { if (!laeuft) a.classList.remove("is-an"); };
      a.addEventListener("pointerdown", (e) => { finger = e.pointerType !== "mouse"; if (finger) a.classList.add("is-an"); });
      a.addEventListener("pointercancel", () => { finger = false; aus(); });   // Finger wurde zum Scrollen benutzt
      a.addEventListener("click", (e) => {
        const tipp = finger && e.detail > 0 && !reduceMotion && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);
        finger = false;
        if (!tipp) return;
        e.preventDefault();
        a.classList.add("is-an");
        clearTimeout(laeuft);
        laeuft = setTimeout(() => {
          const w = window.open(a.href, "_blank");
          if (w) w.opener = null; else location.href = a.href;   // Popup-Sperre: dann im selben Tab
          setTimeout(() => { laeuft = 0; aus(); }, 1500);
        }, 750);
      });
      new IntersectionObserver(([en]) => {
        a.classList.toggle("is-sichtbar", en.isIntersecting);
        if (ohneMaus && !reduceMotion && en.intersectionRatio >= 0.9 && !a.dataset.vorgespielt) {
          a.dataset.vorgespielt = "1";
          setTimeout(() => { a.classList.add("is-an"); setTimeout(aus, 1900); }, 450);
        }
      }, { threshold: [0, 0.9] }).observe(a);
    });
  })();

  /* ---------- Footer-Leuchte mit Bewegungsmelder (Ralf 08.10.2026) ----------
     Ist der Mauszeiger unterhalb der waagerechten Linie des Profils, geht das Licht an, darüber wieder aus – auch beim
     Scrollen, wenn die Leuchte am stehenden Zeiger vorbeizieht. Ohne Maus (Handy, Tastatur, noch nicht bewegt) zählt die
     Bildschirmmitte als „Person“. Geprüft wird nur, solange der Footer in der Nähe ist; beim Verlassen einmal abschließend. */
  // Seit 11.10.2026 auch für weitere Leuchten mit data-melder (Ausgabe 06 / 2026: Tibia Rohrleuchte über den Quellen); Linie = [data-melder-linie].
  // Solche Blöcke bekommen .melder-bereit (erst dann gilt ihr Aus-Zustand im CSS – ohne Skript bleibt das Licht an).
  (function bewegungsmelder() {
    const melder = [...$$(".fc"), ...$$("[data-melder]")].map((el) => ({ el, linie: $(".fc-profil, [data-melder-linie]", el), an: false, nah: false })).filter((m) => m.linie);
    if (!melder.length) return;
    const SCHWELLE = 3;   // px um die Linie herum: verhindert Flackern, wenn der Zeiger genau auf der Linie steht
    let zeigerY = null, plan = 0;
    const pruefen = () => {
      plan = 0;
      const y = zeigerY ?? window.innerHeight / 2;
      melder.forEach((m) => {
        const linie = m.linie.getBoundingClientRect().bottom;
        const neu = m.an ? y > linie - SCHWELLE : y > linie + SCHWELLE;
        if (neu !== m.an) { m.an = neu; m.el.classList.toggle("ist-an", neu); }
      });
    };
    const planen = () => { if (!plan && melder.some((m) => m.nah)) plan = requestAnimationFrame(pruefen); };
    window.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") { zeigerY = e.clientY; planen(); } }, { passive: true });
    window.addEventListener("scroll", planen, { passive: true });
    window.addEventListener("resize", planen);
    const io = new IntersectionObserver((es) => { es.forEach((e) => { const m = melder.find((x) => x.el === e.target); if (m) m.nah = e.isIntersecting; }); pruefen(); }, { rootMargin: "200px 0px" });
    melder.forEach((m) => { if (m.el.hasAttribute("data-melder")) m.el.classList.add("melder-bereit"); io.observe(m.el); });
  })();

  /* ---------- Magazin-Hefte (Ralf 09.10.2026): Maus/Fokus über CSS; am Handy hebt sich die Kante, solange ein Heft in der
     Bildschirmmitte steht ---------- */
  (function magazinHefte() {
    const hefte = $$(".mz");
    if (!hefte.length || !window.matchMedia("(hover: none)").matches) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle("ist-an", e.isIntersecting)), { rootMargin: "-38% 0px -38% 0px" });
    hefte.forEach((h) => io.observe(h));
  })();

  /* ---------- Magazin-Bereich (Ralf 09.10.2026): Heftstapel und – am Desktop – die Cura gebogen als Grafik darüber ---------- */
  (function magazinLicht() {
    const mgz = $(".mgz");
    if (!mgz) return;
    // Stapel (Ralf 09.10.2026, Fassung „Unter den Stapel“): neueste Ausgabe oben; „weiter“ lässt das oberste Heft rechts herausgleiten
    // und schiebt es unten unter den Stapel, „zurück“ holt es wieder nach oben. Lage je Heft: Versatz, leichte Drehung, Tiefe.
    const stapel = $(".mgz-stapel", mgz), lagen = $$(".mgz-lage", mgz), zurueck = $(".mgz-pfeil--zurueck", mgz), weiter = $(".mgz-pfeil--weiter", mgz), zaehler = $(".mgz-zaehler", mgz);
    if (stapel && lagen.length) {
      const info = $$(".mgz-info__eintrag", mgz);   // Angaben zum obersten Heft (Desktop, „Lichtkegel“)
      const n = lagen.length, dreh = [-1.4, 1.1, -.5, 1.8, -1, .7, -1.6];
      let c = 0, sperre = false;
      // Versatz je Heft: bis 7 Hefte 8/9 px; bei mehr Heften enger, damit der Stapel nicht tiefer wird und nicht an Pfeile und Zähler stößt
      // (Ausgabe 04 kam am 11.10.2026 als 8. Heft dazu)
      const eng = Math.min(1, 6 / Math.max(1, n - 1));
      const lageVon = (k, cc) => {   // → [transform, z-index, Abdunklung, Deckkraft]
        const d = k - cc, r = dreh[k % dreh.length], t = d < 0 ? n + d : d;   // gelesene liegen unten
        return [`translate(${(t * 8 * eng).toFixed(1)}px, ${(t * 9 * eng).toFixed(1)}px) rotate(${r}deg)`, 100 - t, Math.min(t, 3) * .13, 1];
      };
      const setzen = (el, k, cc) => { const [t, z, sch, o] = lageVon(k, cc); el.style.transform = t; el.style.zIndex = z; el.style.setProperty("--sch", sch); el.style.opacity = o; el.classList.toggle("ist-oben", k === cc); };
      const zeigen = () => {
        lagen.forEach((el, k) => setzen(el, k, c));
        const t = lagen[c].dataset.ausgabe || "", tm = /^(.*?)(\d+)(\s*\/\s*\d+.*)$/.exec(t);   // „Ausgabe 07 / 2026“ – Nummer hervorgehoben
        if (tm) zaehler.replaceChildren(tm[1], Object.assign(document.createElement("b"), { textContent: tm[2] }), tm[3]); else zaehler.textContent = t;
        info.forEach((el, k) => el.classList.toggle("ist-aktiv", k === c));
        zurueck.disabled = c === 0; weiter.disabled = c === n - 1;
      };
      // Bewegung des Hefts, das den Stapel wechselt: rechts heraus, bei der Hälfte die Ebene wechseln, dann unter den Stapel (bzw. zurück oben drauf)
      const fliegen = (k, von, nach, vor) => {
        const el = lagen[k];
        if (reduceMotion) { setzen(el, k, nach); return; }
        const [t0, z0] = lageVon(k, von), [t1, z1] = lageVon(k, nach);
        const raus = "translate(104%, -3%) rotate(6deg)";
        const bild = [{ transform: t0, zIndex: vor ? 140 : z0 }, { transform: raus, zIndex: vor ? 140 : z0, offset: .48 }, { transform: raus, zIndex: vor ? z1 : 140, offset: .5 }, { transform: t1, zIndex: vor ? z1 : 140 }];
        el.style.transition = "none";
        // Schnelles Klicken (Ralf 12.10.2026: „wenn man schnell drückt, ist immer das falsche Bild oben auf dem Cover“): eine noch laufende
        // Bewegung desselben Hefts wird abgebrochen, und am Ende gilt der dann aktuelle Stand (c) – nicht der vom Klick, der sie gestartet hat
        if (el._flug) { el._flug.onfinish = null; el._flug.cancel(); }
        const anim = el._flug = el.animate(bild, { duration: 900, easing: "cubic-bezier(.45, .05, .35, 1)" });
        setzen(el, k, nach); el.style.zIndex = 140;
        anim.onfinish = () => { el._flug = null; el.style.transition = ""; lagen.forEach((x, i) => { if (!x._flug) setzen(x, i, c); }); };
      };
      const gehe = (neu) => {
        if (sperre || neu < 0 || neu > n - 1 || neu === c) return;
        sperre = true; setTimeout(() => { sperre = false; }, 380);
        const alt = c, vor = neu > alt, k = vor ? alt : neu;
        c = neu; zeigen(); fliegen(k, alt, neu, vor);
      };
      zurueck.addEventListener("click", () => gehe(c - 1));
      weiter.addEventListener("click", () => gehe(c + 1));
      stapel.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") { e.preventDefault(); gehe(c + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); gehe(c - 1); } });
      let x0 = null;   // Wischen (Finger/Stift): nach links = weiter
      stapel.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") x0 = e.clientX; });
      stapel.addEventListener("pointerup", (e) => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) gehe(c + (dx < 0 ? 1 : -1)); });
      zeigen();
    }
    // Cura gebogen als Grafik (Ralf 09.10.2026, Desktop): hängt über dem Stapel – der halbe Ring reicht von −0,46 bis +0,23 der
    // Leuchtenbreite um seine Mitte, also sitzt die Ellipsenmitte 0,115 × Breite rechts der Stapelmitte; Seile von der Linie unter
    // „Magazin“ (wie im Fußbereich die Trennlinien der Kontaktkarte) senkrecht zu den Aufhängepunkten. Kommt der Stapel ins Bild,
    // läuft das Licht den Bogen entlang, dann gehen Lichtteppich, Lichtfleck und Name an (.mc-an); beim Verlassen wieder aus.
    const mc = $(".mc", mgz);
    if (mc && stapel) {
      const winkel = mc.dataset.seile.split(" ").map(Number), seile = $$(".mc-seil", mc), linie = $(".mgz-spalte .divider", mgz);
      const lage = () => {
        if (!matchMedia("(min-width: 900px)").matches) return;
        const m = mgz.getBoundingClientRect(), st = stapel.getBoundingClientRect(), dv = linie.getBoundingClientRect();
        if (!st.width) return;
        const sm = st.left - m.left + st.width / 2, sy = st.top - m.top, w = st.width * 1.75, cx = sm + w * .115, cy = sy - w * .155 - 14, decke = dv.bottom - m.top;
        const v = { "--mc-x": cx, "--mc-y": cy, "--mc-w": w, "--mc-sm": sm, "--mc-sb": st.width, "--mc-st": sy, "--mc-sh": st.height, "--mc-decke": decke };   // --mc-decke: Linie unter „Magazin“ – darunter beginnt das Foto
        for (const k in v) mgz.style.setProperty(k, v[k].toFixed(1) + "px");
        seile.forEach((el, k) => {
          const t = winkel[k] * Math.PI / 180, x = cx + w * .46 * Math.cos(t), y = cy + w * .072 * Math.sin(t) - w * .003;
          el.style.cssText = `left:${x.toFixed(1)}px;top:${decke.toFixed(1)}px;height:${Math.max(0, y - decke).toFixed(1)}px`;
        });
      };
      lage(); addEventListener("resize", lage); addEventListener("load", lage); if (document.fonts) document.fonts.ready.then(lage);
      if ("ResizeObserver" in window) new ResizeObserver(lage).observe(mgz);
      mgz.classList.add("mc-bereit");   // erst mit Skript: Hefte liegen im Dunkeln, bis das Licht angeht (Ralf 11.10.2026)
      new IntersectionObserver(([e]) => mgz.classList.toggle("mc-an", e.isIntersecting), { threshold: .45 }).observe(stapel);
    }
  })();

  /* ---------- Anwendungsbereiche: Lichtschiene (Ralf 09.10.2026, aus dem Muster „TreeNav“ weiterentwickelt) ----------
     Das Lichtstück in der Schiene (.bx-raute) und sein Lichtkegel (.bx-feld) folgen einer kritisch gedämpften Feder (kein Überschwingen,
     ~0,22 s, nimmt die Geschwindigkeit mit – wischt man mit dem Zeiger über die Liste, ruckelt nichts). Zeiger auf einer Zeile:
     Feld gleitet hin, nach 0,2 s Verweilen wechselt das Bild; Zeiger weg: zurück zur gewählten Zeile. Pfeiltasten wie bei Reitern.
     Ohne Eingriff wählt die Liste alle 5 s den nächsten Bereich (nur sichtbar und ohne „Bewegung reduzieren“); jede eigene Wahl beendet das. */
  (function bereiche() {
    const bx = $(".bx");
    if (!bx) return;
    const baum = $(".bx-baum", bx), liste = $(".bx-liste", bx), knoepfe = $$(".bx-knopf", bx), bilder = $$(".bx-bild", bx);
    const raute = $(".bx-raute", bx), feld = $(".bx-feld", bx);   // Lichtstück in der Schiene und sein Lichtkegel
    const W = 28;   // Eigenfrequenz der Feder (1/s)
    let mitten = [], aktiv = Math.max(0, knoepfe.findIndex((k) => k.classList.contains("ist-aktiv"))), schwebt = null;
    let y = 0, v = 0, ziel = 0, laeuft = false, zuletzt = 0, absicht = 0, zeileH = 0, rauteH = 0;
    const zeichne = () => {
      raute.style.transform = `translateY(${(y - rauteH / 2).toFixed(2)}px)`;
      feld.style.transform = `translateY(${(y - zeileH / 2).toFixed(2)}px)`;
    };
    const schritt = (t) => {
      const dt = Math.min(0.05, (t - zuletzt) / 1000), d = y - ziel, e = Math.exp(-W * dt), k = v + W * d;
      zuletzt = t; y = ziel + (d + k * dt) * e; v = (v - W * k * dt) * e;   // exakte Lösung der kritisch gedämpften Feder
      if (Math.abs(y - ziel) < 0.05 && Math.abs(v) < 0.5) { y = ziel; v = 0; laeuft = false; }
      zeichne();
      if (laeuft) requestAnimationFrame(schritt);
    };
    const gleite = (i, sofort) => {
      ziel = mitten[i] ?? 0;
      if (sofort || reduceMotion) { y = ziel; v = 0; zeichne(); return; }
      if (!laeuft) { laeuft = true; zuletzt = performance.now(); requestAnimationFrame(schritt); }
    };
    const messen = () => {
      const b = baum.getBoundingClientRect();
      if (!b.height) return;
      mitten = knoepfe.map((k) => { const r = k.getBoundingClientRect(); return r.top - b.top + r.height / 2; });
      zeileH = knoepfe[0].offsetHeight;
      baum.style.setProperty("--bx-h", zeileH + "px");   // ab 1024 px füllen die Zeilen die Höhe neben dem Bild – Lichtstück und Lichtkegel wachsen mit
      rauteH = raute.offsetHeight;
      gleite(schwebt ?? aktiv, true);   // Umbruch ist keine Bewegung: sofort an die richtige Stelle
      bx.classList.add("bx--bereit");
    };
    const waehle = (i, fokus) => {
      if (i !== aktiv) {
        const alt = aktiv; aktiv = i;
        knoepfe[alt].classList.remove("ist-aktiv"); knoepfe[alt].setAttribute("aria-selected", "false"); knoepfe[alt].tabIndex = -1;
        bilder[alt].classList.remove("ist-aktiv"); bilder[alt].inert = true;
        knoepfe[i].classList.add("ist-aktiv"); knoepfe[i].setAttribute("aria-selected", "true"); knoepfe[i].tabIndex = 0;
        bilder[i].classList.add("ist-aktiv"); bilder[i].inert = false;
      }
      if (fokus) knoepfe[i].focus();
      if (schwebt === null) gleite(i);
    };
    // von selbst weiter
    let selbst = !reduceMotion && !bx.dataset.gewaehlt, sichtbar = false, drueber = false, uhr = 0, zeiger = "";   // data-gewaehlt: wechsel.js hat den Bereich beim Zurückkommen gesetzt – dann nicht von selbst weiter
    const takt = () => { clearInterval(uhr); if (selbst && sichtbar && !drueber) uhr = setInterval(() => waehle((aktiv + 1) % knoepfe.length), 5000); };
    const halt = () => { selbst = false; clearInterval(uhr); };
    knoepfe.forEach((k, i) => {
      k.addEventListener("pointerenter", () => { schwebt = i; gleite(i); clearTimeout(absicht); absicht = setTimeout(() => { halt(); waehle(i); }, 200); });   // erst nach kurzem Verweilen: beim Drüberwischen blitzen keine Bilder auf
      // Ralf 09.10.2026: „der ausgewählte Bereich ist klickbar und führt zur selben Seite wie rechts ‚Mehr erfahren‘“ –
      // Maus: Drüberfahren zeigt den Bereich, Klick öffnet die Seite. Tippen/Tastatur: erst wählen, der gewählte öffnet die Seite.
      k.addEventListener("pointerdown", (e) => { zeiger = e.pointerType; });
      k.addEventListener("click", (e) => {
        clearTimeout(absicht); halt();
        const ziel = k.dataset.href, maus = zeiger === "mouse" && e.detail > 0;
        zeiger = "";
        if (ziel && (i === aktiv || maus)) {
          if (e.metaKey || e.ctrlKey || e.button === 1) open(ziel, "_blank", "noopener"); else location.href = ziel;
          return;
        }
        waehle(i);
      });
      k.addEventListener("focus", () => { schwebt = i; gleite(i); });
      k.addEventListener("blur", () => { schwebt = null; gleite(aktiv); });
      k.addEventListener("keydown", (e) => {
        const n = knoepfe.length, j = { ArrowDown: (i + 1) % n, ArrowUp: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
        if (j === undefined) return;
        e.preventDefault(); halt(); waehle(j, true);
      });
    });
    liste.addEventListener("pointerleave", () => { clearTimeout(absicht); schwebt = null; gleite(aktiv); });
    bx.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { drueber = true; takt(); } });
    bx.addEventListener("pointerleave", () => { drueber = false; takt(); });
    new IntersectionObserver(([e]) => { sichtbar = e.isIntersecting; takt(); }, { threshold: 0.5 }).observe(bx);
    messen(); addEventListener("load", messen); if (document.fonts) document.fonts.ready.then(messen);
    if ("ResizeObserver" in window) new ResizeObserver(messen).observe(liste);
  })();

  /* ---------- Bereichsseiten (z. B. Allgemeinbereiche): die Leuchte einer Karte/Kachel/Zeile ([data-licht]) geht an, sobald sie ins Bild kommt ----------
     Erst mit Skript werden die Karten dunkel gestellt (.ist-bereit) – ohne Skript oder mit „Bewegung reduzieren“ sind sie gleich an.
     Nebeneinanderliegende Karten gehen kurz nacheinander an (Verzögerung über --bs-k im CSS). Einmal an, bleibt an. */
  (function bereichKarten() {
    const raster = $(".bs-raster");
    if (!raster || reduceMotion || !("IntersectionObserver" in window)) return;
    raster.classList.add("ist-bereit");
    const io = new IntersectionObserver((eintraege) => eintraege.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("ist-an"); io.unobserve(e.target);
    }), { threshold: 0.35 });
    $$("[data-licht]", raster).forEach((k) => io.observe(k));
  })();

  /* ---------- Technische Parameter (Projektseiten, Ralf 11.10.2026: „dieser Bereich muss dringend animiert werden!“) ----------
     Jede Kachel geht an, sobald sie zu gut einem Drittel im Bild ist (.ist-an, einmal an bleibt an; Nachbarn nacheinander über --pk-d),
     das Symbol erzählt seinen Wert (CSS „Technische Parameter in Bewegung“), Zahlen ab 10 zählen hoch (EN 12464-1, R9, 3 SDCM bleiben stehen).
     Dauerbewegungen laufen nur, solange die Kachel sichtbar ist (.im-bild). Ohne Skript oder mit „Bewegung reduzieren“ steht alles sofort da. */
  (function paramKarten() {
    const sek = $("#details"), karten = $$(".param-card");
    if (!sek || !karten.length || reduceMotion || !("IntersectionObserver" in window)) return;
    sek.classList.add("pk-bereit");
    const zahl = /\d{1,3}(?:\.\d{3})+|\d+/g;
    const zaehle = (el, warten, von = 0, dauer = 1300) => {   // von: Anteil, bei dem das Zählen beginnt (je Zahl)
      const ziel = el.textContent, teile = [];
      let m, letzt = 0;
      while ((m = zahl.exec(ziel))) { teile.push(ziel.slice(letzt, m.index)); const n = +m[0].replace(/\./g, ""); teile.push({ n, punkt: m[0].includes(".") }); letzt = m.index + m[0].length; }
      teile.push(ziel.slice(letzt));
      if (!teile.some((t) => typeof t === "object" && t.n >= 10)) return;
      const text = (f) => teile.map((t) => typeof t === "string" ? t : t.n < 10 ? String(t.n) : (Math.round(t.n < 1000 || !von ? t.n * f : von + (t.n - von) * f)).toLocaleString(t.punkt ? "de-DE" : "en-US", { useGrouping: t.punkt })).join("");
      el.textContent = text(0);
      setTimeout(() => {
        const t0 = performance.now();
        const schritt = (t) => { const x = Math.min(1, (t - t0) / dauer), f = 1 - Math.pow(1 - x, 3); el.textContent = x < 1 ? text(f) : ziel; if (x < 1) requestAnimationFrame(schritt); };
        requestAnimationFrame(schritt);
      }, warten);
    };
    const io = new IntersectionObserver((eintraege) => eintraege.forEach((e) => {
      const k = e.target;
      k.classList.toggle("im-bild", e.isIntersecting);
      if (e.intersectionRatio >= 0.35 && !k.classList.contains("ist-an")) {
        k.classList.add("ist-an");
        const d = (parseFloat(getComputedStyle(k).getPropertyValue("--pk-d")) || 0) * 1000;
        // Farbtemperatur zählt mit dem Regler: ab 2200 K (linkes Ende der Leiste), im selben Takt wie er fährt (0,7 s später, 1,1 s)
        if (k.classList.contains("param-card--kelvin")) zaehle($(".param-card__value", k), d + 700, 2200, 1100);
        else if (!k.classList.contains("param-card--norm")) zaehle($(".param-card__value", k), d + 350);
      }
    }), { threshold: [0, 0.35] });
    karten.forEach((k) => io.observe(k));
  })();

  /* ---------- Merkzettel: Notizen am Rand, zum Schluss per WhatsApp, E-Mail oder LinkedIn besprechen ----------
     Gespeichert nur im Browser (localStorage, auch für andere Tabs). „Merken“ auf einer Leuchten-Kachel schreibt „• Name – Bereich“
     auf den Zettel (noch einmal tippen nimmt sie wieder herunter); ein Lichtfunke fliegt zum Zettel. Am Kontaktbereich heißt der Griff
     „Besprechen“, sobald etwas draufsteht. Esc, × oder ein Klick daneben schließt; der Text bleibt. */
  (function merkzettel() {
    const nz = $(".nz");
    if (!nz) return;
    const KEY = "fae-ecoled-merkzettel";
    let ersatz = "";   // falls der Browser keinen Speicher erlaubt (privates Fenster o. Ä.): wenigstens für diese Seite
    const lies = () => { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ersatz; } };
    const schreib = (t) => { ersatz = t; try { if (t.trim()) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch (e) { /* s. o. */ } };
    const griff = $(".nz-griff", nz), griffText = $(".nz-griff__text", nz), feld = $(".nz-feld", nz), text = $(".nz-text", nz);
    const zahl = $(".nz-zahl", nz), meldung = $(".nz-meldung", nz), leeren = $(".nz-leeren", nz), merk = $$("[data-merken]");
    let amKontakt = false, meldungUhr, leerenUhr;
    nz.hidden = false; feld.inert = true;
    text.value = lies();

    const anzahl = () => text.value.split("\n").filter((z) => z.trim()).length;
    const melde = (t) => { clearTimeout(meldungUhr); meldung.textContent = t; meldungUhr = setTimeout(() => (meldung.textContent = ""), 6000); };
    const auffrischen = () => {
      const n = anzahl();
      zahl.textContent = n || "";
      nz.classList.toggle("hat-notizen", n > 0);
      nz.classList.toggle("am-kontakt", amKontakt && n > 0);
      griffText.textContent = amKontakt && n ? "Besprechen" : "Merkzettel";
      $$(".nz-weg", nz).forEach((a) => a.setAttribute("aria-disabled", String(!n)));
      merk.forEach((k) => {
        const drin = text.value.includes(k.dataset.merken);
        k.classList.toggle("ist-gemerkt", drin); k.setAttribute("aria-pressed", String(drin));
        $(".nz-merken__text", k).textContent = drin ? k.dataset.an || "Gemerkt" : k.dataset.aus || "Merken";
      });
    };

    const offen = () => nz.classList.contains("ist-offen");
    const setze = (an, fokus = true) => {
      if (an === offen()) return;
      nz.classList.toggle("ist-offen", an); griff.setAttribute("aria-expanded", String(an)); feld.inert = !an;
      if (an && fokus) (matchMedia("(pointer: fine)").matches ? text : feld).focus({ preventScroll: true });   // am Handy nicht gleich die Tastatur
      if (!an && feld.contains(document.activeElement)) griff.focus({ preventScroll: true });
    };
    griff.addEventListener("click", () => setze(!offen()));
    $(".nz-zu", nz).addEventListener("click", () => setze(false));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && offen()) setze(false); });
    document.addEventListener("pointerdown", (e) => { if (offen() && !nz.contains(e.target) && !e.target.closest("[data-merken]")) setze(false, false); });

    text.addEventListener("input", () => { schreib(text.value); auffrischen(); });
    addEventListener("storage", (e) => { if (e.key === KEY) { text.value = e.newValue || ""; auffrischen(); } });   // anderer Tab hat geschrieben

    // Lichtfunke von der Kachel zum Griff, dazu stupst der Griff kurz an
    const flieg = (von) => {
      nz.classList.remove("hat-neu"); void nz.offsetWidth; nz.classList.add("hat-neu");
      if (reduceMotion || !von.animate) return;
      const a = von.getBoundingClientRect(), b = griff.getBoundingClientRect(), rand = parseFloat(getComputedStyle(griff).borderLeftWidth) || 0;   // Handy: links ein durchsichtiger Rand (Trefferfläche) – Ziel ist die sichtbare Lasche
      const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + rand + (b.width - rand) / 2, y1 = b.top + b.height / 2;
      const f = document.createElement("span"); f.className = "nz-funke"; document.body.appendChild(f);
      f.animate([
        { transform: `translate(${x0}px, ${y0}px) scale(.6)`, opacity: 0 },
        { transform: `translate(${x0}px, ${y0}px) scale(1.3)`, opacity: 1, offset: .12 },
        { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 90}px) scale(1)`, opacity: 1, offset: .55 },
        { transform: `translate(${x1}px, ${y1}px) scale(.5)`, opacity: .3 },
      ], { duration: 820, easing: "cubic-bezier(.45, 0, .25, 1)" }).onfinish = () => f.remove();
    };
    nz.addEventListener("animationend", () => nz.classList.remove("hat-neu"));
    merk.forEach((k) => {
      k.hidden = false;
      k.addEventListener("click", () => {
        const zeile = k.dataset.merken;
        if (text.value.includes(zeile)) {
          text.value = text.value.split("\n").filter((z) => !z.includes(zeile)).join("\n");
          melde(`„${zeile}“ ist vom Merkzettel herunter.`);
        } else {
          const t = text.value.replace(/\s+$/, "");
          text.value = (t ? t + "\n" : "") + "• " + zeile + "\n";
          melde(`„${zeile}“ steht auf dem Merkzettel.`);
          flieg(k);
        }
        schreib(text.value); auffrischen();
      });
    });

    // Besprechen: WhatsApp und E-Mail bekommen den Text mit, LinkedIn kann das nicht – dort wird er kopiert
    const nachricht = () => "Hallo FAE ecoled,\n\nich habe mir auf Ihrer Website Folgendes notiert und möchte es gern mit Ihnen besprechen:\n\n" + text.value.trim() + "\n";
    const kopiere = (t) => {
      const alt = () => { text.select(); try { return document.execCommand("copy"); } catch (e) { return false; } };
      return navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t).then(() => true, alt) : Promise.resolve(alt());
    };
    $$(".nz-weg", nz).forEach((a) => a.addEventListener("click", (e) => {
      if (!anzahl()) { e.preventDefault(); melde("Schreiben Sie zuerst etwas auf den Merkzettel."); text.focus(); return; }
      const t = nachricht(), weg = a.dataset.weg;
      if (weg === "whatsapp") a.href = `https://wa.me/${nz.dataset.wa}?text=${encodeURIComponent(t)}`;
      else if (weg === "mail") a.href = `mailto:${nz.dataset.mail}?subject=${encodeURIComponent("Mein Merkzettel – FAE ecoled")}&body=${encodeURIComponent(t + "\nViele Grüße\n")}`;
      else kopiere(t).then((ok) => melde(ok ? "Text kopiert – bei LinkedIn einfach in die Nachricht einfügen." : "Bitte den Text markieren und kopieren."));
    }));

    // Leeren in zwei Schritten, damit nichts aus Versehen verloren geht
    leeren.addEventListener("click", () => {
      if (!leeren.classList.contains("ist-sicher")) {
        leeren.classList.add("ist-sicher"); leeren.textContent = "Wirklich leeren?";
        leerenUhr = setTimeout(() => { leeren.classList.remove("ist-sicher"); leeren.textContent = "Leeren"; }, 3500);
        return;
      }
      clearTimeout(leerenUhr); leeren.classList.remove("ist-sicher"); leeren.textContent = "Leeren";
      text.value = ""; schreib(""); auffrischen(); melde("Der Merkzettel ist leer."); text.focus();
    });

    const kontakt = $("#contact");
    if (kontakt && "IntersectionObserver" in window) new IntersectionObserver(([e]) => { amKontakt = e.isIntersecting; auffrischen(); }, { threshold: 0.25 }).observe(kontakt);
    auffrischen();
  })();

  /* ---------- Artikel Ausgabe 09 (Ralf 10.10.2026: „attraktiver durch Motion … interaktiv wie der Rest der Seite“) ----------
     Jeder Baustein des Artikels läuft beim Erscheinen ein (.ist-da); erst mit Skript werden sie vorher ausgeblendet (.ist-bereit). */
  (function artikelBewegung() {
    const body = $(".article-body");
    if (!body || reduceMotion || !("IntersectionObserver" in window)) return;
    body.classList.add("ist-bereit");
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("ist-da"); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    $$(":scope > *", body).forEach((el) => io.observe(el));
  })();

  /* ---------- Film im Artikel: startet nur über den Play-Knopf (Ralf 11.10.2026: „der Film soll nicht automatisch starten, es muss ein
     Play-Button vorhanden sein“). Klick auf Knopf oder Startbild lädt und spielt mit Bedienleiste; danach steuert die Bedienleiste (Pause,
     Weiter), außerhalb des Bildes pausiert er. Am Ende zurück aufs Startbild mit Knopf – der Knopf liegt nie über Titel oder Logo des Films. ---------- */
  $$("video[data-film]").forEach((v) => {
    const fig = v.closest(".blk-video"), knopf = $(".film-play", fig), rahmen = $(".blk-video__rahmen", fig);
    const spielen = () => { if (v.preload === "none") v.preload = "auto"; v.controls = true; fig.classList.add("ist-gestartet"); v.play().catch(() => {}); };
    knopf.addEventListener("click", (e) => { e.stopPropagation(); spielen(); });
    rahmen.addEventListener("click", (e) => { if (!fig.classList.contains("ist-gestartet") && e.target === v) spielen(); });
    v.addEventListener("ended", () => { v.controls = false; fig.classList.remove("ist-gestartet"); v.preload = "none"; v.load(); });   // load(): Startbild wieder zeigen
    if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { if (!e.isIntersecting && !v.paused) v.pause(); }, { threshold: 0.15 }).observe(v);
  });

  /* ---------- Lichtdecke über dem Film-Abschnitt in Ausgabe 09 (Ralf 11.10.2026: aus drei Varianten gewählt, „mach sie kleiner“) ----------
     Kommt der Abschnitt ins Bild, schaltet die gezeichnete Lichtdecke ein (.ist-an: drei Gruppen, dann die Bespannung, Licht auf den Text),
     verlässt er es, wieder aus – wie die Cura gebogen im Magazin. Ohne Beobachter oder mit „Bewegung reduzieren“ gleich an. */
  (function filmDecke() {
    const f = $(".blk-film");
    if (!f || !$(".lf", f)) return;   // nur mit Lichtdecke (Ausgabe 09); Ausgabe 10 hat keine Grafik
    if (reduceMotion || !("IntersectionObserver" in window)) { f.classList.add("ist-an"); return; }
    new IntersectionObserver(([e]) => f.classList.toggle("ist-an", e.isIntersecting), { threshold: 0.22 }).observe(f);
  })();

  /* ---------- Lightbox für die Bildstreifen: Klick vergrößert, Pfeile/Tasten/Wischen blättern durch alle Streifenbilder der Seite,
     Esc, × oder ein Klick daneben schließt; der Fokus kehrt zum angeklickten Bild zurück ---------- */
  /* ---------- Unternehmerpreis (Startseite): Licht über dem Siegel geht an, sobald der Block ins Bild kommt – einmal, dann bleibt es an ---------- */
  $$("[data-preis]").forEach((el) => {
    if (reduceMotion || !("IntersectionObserver" in window)) { el.classList.add("ist-an"); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add("ist-an"); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el);
  });

  (function lightbox() {
    const lb = $(".lb"), knoepfe = $$("[data-gross]");
    if (!lb || !knoepfe.length || typeof lb.showModal !== "function") return;
    const bild = $(".lb-bild", lb), text = $(".lb-text", lb);
    let i = 0, zuletzt = null;
    const zeige = (k) => {
      i = (k + knoepfe.length) % knoepfe.length; const b = knoepfe[i];
      bild.src = b.dataset.gross; bild.alt = b.dataset.text; text.textContent = b.dataset.text;
      [i + 1, i - 1].forEach((j) => { const v = new Image(); v.src = knoepfe[(j + knoepfe.length) % knoepfe.length].dataset.gross; });   // Nachbarn vorladen
    };
    knoepfe.forEach((b, k) => b.addEventListener("click", () => { zuletzt = b; zeige(k); lb.showModal(); }));
    $(".lb-zu", lb).addEventListener("click", () => lb.close());
    $(".lb-pfeil--zurueck", lb).addEventListener("click", () => zeige(i - 1));
    $(".lb-pfeil--weiter", lb).addEventListener("click", () => zeige(i + 1));
    lb.addEventListener("click", (e) => { if (!e.target.closest(".lb-figur, button")) lb.close(); });   // Klick auf den dunklen Grund
    lb.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") zeige(i + 1); else if (e.key === "ArrowLeft") zeige(i - 1); });
    lb.addEventListener("close", () => { bild.removeAttribute("src"); if (zuletzt) zuletzt.focus(); });
    let x0 = null;   // Wischen (Finger/Stift)
    lb.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") x0 = e.clientX; });
    lb.addEventListener("pointerup", (e) => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) zeige(i + (dx < 0 ? 1 : -1)); });
  })();

  /* ---------- Lichtschalter Vorher/Nachher (Ausgabe 09): Klick blendet das Bild mit leuchtender Decke ein, die Kugel geht an;
     die Kugel atmet, bis zum ersten Mal geschaltet wurde ---------- */
  $$("[data-schalter]").forEach((sch) => {
    const knopf = $(".sch-knopf", sch), text = $(".sch-text", sch);
    knopf.addEventListener("click", () => {
      const an = !sch.classList.contains("ist-an");
      sch.classList.toggle("ist-an", an); sch.classList.add("ist-benutzt");
      knopf.setAttribute("aria-checked", an); text.textContent = an ? text.dataset.an : text.dataset.aus;
    });
  });

  /* ---------- Prüfplatz (Ausgabe 10, Ralf 11.10.2026: „die Spielerei, dass man das Licht anklicken kann, brauche ich nicht unbedingt“) ----------
     Das Licht geht von selbst an, sobald der Bereich zu gut der Hälfte im Bild ist (einmal, nach einem kurzen Moment). Die beiden Karten
     schalten zusätzlich – Bedienung wie die Lichtfarben auf der Startseite (Radiogruppe, Pfeiltasten wechseln). */
  $$("[data-pruef]").forEach((root) => {
    const karten = $$(".pr-karte", root), status = $("[data-pr-status]", root);
    const setze = (an, vonHand) => {
      root.classList.toggle("ist-an", an); if (vonHand) root.classList.add("ist-benutzt");
      karten.forEach((k) => { const ja = (k.dataset.zustand === "an") === an; k.setAttribute("aria-checked", ja); k.tabIndex = ja ? 0 : -1; if (ja) status.textContent = k.dataset.status; });
    };
    karten.forEach((k, i) => {
      k.addEventListener("click", () => setze(k.dataset.zustand === "an", true));
      k.addEventListener("keydown", (e) => {
        if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
        e.preventDefault(); const n = karten[(i + 1) % karten.length]; n.focus(); setze(n.dataset.zustand === "an", true);
      });
    });
    if (!("IntersectionObserver" in window)) { setze(true); return; }
    // 55 % bezogen auf das, was überhaupt ins Fenster passt (Prüfung 11.10.2026): Am Handy quer ist der Bereich 1340 px hoch, das Fenster
    // 390 px – 55 % des Bereichs wären nie sichtbar gewesen, das Licht ging nie an.
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      const passt = Math.min(e.boundingClientRect.height, (e.rootBounds && e.rootBounds.height) || innerHeight);
      if (e.intersectionRect.height < 0.55 * passt) return;
      io.disconnect();
      setTimeout(() => { if (!root.classList.contains("ist-benutzt")) setze(true); }, reduceMotion ? 0 : 700);
    }, { threshold: Array.from({ length: 21 }, (_, i) => i / 20) });
    io.observe(root);
  });

  /* ---------- Sprünge innerhalb der Seite (Menü der Startseite, Kontakt-Knöpfe, Kapitel, Nach oben) ----------
     Ralf 11.10.2026: nach „Ebenen“ für alle Seitenwechsel „auch bei diesen [Menüpunkten] und bei jeglichen Kontakt-Buttons“ → jeder Sprung zu
     einer Stelle derselben Seite (#… oder /#… auf der Startseite) läuft als derselbe Übergang (View Transition in der Seite, CSS „Seitenübergang
     Ebenen“): nach unten = hin (die Ansicht tritt zurück, die Zielstelle schiebt sich von unten darüber), nach oben = zurück (die Ansicht fällt
     nach unten weg, die Zielstelle kommt aus der Tiefe nach vorn); die Kopfzeile steht still. Gesprungen wird ohne Scrollen; bevor das neue Bild
     aufgenommen wird, laden die Bilder an der Zielstelle (höchstens 0,4 s). Ohne die Technik oder mit „Bewegung reduzieren“: weich scrollen wie bisher. */
  const vtTypen = typeof ViewTransition !== "undefined" && "types" in ViewTransition.prototype && !!document.startViewTransition;
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;   // z. B. Menü am Handy: erstes Antippen zieht nur auf
    const a = e.target.closest("a[href]"); if (!a) return;
    const roh = a.getAttribute("href"); if (roh === "#") return;
    let u; try { u = new URL(roh, location.href); } catch (err) { return; }
    if (u.origin !== location.origin || u.pathname !== location.pathname || !u.hash) return;
    const ziel = u.hash, t = document.getElementById(decodeURIComponent(ziel.slice(1)));
    if (!t) return;
    e.preventDefault();
    // Noch nicht eingeblendete Artikel-Abschnitte stehen 28 px tiefer (Einblenden mit Verschiebung) – ohne das landete der Sprung von den
    // Kapitel-Kacheln 28 px zu hoch, unter der Kopfleiste (Prüfung 11.10.2026). Also vorher sofort einblenden.
    if (t.parentElement && t.parentElement.classList.contains("article-body") && !t.classList.contains("ist-da")) {
      t.style.transition = "none"; t.classList.add("ist-da"); void t.offsetHeight; t.style.transition = "";
    }
    const fertig = () => {
      // Tastatur: Fokus ins Ziel, damit es mit Tab dort weitergeht (sonst sprang die Seite zurück zu den Kacheln); Adresse mit Sprungmarke
      if (!/^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(t.tagName) && !t.hasAttribute("tabindex")) t.setAttribute("tabindex", "-1");
      t.focus({ preventScroll: true });
      if (location.hash !== ziel) history.pushState(null, "", ziel);
    };
    if (reduceMotion || !vtTypen) { t.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" }); fertig(); return; }
    const runter = t.getBoundingClientRect().top > 0, kopf = $(".site-header");
    if (kopf) kopf.style.viewTransitionName = "ub-kopf";
    const springen = async () => {
      document.documentElement.style.scrollBehavior = "auto";
      t.scrollIntoView({ behavior: "instant" });
      document.documentElement.style.scrollBehavior = "";
      fertig();
      const bilder = $$("img").filter((im) => { const r = im.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; });
      bilder.forEach((im) => { im.loading = "eager"; });
      await Promise.race([Promise.all(bilder.map((im) => (im.decode ? im.decode().catch(() => {}) : null))), new Promise((r) => setTimeout(r, 400))]);
    };
    const vt = document.startViewTransition({ update: springen, types: runter ? ["ub"] : ["ub", "ub-zurueck"] });
    vt.finished.finally(() => { if (kopf) kopf.style.viewTransitionName = ""; });
  });
})();
