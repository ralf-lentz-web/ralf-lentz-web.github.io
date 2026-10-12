/* Seitenübergänge (View Transitions zwischen zwei Seiten): Der Browser hält das Bild der alten Seite fest, lädt die neue und animiert dann
   – ohne Flackern. Läuft im <head>, weil pagereveal vor dem ersten Bild der neuen Seite angemeldet sein muss. Browser ohne die Technik
   wechseln einfach wie bisher.
   Ralf 11.10.2026: „egal welche Navigation auf welcher Seite ich drücke, ich möchte für alle eine großartige Transition – mach mir drei
   Vorschläge“ → aus A „Bild findet seinen Platz“, B „Lichtband“, C „Ebenen“ gewählt: „wir nehmen für alle Navigationen auf der kompletten
   Seite C“. Jeder Wechsel zwischen zwei Seiten der Website (Links, Kopfleiste, Menü, Karten, Lichtschiene, Heft → Artikel, Zurück im Browser)
   läuft als „Ebenen“: die alte Seite tritt zurück (kleiner, runde Ecken, dunkler), die neue schiebt sich von unten darüber; zurück (zur
   Übersicht = Startseite mit Sprungmarke, oder Zurück im Browser) umgekehrt – die alte fällt nach unten weg, die neue kommt aus der Tiefe nach
   vorn. Übergangstypen ub + ub-zurueck (CSS „Seitenübergang Ebenen“), die Kopfzeile steht still. Mit Sprungmarke steht die Startseite vor
   dem ersten Bild schon beim Abschnitt (index.html ist bis zu den Abschnitten render-blockiert, <link rel="expect">); bei den
   Anwendungsbereichen ist der Bereich gewählt, von dem man kommt. */
