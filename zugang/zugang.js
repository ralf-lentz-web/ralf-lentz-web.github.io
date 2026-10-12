// Zugangsseite der Vorschau: prüft das Passwort im Browser (PBKDF2, gleiche Werte wie in vorschau.sh) und merkt sich den Zugang
// 30 Tage. Danach zurück zur Seite, von der man kam. Werte werden von vorschau.sh eingesetzt.
(() => {
  const SALZ = "d9a63753bd134b937fd0e1bb1a4060a1", RUNDEN = 600000, PRUEF = "d91db8e6d5a346fdc9d2365103404e52085fd1bbf4aa8577f127c2f4717e3e62", SCHLUESSEL = "fae-vorschau-zugang", TAGE = 30;
  const form = document.getElementById("zugang"), feld = document.getElementById("passwort"), fehler = document.getElementById("fehler"), knopf = form.querySelector("button");
  const ziel = (() => { const z = new URLSearchParams(location.search).get("ziel") || "/"; return /^\/(?!\/)/.test(z) && !z.startsWith("/zugang") ? z : "/"; })();
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); fehler.textContent = ""; knopf.disabled = true;
    try {
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", enc.encode(feld.value), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(SALZ), iterations: RUNDEN }, key, 256);
      if (hex(bits) === PRUEF) {
        try { localStorage.setItem(SCHLUESSEL, JSON.stringify({ p: PRUEF, bis: Date.now() + TAGE * 864e5 })); } catch {}
        location.replace(ziel);
        return;
      }
      fehler.textContent = "Das Passwort stimmt nicht."; feld.select();
    } catch { fehler.textContent = "Der Browser konnte das Passwort nicht prüfen."; }
    knopf.disabled = false;
  });
})();
