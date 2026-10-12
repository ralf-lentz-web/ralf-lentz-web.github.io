// Kopfbild mit Anker (Refurbishment): sofort nach dem Hero-Markup ausgeführt, damit das Bild schon beim ersten Zeichnen richtig liegt
// und nicht nachträglich springt (CLS 0,15–0,39 am 12.10.2026). Gleiche Rechnung wie in main.js, das später bei Schrift und Fenstergröße
// nachzieht. Blockierend und winzig – bewusst kein defer.
(function () {
  var hochkant = matchMedia("(orientation: portrait)");
  var bilder = document.querySelectorAll(".bs-hero__bild[data-anker]");
  for (var i = 0; i < bilder.length; i++) {
    var im = bilder[i], a = im.dataset.anker.split(" ").map(Number), px = a[0], py = a[1];
    var rahmen = im.closest(".bs-hero__slide"), hero = im.closest(".bs-hero"), titel = hero && hero.querySelector(".bs-hero__titel");
    var W = rahmen.clientWidth, H = rahmen.clientHeight, w = +im.getAttribute("width"), h = +im.getAttribute("height");
    if (!W || !H || !w || !h) continue;
    var z = (hochkant.matches ? im.dataset.zielHoch : im.dataset.ziel).split(" "), tx = +z[0], ty;
    if (z[1] === "titel" && titel) { var blk = titel.offsetParent || titel.parentElement; ty = (blk.getBoundingClientRect().top + titel.offsetTop + titel.offsetHeight / 2 - rahmen.getBoundingClientRect().top) / H; }
    else ty = +z[1];
    var s = Math.max(W / w, H / h, (tx * W) / (px * w), ((1 - tx) * W) / ((1 - px) * w), (ty * H) / (py * h), ((1 - ty) * H) / ((1 - py) * h));
    im.style.width = w * s + "px"; im.style.height = h * s + "px"; im.style.left = tx * W - px * w * s + "px"; im.style.top = ty * H - py * h * s + "px";
    im.style.transformOrigin = px * 100 + "% " + py * 100 + "%"; im.dataset.gesetzt = "";
  }
})();
