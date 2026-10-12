/* 360°-Ansicht im Magazin, Ausgabe 09 (Ralf 11.10.2026: 360°-Video der Montage, fünf Vorschläge als Vorschau gebaut, gewählt „1“ –
   „Mittendrin stehen“): frei umsehen mit Maus oder Finger, am Handy auf Wunsch per Lagesensor; Leuchtpunkte erklären, was zu sehen ist.
   Ohne Fremdbibliothek: ein Vollbild-Dreieck in WebGL, der Fragment-Shader rechnet für jeden Bildpunkt die Blickrichtung aus und liest das
   equirektangulare Videobild (2:1) an dieser Stelle. Mathematik wie ecoled/animationen/zsg-360/tools/rund.py: Drehung R = Ry(gier)·Rx(nick),
   gier positiv = nach rechts, nick positiv = nach oben. Gezeichnet wird nur, solange die Ansicht im Bild ist; das Video lädt erst, wenn sie
   näher als zwei Bildschirmhöhen ist, und pausiert außerhalb. Ohne WebGL steht ein Hinweis da. */
(function () {
  "use strict";
  const bloecke = Array.from(document.querySelectorAll("[data-rund]"));
  if (!bloecke.length) return;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches, touch = matchMedia("(hover: none)").matches;
  const GRAD = Math.PI / 180, clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function dreh(gier, nick) {   // Zeilen der Drehmatrix Ry(gier) · Rx(nick)
    const g = gier * GRAD, n = nick * GRAD, cg = Math.cos(g), sg = Math.sin(g), cn = Math.cos(n), sn = Math.sin(n);
    return [[cg, -sg * sn, sg * cn], [0, cn, sn], [-sg, -cg * sn, cg * cn]];
  }
  const spalten = (R) => new Float32Array([R[0][0], R[1][0], R[2][0], R[0][1], R[1][1], R[2][1], R[0][2], R[1][2], R[2][2]]);

  const VS = "attribute vec2 a;varying vec2 v;void main(){v=a;gl_Position=vec4(a,0.,1.);}";
  const FS = `precision highp float;
varying vec2 v;
uniform sampler2D uBild; uniform mat3 uR; uniform float uK, uAsp;
const float PI = 3.14159265359;
void main() {
  vec3 d = normalize(uR * vec3(v.x * uK * uAsp, v.y * uK, 1.0));
  vec2 t = vec2(atan(d.x, d.z) / (2.0 * PI) + 0.5, 0.5 - asin(clamp(d.y, -1.0, 1.0)) / PI);
  gl_FragColor = vec4(texture2D(uBild, t).rgb, 1.0);
}`;

  // ein Video für alle Ansichten (Computer 3840 px breit, Handy 2048 px)
  const erster = bloecke[0];
  const gross = Math.min(screen.width, screen.height) * Math.min(devicePixelRatio || 1, 2) >= 900 && !touch;
  let video = null;
  const holeVideo = () => {
    if (video) return video;
    video = document.createElement("video");
    Object.assign(video, { muted: true, loop: true, playsInline: true, preload: "auto" });
    video.setAttribute("muted", ""); video.setAttribute("playsinline", "");
    video.className = "rund-video"; video.setAttribute("aria-hidden", "true");
    video.src = gross ? erster.dataset.videoGross : erster.dataset.videoKlein;
    document.body.appendChild(video);   // im Dokument (unsichtbar) – iOS gibt sonst keine Bilder heraus
    return video;
  };
  const nutzer = new Set();
  const videoLaufen = () => { if (video) { if (nutzer.size && !reduceMotion) video.play().catch(() => {}); else video.pause(); } };

  class Ansicht {
    constructor(canvas) {
      this.canvas = canvas;
      const opt = { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: "high-performance" };
      const gl = this.gl = canvas.getContext("webgl2", opt) || canvas.getContext("webgl", opt);
      if (!gl) throw new Error("kein WebGL");
      const webgl2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = { R: gl.getUniformLocation(pr, "uR"), K: gl.getUniformLocation(pr, "uK"), Asp: gl.getUniformLocation(pr, "uAsp") };
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([17, 17, 17]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, webgl2 ? gl.REPEAT : gl.CLAMP_TO_EDGE);   // rundherum ohne Naht (WebGL 1 kann REPEAT nur bei Zweierpotenzen)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      this.blick = { gier: 0, nick: 0, phi: 36 };   // phi = halber senkrechter Bildwinkel
      this.verloren = false;
      canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.verloren = true; });
    }
    lade(quelle) { const gl = this.gl; gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, quelle); }
    zeichne() {
      if (this.verloren) return;
      const gl = this.gl, d = Math.min(devicePixelRatio || 1, 2), r = this.canvas.getBoundingClientRect();
      const w = Math.max(2, Math.round(r.width * d)), h = Math.max(2, Math.round(r.height * d));
      if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; gl.viewport(0, 0, w, h); }
      gl.uniformMatrix3fv(this.u.R, false, spalten(dreh(this.blick.gier, this.blick.nick)));
      gl.uniform1f(this.u.K, Math.tan(this.blick.phi * GRAD)); gl.uniform1f(this.u.Asp, w / h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // Richtung (lon/lat in Grad) → Bildschirmpunkt (0…1), null wenn nicht im Bild
    projiziere(lon, lat) {
      const R = dreh(this.blick.gier, this.blick.nick), la = lat * GRAD, lo = lon * GRAD;
      const d = [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
      const c = [0, 1, 2].map((j) => R[0][j] * d[0] + R[1][j] * d[1] + R[2][j] * d[2]);   // Rᵀ·d
      if (c[2] <= 0.05) return null;
      const k = Math.tan(this.blick.phi * GRAD), asp = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
      const x = c[0] / c[2] / (k * asp), y = c[1] / c[2] / k;
      return Math.abs(x) > 1.1 || Math.abs(y) > 1.1 ? null : [x * 0.5 + 0.5, 0.5 - y * 0.5];
    }
  }

  const sichtbarkeit = (el, cb, margin) => { if (!("IntersectionObserver" in window)) { cb(true); return; } new IntersectionObserver(([e]) => cb(e.isIntersecting), { rootMargin: margin || "0px" }).observe(el); };

  bloecke.forEach((el) => {
    const canvas = el.querySelector("canvas.rund-canvas"), buehne = el.querySelector(".rund-buehne");
    let a;
    try { a = new Ansicht(canvas); } catch (err) { el.classList.add("ohne-webgl"); return; }
    el.classList.add("ist-bereit");
    Object.assign(a.blick, { gier: Number(el.dataset.gier || 0), nick: Number(el.dataset.nick || 0), phi: touch ? 42 : 36 });
    const punkte = Array.from(el.querySelectorAll(".rund-punkt"));
    let sichtbar = false, lauf = false, alt = performance.now(), vt = -1, geladen = false;
    // Standbild, bis das Video Bilder liefert
    if (el.dataset.standbild) { const im = new Image(); im.decoding = "async"; im.onload = () => { if (!geladen) { a.lade(im); a.zeichne(); } }; im.src = el.dataset.standbild; }

    // Ziehen (Maus: frei; Finger: nur waagerecht – senkrecht scrollt die Seite), Trägheit, ohne Eingabe langsam weiterdrehen
    const st = { dx: 0, dy: 0, zieht: false, zuletzt: -1e9, x: 0, y: 0, art: "" };
    buehne.addEventListener("pointerdown", (e) => { if (e.target.closest(".rund-punkt, .rund-lage")) return; st.zieht = true; st.x = e.clientX; st.y = e.clientY; st.art = e.pointerType; st.zuletzt = performance.now(); if (e.pointerType === "mouse") buehne.setPointerCapture(e.pointerId); buehne.classList.add("ist-gezogen"); el.classList.add("ist-benutzt"); start(); });
    buehne.addEventListener("pointermove", (e) => {
      if (!st.zieht) return;
      const f = (a.blick.phi * 2) / Math.max(1, buehne.clientHeight);   // Grad pro Pixel
      const dx = (e.clientX - st.x) * f, dy = st.art === "touch" ? 0 : (e.clientY - st.y) * f;
      st.x = e.clientX; st.y = e.clientY;
      a.blick.gier -= dx; a.blick.nick = clamp(a.blick.nick + dy, -55, 85);
      st.dx = -dx; st.dy = dy; st.zuletzt = performance.now(); start();
    });
    const ende = () => { st.zieht = false; buehne.classList.remove("ist-gezogen"); };
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((t) => buehne.addEventListener(t, ende));
    // Tastatur: Pfeiltasten drehen und neigen
    buehne.addEventListener("keydown", (e) => {
      const s = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, 6], ArrowDown: [0, -6] }[e.key];
      if (!s || e.target !== buehne) return; e.preventDefault();
      a.blick.gier += s[0]; a.blick.nick = clamp(a.blick.nick + s[1], -55, 85); st.zuletzt = performance.now(); el.classList.add("ist-benutzt"); start();
    });
    const bewegung = (dt) => {
      if (st.zieht) return true;
      const tr = Math.exp(-dt * 4);
      if (Math.abs(st.dx) + Math.abs(st.dy) > 0.002) { a.blick.gier += st.dx * 0.9; a.blick.nick = clamp(a.blick.nick + st.dy * 0.9, -55, 85); st.dx *= tr; st.dy *= tr; return true; }
      if (!reduceMotion && performance.now() - st.zuletzt > 3500) { a.blick.gier += 3.5 * dt; return true; }   // ohne Eingabe langsam weiterdrehen
      return false;
    };
    // Handy drehen (iOS fragt nach Erlaubnis – nur nach einem Tippen)
    const lageKnopf = el.querySelector(".rund-lage");
    if (lageKnopf) {
      if (!touch || !("DeviceOrientationEvent" in window)) lageKnopf.hidden = true;
      else {
        let basis = null, an = false;
        const auf = (e) => {
          if (e.alpha == null) return;
          if (!basis) basis = { a: e.alpha, g: a.blick.gier, n: a.blick.nick, b: e.beta };
          a.blick.gier = basis.g - (e.alpha - basis.a); a.blick.nick = clamp(basis.n + (e.beta - basis.b), -55, 85);
          st.zuletzt = performance.now(); start();
        };
        lageKnopf.addEventListener("click", async () => {
          if (an) { removeEventListener("deviceorientation", auf); an = false; basis = null; lageKnopf.setAttribute("aria-pressed", "false"); return; }
          try { if (typeof DeviceOrientationEvent.requestPermission === "function" && (await DeviceOrientationEvent.requestPermission()) !== "granted") return; } catch (err) { return; }
          addEventListener("deviceorientation", auf); an = true; lageKnopf.setAttribute("aria-pressed", "true"); el.classList.add("ist-benutzt");
        });
      }
    }
    // Leuchtpunkte: folgen dem Blick; Tippen/Klick öffnet die Erklärung, ein anderer Punkt schließt den ersten
    punkte.forEach((p) => p.addEventListener("click", () => { const offen = !p.classList.contains("ist-offen"); punkte.forEach((q) => { q.classList.remove("ist-offen"); q.setAttribute("aria-expanded", "false"); }); p.classList.toggle("ist-offen", offen); p.setAttribute("aria-expanded", String(offen)); }));

    const schritt = (t) => {
      const dt = Math.min(0.05, (t - alt) / 1000); alt = t;
      const bewegt = bewegung(dt);
      let neu = false;
      if (video && video.readyState >= 2 && video.currentTime !== vt) { vt = video.currentTime; a.lade(video); geladen = true; neu = true; }
      a.zeichne();
      punkte.forEach((p) => { const s = a.projiziere(Number(p.dataset.lon), Number(p.dataset.lat)); p.classList.toggle("ist-weg", !s); if (s) p.style.translate = `${(s[0] * 100).toFixed(2)}cqw ${(s[1] * 100).toFixed(2)}cqh`; });
      if (sichtbar && (bewegt || neu || (video && !video.paused))) requestAnimationFrame(schritt); else lauf = false;
    };
    function start() { if (!lauf && sichtbar) { lauf = true; alt = performance.now(); requestAnimationFrame(schritt); } }
    sichtbarkeit(el, (v) => { sichtbar = v; if (v) { holeVideo(); nutzer.add(el); } else nutzer.delete(el); videoLaufen(); if (v) start(); });
    sichtbarkeit(el, (v) => { if (v) holeVideo(); }, "200% 0px");   // vorladen
    addEventListener("resize", () => { if (sichtbar) { a.zeichne(); start(); } });
  });
})();