(function () {
  "use strict";
  const KEY = "fae-wechsel";
  const lies = (k) => { try { return JSON.parse(sessionStorage.getItem(k) || "null"); } catch (e) { return null; } };
  const merke = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const pfad = (u) => { try { return new URL(u, location.href).pathname; } catch (e) { return ""; } };
  const html = document.documentElement;

  // Alte Seite: Klick auf einen Weg zu einer anderen Seite der Website merkt sich Ziel und Richtung
  document.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const a = e.target.closest("a[href], [data-href]"); if (!a || a.hasAttribute("download") || (a.target && a.target !== "_self")) return;
    let u; try { u = new URL(a.dataset.href || a.getAttribute("href"), location.href); } catch (err) { return; }
    if (u.origin !== location.origin || u.pathname === location.pathname || !/^https?:$/.test(u.protocol)) return;
    const art = u.pathname === "/" ? "zurueck" : "hin";   // zur Startseite (Logo, „Start“, „Zur Übersicht“) immer zurück – vorher nur mit Sprungmarke (Ralf 12.10.2026)
    merke(KEY, { pfad: u.pathname, t: Date.now(), art, bereich: a.dataset.bereich || "" });
  }, true);

  // Kopfzeile als eigene Gruppe: sie steht beim Wechsel still, nur die Seite darunter bewegt sich
  const benenne = () => { const kopf = document.querySelector(".site-header"); if (kopf) kopf.style.viewTransitionName = "ub-kopf"; };
  // Startseite mit Sprungmarke: sofort beim Abschnitt stehen (kein sichtbares Durchscrollen); Anwendungsbereiche: Bereich wählen
  const ankunft = (u) => {
    const sek = location.hash && document.getElementById(location.hash.slice(1)); if (!sek) return;
    const bx = sek.querySelector(".bx"), k = parseInt(u.bereich, 10);
    if (sek.id === "bereiche" && bx) {
      const knoepfe = bx.querySelectorAll(".bx-knopf"), bilder = bx.querySelectorAll(".bx-bild");
      if (k >= 0 && k < knoepfe.length) {
        knoepfe.forEach((kn, i) => { kn.classList.toggle("ist-aktiv", i === k); kn.setAttribute("aria-selected", String(i === k)); kn.tabIndex = i === k ? 0 : -1; });
        bilder.forEach((b, i) => { b.classList.toggle("ist-aktiv", i === k); if (i === k) b.removeAttribute("inert"); else b.setAttribute("inert", ""); });
        bx.dataset.gewaehlt = "1";   // main.js: nicht von selbst weiterschalten
        const im = bilder[k].querySelector("img"); if (im) im.loading = "eager";
      }
    }
    const kopf = sek.querySelector(".divider") || sek;
    const ziel = Math.max(0, kopf.getBoundingClientRect().top + scrollY - 150);
    html.style.scrollBehavior = "auto";
    scrollTo({ top: ziel, behavior: "instant" });
    setTimeout(() => { scrollTo({ top: ziel, behavior: "instant" }); html.style.scrollBehavior = ""; }, 900);   // falls der Browser danach noch zur Sprungmarke scrollt
  };
  const typen = (vt, art) => { if (vt.types) { vt.types.add("ub"); if (art === "zurueck") vt.types.add("ub-zurueck"); } };
  const zurueckImBrowser = (e) => (e && e.activation ? e.activation.navigationType : self.navigation && navigation.activation ? navigation.activation.navigationType : "") === "traverse";

  addEventListener("pageswap", (e) => {
    const vt = e.viewTransition; if (!vt) return;
    const ziel = e.activation && e.activation.entry ? pfad(e.activation.entry.url) : "", r = lies(KEY);
    if (r && Date.now() - r.t < 5000 && r.pfad === ziel) { typen(vt, r.art); benenne(); return; }
    if (zurueckImBrowser(e)) { typen(vt, "zurueck"); benenne(); return; }
    vt.skipTransition();
  });
  addEventListener("pagereveal", (e) => {
    const vt = e.viewTransition; if (!vt) return;
    const r = lies(KEY); try { sessionStorage.removeItem(KEY); } catch (err) {}
    let art;
    if (r && Date.now() - r.t < 8000 && r.pfad === location.pathname) { art = r.art; if (art === "zurueck") ankunft(r); }
    else if (zurueckImBrowser()) art = "zurueck";
    else { vt.skipTransition(); return; }
    typen(vt, art); benenne();
    html.dataset.wechselLief = art; html.dataset.wechselAb = String(Math.round(performance.now()));   // für Prüfungen
  });

  // Vorladen – Magazin: das Kopfbild des obersten Hefts, sobald der Stapel im Bild ist; Bereiche: Übersichts- und Kopfbilder (data-bild-srcset)
  const vorladen = () => {
    const a = document.querySelector(".mgz-lage.ist-oben a.mz");
    if (!a || !a.dataset.kopfSrcset || a.dataset.geladen) return;
    a.dataset.geladen = "1"; const im = new Image(); im.sizes = a.dataset.kopfSizes || "100vw"; im.srcset = a.dataset.kopfSrcset;
  };
  const vorlade = (el) => {
    if (!el || !el.dataset.bildSrcset || el.dataset.geladen) return;
    el.dataset.geladen = "1"; const im = new Image(); im.sizes = el.dataset.bildSizes || "100vw"; im.srcset = el.dataset.bildSrcset;
  };
  addEventListener("DOMContentLoaded", () => {
    const st = document.querySelector(".mgz-stapel");
    if (st) {
      if ("IntersectionObserver" in window) new IntersectionObserver(([x], io) => { if (x.isIntersecting) { vorladen(); io.disconnect(); } }, { rootMargin: "300px 0px" }).observe(st); else vorladen();
      document.querySelectorAll(".mgz-pfeil").forEach((b) => b.addEventListener("click", () => setTimeout(vorladen, 60)));
    }
    const zurueck = document.querySelector("a[href='/#bereiche'][data-bild-srcset]");
    if (zurueck) setTimeout(() => vorlade(zurueck), 2500);   // Übersichtsbild des Bereichs leise nachladen, wenn die Seite steht
    document.querySelectorAll("[data-bild-srcset]").forEach((el) => {
      el.addEventListener("pointerenter", () => vorlade(el)); el.addEventListener("focus", () => vorlade(el)); el.addEventListener("touchstart", () => vorlade(el), { passive: true });
    });
  });
})();
