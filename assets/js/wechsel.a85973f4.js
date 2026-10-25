/* Seitenübergänge (View Transitions zwischen zwei Seiten): Der Browser hält das Bild der alten Seite fest, lädt die neue und animiert dann
   – ohne Flackern. Läuft im <head>, weil pagereveal vor dem ersten Bild der neuen Seite angemeldet sein muss. Browser ohne die Technik
   wechseln einfach wie bisher.
   Ralf 11.10.2026: „egal welche Navigation auf welcher Seite ich drücke, ich möchte für alle eine großartige Transition – mach mir drei
   Vorschläge“ → aus A „Bild findet seinen Platz“, B „Lichtband“, C „Ebenen“ gewählt: „wir nehmen für alle Navigationen auf der kompletten
   Seite C“. Jeder Wechsel zwischen zwei Seiten der Website (Links, Kopfleiste, Menü, Karten, Lichtschiene, Heft → Artikel, Zurück im Browser)
   läuft als „Ebenen“: die alte Seite tritt zurück (kleiner, runde Ecken, dunkler), die neue schiebt sich von unten darüber; zurück (zur
   Startseite oder Zurück im Browser) genauso, nur kommt die neue von oben (seit 14.10.2026; vorher fiel die alte nach unten weg – Ralf:
   „sieht schrecklich aus“). Übergangstypen ub + ub-zurueck (CSS „Seitenübergang Ebenen“), die Kopfzeile steht still. Mit Sprungmarke steht die Startseite vor
   dem ersten Bild schon beim Abschnitt (index.html ist bis zu den Abschnitten render-blockiert, <link rel="expect">); bei den
   Anwendungsbereichen ist der Bereich gewählt, von dem man kommt.
   Speichert nichts (Ralf 23.10.2026: „mach es rechtlich sicher, dass keine Cookies erhoben werden“): Richtung, Ziel und Herkunft kommen aus
   der Navigation selbst (Navigation API: activation.navigationType, .entry, .from) – vorher merkte sich ein Klick-Handler das Ziel kurz im
   sessionStorage („fae-wechsel“). Browser ohne Navigation API wechseln ohne Übergang (wie vorher schon, dort fehlte activation auch). */
(function () {
  "use strict";
  const pfad = (u) => { try { return new URL(u, location.href).pathname; } catch (e) { return ""; } };
  const html = document.documentElement;

  // Richtung: Weg zu einer anderen Seite der Website (push) → „hin“, zur Startseite (Logo, „Start“, „Zur Übersicht“) immer „zurück“
  // (Ralf 12.10.2026); Zurück/Vor im Browser (traverse) → „zurück“; alles andere (Neu laden, Ersetzen, gleiche Seite) ohne Übergang
  const richtung = (typ, von, nach) => {
    if (typ === "traverse") return "zurueck";
    if (typ !== "push" || !von || !nach || von === nach) return "";
    return nach === "/" ? "zurueck" : "hin";
  };

  // Kopfzeile als eigene Gruppe: sie steht beim Wechsel still, nur die Seite darunter bewegt sich
  const benenne = () => { const kopf = document.querySelector(".site-header"); if (kopf) kopf.style.viewTransitionName = "ub-kopf"; };
  // Startseite mit Sprungmarke: sofort beim Abschnitt stehen (kein sichtbares Durchscrollen); Anwendungsbereiche: Bereich wählen
  const ankunft = (von) => {
    const sek = location.hash && document.getElementById(location.hash.slice(1)); if (!sek) return;
    const bx = sek.querySelector(".bx");
    if (sek.id === "bereiche" && bx) {
      const knoepfe = bx.querySelectorAll(".bx-knopf"), bilder = bx.querySelectorAll(".bx-bild");
      const k = [...knoepfe].findIndex((kn) => kn.dataset.href && pfad(kn.dataset.href) === von);   // der Bereich, von dem man kommt
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

  addEventListener("pageswap", (e) => {
    const vt = e.viewTransition; if (!vt) return;
    const a = e.activation, art = a && a.entry ? richtung(a.navigationType, location.pathname, pfad(a.entry.url)) : "";
    if (!art) { vt.skipTransition(); return; }
    typen(vt, art); benenne();
  });
  addEventListener("pagereveal", (e) => {
    const vt = e.viewTransition; if (!vt) return;
    const a = self.navigation && navigation.activation, von = a && a.from ? pfad(a.from.url) : "";
    const art = a ? richtung(a.navigationType, von, location.pathname) : "";
    if (!art) { vt.skipTransition(); return; }
    if (art === "zurueck" && a.navigationType === "push") ankunft(von);
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
