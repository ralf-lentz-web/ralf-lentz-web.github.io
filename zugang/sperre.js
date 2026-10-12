// Sperre der Vorschau (Ralf 12.10.2026: „einfache Sperre“): steht als erstes Skript im <head> jeder Seite und blockiert den Aufbau,
// bis feststeht, ob der Browser schon freigeschaltet ist. Wenn nicht: Seite unsichtbar lassen und zur Zugangsseite. Ohne Netz-Umweg,
// ohne Austausch der Seite – Übergänge, Vorladen und Sprungmarken bleiben wie auf der echten Seite.
(() => {
  const PRUEF = "d91db8e6d5a346fdc9d2365103404e52085fd1bbf4aa8577f127c2f4717e3e62";
  let ok = false;
  try { const z = JSON.parse(localStorage.getItem("fae-vorschau-zugang") || "null"); ok = !!z && z.p === PRUEF && z.bis > Date.now(); } catch {}
  if (!ok) {
    document.documentElement.style.visibility = "hidden";
    location.replace("/zugang/?ziel=" + encodeURIComponent(location.pathname + location.search + location.hash));
  }
})();
