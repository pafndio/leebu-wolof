/* ========================================================================
   Wolof Njaay Neena — logique de l'application
   Application 100% statique : aucune donnée personnelle ne quitte l'appareil.
   ======================================================================== */

(function () {
  "use strict";

  var STORAGE = {
    seen: "njaay.seen.v1",
    favs: "njaay.favs.v1",
    lastDate: "njaay.lastDate.v1",
    lastId: "njaay.lastId.v1",
    installDismissed: "njaay.installDismissed.v1",
    format: "njaay.format.v1"
  };

  var state = {
    citations: [],
    byId: {},
    current: null,
    seen: new Set(),
    favs: new Set(),
    explorerBatch: 60,
    explorerShown: 0,
    explorerFiltered: []
  };

  /* ---------------- Utilities ---------------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function loadSet(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return new Set();
      return new Set(JSON.parse(raw));
    } catch (e) { return new Set(); }
  }
  function saveSet(key, set) {
    try { localStorage.setItem(key, JSON.stringify(Array.from(set))); } catch (e) {}
  }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function hashString(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function normalize(str) {
    return (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  var toastTimer = null;
  function showToast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 2200);
  }

  /* ---------------- Data loading ---------------- */

  function loadData() {
    return fetch("data/citations.json", { cache: "force-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        state.citations = data;
        data.forEach(function (c) { state.byId[c.id] = c; });
      });
  }

  /* ---------------- Citation du jour / navigation ---------------- */

  function pickTodaysCitation() {
    var idx = hashString(todayKey()) % state.citations.length;
    return state.citations[idx];
  }

  function pickRandomUnseen() {
    var unseen = state.citations.filter(function (c) { return !state.seen.has(c.id); });
    if (unseen.length === 0) {
      state.seen.clear();
      saveSet(STORAGE.seen, state.seen);
      unseen = state.citations;
      showToast("Vous avez lu tous les léebu — le parcours recommence !");
    }
    return unseen[Math.floor(Math.random() * unseen.length)];
  }

  function markSeen(citation) {
    state.seen.add(citation.id);
    saveSet(STORAGE.seen, state.seen);
  }

  function setCurrent(citation, opts) {
    opts = opts || {};
    state.current = citation;
    markSeen(citation);
    try {
      localStorage.setItem(STORAGE.lastDate, todayKey());
      localStorage.setItem(STORAGE.lastId, String(citation.id));
    } catch (e) {}
    renderCurrent();
    updateStats();
  }

  function renderCurrent() {
    var c = state.current;
    if (!c) return;
    var textEl = $("#citation-text");
    var tradEl = $("#citation-translation");
    var hintEl = $("#citation-empty-hint");
    var refEl = $("#citation-ref");

    textEl.textContent = c.citation;
    if (c.traduction) {
      tradEl.textContent = c.traduction;
      tradEl.hidden = false;
      hintEl.hidden = true;
    } else {
      tradEl.hidden = true;
      hintEl.hidden = false;
    }
    refEl.textContent = "Léebu n°" + c.id.replace(/^\D+/, "").replace(/\D+$/, "");

    var favBtn = $("#btn-fav");
    var isFav = state.favs.has(c.id);
    favBtn.classList.toggle("is-active", isFav);
    favBtn.setAttribute("aria-pressed", String(isFav));
  }

  function updateStats() {
    var total = state.citations.length;
    var seen = state.seen.size;
    $("#stat-seen").textContent = seen;
    $("#stat-left").textContent = Math.max(total - seen, 0);
    $("#stat-total").textContent = total;
  }

  function initHomeCitation() {
    var lastDate = localStorage.getItem(STORAGE.lastDate);
    var lastId = localStorage.getItem(STORAGE.lastId);
    if (lastDate === todayKey() && lastId && state.byId[lastId]) {
      state.current = state.byId[lastId];
      markSeen(state.current);
    } else {
      state.current = pickTodaysCitation();
      markSeen(state.current);
      try {
        localStorage.setItem(STORAGE.lastDate, todayKey());
        localStorage.setItem(STORAGE.lastId, String(state.current.id));
      } catch (e) {}
    }
    renderCurrent();
    updateStats();
  }

  /* ---------------- Favorites ---------------- */

  function toggleFav(id) {
    if (state.favs.has(id)) {
      state.favs.delete(id);
    } else {
      state.favs.add(id);
    }
    saveSet(STORAGE.favs, state.favs);
  }

  function renderFavoris() {
    var list = $("#favoris-list");
    var empty = $("#favoris-empty");
    var ids = Array.from(state.favs);
    list.innerHTML = "";
    if (ids.length === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    ids.reverse().forEach(function (id) {
      var c = state.byId[id];
      if (c) list.appendChild(buildListItem(c));
    });
  }

  /* ---------------- Explorer / search ---------------- */

  function buildListItem(c) {
    var wrap = document.createElement("div");
    wrap.className = "list-item";

    var textWrap = document.createElement("div");
    textWrap.className = "li-text";
    var p1 = document.createElement("p");
    p1.className = "li-citation";
    p1.textContent = c.citation;
    textWrap.appendChild(p1);
    if (c.traduction) {
      var p2 = document.createElement("p");
      p2.className = "li-trad";
      p2.textContent = c.traduction;
      textWrap.appendChild(p2);
    }
    wrap.appendChild(textWrap);

    var favBtn = document.createElement("button");
    favBtn.className = "fav-toggle" + (state.favs.has(c.id) ? " is-active" : "");
    favBtn.setAttribute("aria-label", "Basculer favori");
    favBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
    favBtn.addEventListener("click", function () {
      toggleFav(c.id);
      favBtn.classList.toggle("is-active");
      if (state.current && state.current.id === c.id) renderCurrent();
      if ($("#view-favoris").classList.contains("is-active")) renderFavoris();
    });
    wrap.appendChild(favBtn);

    return wrap;
  }

  function runSearch(query) {
    var q = normalize(query.trim());
    if (!q) {
      state.explorerFiltered = state.citations;
    } else {
      state.explorerFiltered = state.citations.filter(function (c) {
        return normalize(c.citation).indexOf(q) !== -1 ||
               normalize(c.traduction).indexOf(q) !== -1;
      });
    }
    state.explorerShown = 0;
    renderExplorerCount();
    renderExplorerBatch(true);
  }

  function renderExplorerCount() {
    var n = state.explorerFiltered.length;
    $("#results-count").textContent = n + (n > 1 ? " léebu trouvés" : " léebu trouvé");
    $("#empty-state").hidden = n !== 0;
  }

  function renderExplorerBatch(reset) {
    var list = $("#results-list");
    if (reset) list.innerHTML = "";
    var start = state.explorerShown;
    var end = Math.min(start + state.explorerBatch, state.explorerFiltered.length);
    var frag = document.createDocumentFragment();
    for (var i = start; i < end; i++) {
      frag.appendChild(buildListItem(state.explorerFiltered[i]));
    }
    list.appendChild(frag);
    state.explorerShown = end;
    $("#btn-load-more").hidden = state.explorerShown >= state.explorerFiltered.length;
  }

  /* ---------------- Tabs ---------------- */

  var TABS = ["accueil", "explorer", "favoris", "apropos"];

  function activateTab(name, opts) {
    opts = opts || {};
    if (TABS.indexOf(name) === -1) name = "accueil";
    $all(".view").forEach(function (v) {
      v.classList.toggle("is-active", v.dataset.view === name);
    });
    $all(".tab-btn").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.target === name);
    });
    if (name === "favoris") renderFavoris();
    window.scrollTo(0, 0);
    if (!opts.fromHistory) {
      try {
        if (name === "accueil") history.replaceState({ tab: name }, "", "#accueil");
        else history.pushState({ tab: name }, "", "#" + name);
      } catch (e) {}
    }
  }

  function currentTab() {
    var v = $(".view.is-active");
    return v ? v.dataset.view : "accueil";
  }

  function initTabs() {
    $all(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        buzz(8);
        activateTab(btn.dataset.target);
      });
    });
    // Le bouton retour du téléphone revient à l'onglet précédent (puis à l'accueil)
    window.addEventListener("popstate", function (e) {
      if (imgState.open) { closeImageSheet(true); return; }
      var tab = (e.state && e.state.tab) || (location.hash || "").replace("#", "") || "accueil";
      activateTab(tab, { fromHistory: true });
    });
    var start = (location.hash || "").replace("#", "");
    try { history.replaceState({ tab: "accueil" }, "", "#accueil"); } catch (e) {}
    if (TABS.indexOf(start) > 0) activateTab(start);
  }

  /* ---------------- Retour haptique ---------------- */

  function buzz(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  }

  /* ---------------- Balayage sur la carte du jour ---------------- */

  function initSwipe() {
    var card = $(".citation-card");
    var startX = 0, startY = 0, dx = 0, tracking = false, locked = false;

    card.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dx = 0; tracking = true; locked = false;
      card.style.transition = "none";
    }, { passive: true });

    card.addEventListener("touchmove", function (e) {
      if (!tracking) return;
      var mx = e.touches[0].clientX - startX;
      var my = e.touches[0].clientY - startY;
      if (!locked && Math.abs(my) > Math.abs(mx) && Math.abs(my) > 8) { tracking = false; return; }
      if (Math.abs(mx) > 8) locked = true;
      dx = mx;
      if (locked) card.style.transform = "translateX(" + dx + "px) rotate(" + (dx / 40) + "deg)";
    }, { passive: true });

    card.addEventListener("touchend", function () {
      if (!tracking) { card.style.transition = ""; card.style.transform = ""; return; }
      tracking = false;
      card.style.transition = "";
      if (Math.abs(dx) > 90) {
        var dir = dx < 0 ? -1 : 1;
        card.style.transform = "translateX(" + dir * 420 + "px) rotate(" + dir * 10 + "deg)";
        card.classList.add("is-swiping-out");
        buzz(12);
        setTimeout(function () {
          setCurrent(pickRandomUnseen());
          card.style.transition = "none";
          card.style.transform = "translateX(" + (-dir * 60) + "px)";
          void card.offsetWidth;
          card.style.transition = "";
          card.style.transform = "";
          card.classList.remove("is-swiping-out");
        }, 190);
      } else {
        card.style.transform = "";
      }
    });
  }

  /* ---------------- Clipboard / share (text) ---------------- */

  function citationText(c, withSignature) {
    var parts = [c.citation];
    if (c.traduction) parts.push("« " + c.traduction + " »");
    if (withSignature) parts.push("— Wolof Njaay Neena");
    return parts.join("\n\n");
  }

  function copyCurrent() {
    var text = citationText(state.current, false);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast("Léebu copié dans le presse-papier");
      }, function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); showToast("Léebu copié dans le presse-papier"); }
    catch (e) { showToast("Impossible de copier automatiquement"); }
    document.body.removeChild(ta);
  }

  function shareTextCurrent() {
    var text = citationText(state.current, true);
    if (navigator.share) {
      navigator.share({ title: "Wolof Njaay Neena", text: text, url: location.href })
        .catch(function () { /* annulé par l'utilisateur, rien à faire */ });
    } else {
      copyCurrent();
      showToast("Partage non supporté ici — léebu copié, collez-le où vous voulez");
    }
  }

  function shareAppLink() {
    var text = "Wolof Njaay Neena — une sagesse wolof chaque jour.";
    if (navigator.share) {
      navigator.share({ title: "Wolof Njaay Neena", text: text, url: location.href })
        .catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(location.href);
      showToast("Lien copié dans le presse-papier");
    }
  }

  /* ---------------- Image à partager : cadre kente ---------------- */
  // Cadre repris de la carte d'origine du projet : bandes de tissu kente en haut
  // et en bas, bordures dégradées rouge / orange / vert, centre blanc très lisible.

  var FORMATS = {
    statut:   { w: 1080, h: 1920, label: "Statut",   ratio: "9:16", hint: "Pour un statut WhatsApp, une story Instagram ou Facebook, TikTok." },
    portrait: { w: 1080, h: 1350, label: "Portrait", ratio: "4:5",  hint: "Pour une publication Instagram ou Facebook." },
    carre:    { w: 1080, h: 1080, label: "Carré",    ratio: "1:1",  hint: "Pour un message, une publication ou un post X." }
  };

  var KENTE = {
    red: "#c7102e", orange: "#f7941d", green: "#00a650", edge: "#2b2b2b",
    ink: "#1f1f1f", soft: "#4a4a4a", faint: "#6b6b6b"
  };

  var imgState = { format: "statut", blob: null, url: null, token: 0, band: null, open: false };

  function pf(weight, size) {
    return weight + " " + Math.round(size) + "px Poppins, 'Segoe UI', Arial, sans-serif";
  }

  function ensureAssetsReady() {
    var fonts = (document.fonts && document.fonts.load)
      ? Promise.all(["500 30px Poppins", "600 30px Poppins", "700 30px Poppins"].map(function (f) {
          return document.fonts.load(f);
        })).catch(function () {})
      : Promise.resolve();
    var band = imgState.band ? Promise.resolve() : new Promise(function (resolve) {
      var im = new Image();
      im.onload = function () { imgState.band = im; resolve(); };
      im.onerror = function () { resolve(); };
      im.src = "assets/kente-band.jpg";
    });
    return Promise.all([fonts, band]);
  }

  function wrapText(ctx, text, maxWidth) {
    var words = text.split(/\s+/);
    var lines = [];
    var line = "";
    words.forEach(function (w) {
      var test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function clipLines(lines, n) {
    if (lines.length <= n) return lines;
    var cut = lines.slice(0, n);
    cut[n - 1] = cut[n - 1].replace(/[.,;: ]+$/, "") + "…";
    return cut;
  }

  // Cherche la plus grande taille de texte qui tient dans la zone disponible.
  function fitBlock(ctx, c, maxW, maxH, W) {
    var gap = Math.round(W * 0.045);
    var min = Math.round(W * 0.032);
    var best = null;
    for (var size = Math.round(W * 0.115); size >= min; size -= 2) {
      var lh = Math.round(size * 1.27);
      ctx.font = pf(600, size);
      var lines = wrapText(ctx, c.citation, maxW);
      var h = lines.length * lh;
      var t = null;
      if (c.traduction) {
        var ts = Math.max(Math.round(size * 0.58), Math.round(W * 0.03));
        var tlh = Math.round(ts * 1.4);
        ctx.font = pf(500, ts);
        t = { size: ts, lh: tlh, lines: wrapText(ctx, c.traduction, maxW) };
        h += gap + t.lines.length * tlh;
      }
      best = { size: size, lh: lh, lines: lines, t: t, h: h, gap: gap };
      if (h <= maxH) return best;
    }
    // Même à la taille minimale, ça déborde : on coupe proprement avec « … »
    if (best.t && best.t.lines.length > 3) {
      best.t.lines = clipLines(best.t.lines, 3);
    }
    var tH = best.t ? best.gap + best.t.lines.length * best.t.lh : 0;
    var maxLines = Math.max(2, Math.floor((maxH - tH) / best.lh));
    best.lines = clipLines(best.lines, maxLines);
    best.h = best.lines.length * best.lh + tH;
    return best;
  }

  function dateLabel() {
    var s = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
    return s.replace(/(^|\s)(\S)/g, function (m, a, b) { return a + b.toUpperCase(); });
  }

  function drawShareImage(c, fmtKey) {
    var f = FORMATS[fmtKey];
    var W = f.w, H = f.h;
    var canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext("2d");

    // ----- géométrie du cadre (proportions de la carte d'origine)
    var sw = Math.round(W * 0.062);                       // largeur des bordures latérales
    var innerW = W - 2 * sw;
    var lineTop = Math.round(innerW * 0.0057);
    var lineBot = Math.round(innerW * 0.0086);
    var kh = Math.round(innerW * 141 / 1400);             // hauteur de la bande kente
    var bh = lineTop + kh + lineBot;                      // hauteur totale d'une bande

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // ----- bandes kente haut et bas
    [0, H - bh].forEach(function (y) {
      ctx.fillStyle = KENTE.red;
      ctx.fillRect(sw, y, innerW, bh);
      if (imgState.band) {
        ctx.drawImage(imgState.band, sw, y + lineTop, innerW, kh);
      } else {
        ctx.fillStyle = KENTE.orange;
        ctx.fillRect(sw, y + lineTop, innerW, kh);
      }
    });

    // ----- bordures latérales dégradées
    function side(x, a, b, c3) {
      var g = ctx.createLinearGradient(0, bh, 0, H - bh);
      g.addColorStop(0, a); g.addColorStop(0.5, b); g.addColorStop(1, c3);
      ctx.fillStyle = g;
      ctx.fillRect(x, bh, sw, H - 2 * bh);
      ctx.strokeStyle = KENTE.edge;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, bh + 1.5, sw - 3, H - 2 * bh - 3);
    }
    side(0, KENTE.red, KENTE.orange, KENTE.green);
    side(W - sw, KENTE.green, KENTE.orange, KENTE.red);

    // ----- coins de couleur
    [[0, 0, KENTE.red], [W - sw, 0, KENTE.orange], [0, H - bh, KENTE.green], [W - sw, H - bh, KENTE.red]]
      .forEach(function (k) { ctx.fillStyle = k[2]; ctx.fillRect(k[0], k[1], sw, bh); });

    // ----- contenu
    var cx = W / 2;
    var padX = Math.round(W * 0.07);
    var maxW = innerW - 2 * padX;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    var y = bh + Math.round(W * 0.05);
    var titleSize = Math.round(W * 0.058);
    ctx.fillStyle = KENTE.red;
    ctx.font = pf(700, titleSize);
    y += titleSize;
    ctx.fillText("Wolof Njaay Neena", cx, y);

    var dateSize = Math.round(W * 0.037);
    var dateText = "tay " + dateLabel();
    ctx.font = pf(500, dateSize);
    while (ctx.measureText(dateText).width > maxW && dateSize > 20) { dateSize -= 1; ctx.font = pf(500, dateSize); }
    ctx.fillStyle = KENTE.soft;
    y += Math.round(dateSize * 1.55);
    ctx.fillText(dateText, cx, y);

    y += Math.round(W * 0.03);
    var barW = Math.round(W * 0.25), barH = Math.max(6, Math.round(W * 0.0075));
    ctx.fillStyle = KENTE.orange;
    roundRect(ctx, cx - barW / 2, y, barW, barH, barH / 2);
    ctx.fill();
    var headerBottom = y + barH;

    // ----- pied de carte
    var footSize = Math.round(W * 0.032);
    var footBase = H - bh - Math.round(W * 0.045);
    var id = String(c.id).replace(/^\D+/, "").replace(/\D+$/, "");
    ctx.fillStyle = KENTE.faint;
    ctx.font = pf(500, footSize);
    ctx.fillText("Léebu n°" + id, cx, footBase);

    // ----- citation, la plus grande possible, centrée dans l'espace restant
    var bodyTop = headerBottom + Math.round(W * 0.05);
    var bodyBottom = footBase - footSize - Math.round(W * 0.04);
    var maxH = bodyBottom - bodyTop;
    var L = fitBlock(ctx, c, maxW, maxH, W);
    var cy = bodyTop + Math.max(0, (maxH - L.h) / 2);

    ctx.fillStyle = KENTE.ink;
    ctx.font = pf(600, L.size);
    L.lines.forEach(function (line, i) {
      ctx.fillText(line, cx, cy + i * L.lh + (L.lh - L.size) / 2 + L.size * 0.82);
    });

    if (L.t) {
      var ty = cy + L.lines.length * L.lh;
      var sb = Math.max(5, Math.round(W * 0.006));
      ctx.fillStyle = KENTE.orange;
      roundRect(ctx, cx - W * 0.045, ty + L.gap * 0.42, W * 0.09, sb, sb / 2);
      ctx.fill();
      ctx.fillStyle = KENTE.soft;
      ctx.font = pf(500, L.t.size);
      L.t.lines.forEach(function (line, i) {
        ctx.fillText(line, cx, ty + L.gap + i * L.t.lh + (L.t.lh - L.t.size) / 2 + L.t.size * 0.82);
      });
    }
    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve(blob); }, "image/png");
    });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function imageFilename() {
    return "wolof-njaay-neena-leebu-" + state.current.id + "-" + imgState.format + ".png";
  }

  function renderImagePreview() {
    var token = ++imgState.token;
    var f = FORMATS[imgState.format];
    var wrap = $("#img-preview-wrap");
    wrap.classList.add("is-loading");
    $("#fmt-hint").textContent = f.hint;
    $all(".fmt-chip").forEach(function (chip) {
      var on = chip.dataset.fmt === imgState.format;
      chip.classList.toggle("is-active", on);
      chip.setAttribute("aria-checked", String(on));
    });
    return ensureAssetsReady().then(function () {
      if (token !== imgState.token) return;
      return canvasToBlob(drawShareImage(state.current, imgState.format)).then(function (blob) {
        if (token !== imgState.token) return;
        if (imgState.url) URL.revokeObjectURL(imgState.url);
        imgState.blob = blob;
        imgState.url = URL.createObjectURL(blob);
        $("#img-preview").src = imgState.url;
        wrap.classList.remove("is-loading");
      });
    });
  }

  function openImageSheet() {
    if (!state.current) return;
    imgState.open = true;
    $("#img-sheet").hidden = false;
    document.body.classList.add("sheet-open");
    try { history.pushState({ tab: currentTab(), sheet: true }, "", location.hash || "#accueil"); } catch (e) {}
    renderImagePreview();
    $("#img-close").focus();
  }

  function closeImageSheet(fromHistory) {
    if (!imgState.open) return;
    imgState.open = false;
    $("#img-sheet").hidden = true;
    document.body.classList.remove("sheet-open");
    if (!fromHistory) {
      try { if (history.state && history.state.sheet) history.back(); } catch (e) {}
    }
  }

  function shareImage() {
    if (!imgState.blob) return;
    var name = imageFilename();
    var blob = imgState.blob;
    var file;
    try { file = new File([blob], name, { type: "image/png" }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: "Wolof Njaay Neena" }).catch(function (err) {
        if (err && err.name === "AbortError") return;
        downloadBlob(blob, name);
        showToast("Partage impossible — image enregistrée");
      });
    } else {
      downloadBlob(blob, name);
      showToast("Image enregistrée — prête pour votre statut");
    }
  }

  function saveImage() {
    if (!imgState.blob) return;
    downloadBlob(imgState.blob, imageFilename());
    showToast("Image enregistrée");
  }

  function initImageSheet() {
    try {
      var saved = localStorage.getItem(STORAGE.format);
      if (saved && FORMATS[saved]) imgState.format = saved;
    } catch (e) {}
    $("#btn-image").addEventListener("click", openImageSheet);
    $("#img-close").addEventListener("click", function () { closeImageSheet(false); });
    $("#img-sheet").addEventListener("click", function (e) { if (e.target === this) closeImageSheet(false); });
    $("#img-share").addEventListener("click", shareImage);
    $("#img-save").addEventListener("click", saveImage);
    $all(".fmt-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        imgState.format = chip.dataset.fmt;
        try { localStorage.setItem(STORAGE.format, imgState.format); } catch (e) {}
        renderImagePreview();
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && imgState.open) closeImageSheet(false);
    });
  }

  /* ---------------- Install prompt (PWA) ---------------- */

  var deferredInstallPrompt = null;

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
           (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function initInstallBanner() {
    var banner = $("#install-banner");
    var guide = $("#ios-guide");
    var dismissed = null;
    try { dismissed = localStorage.getItem(STORAGE.installDismissed); } catch (e) {}

    if (isStandalone()) return; // déjà installée : rien à proposer

    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (!dismissed) banner.classList.add("is-visible");
    });

    // Safari iPhone n'a pas d'invite automatique : on affiche un guide pas à pas
    if (isIOS() && !dismissed) banner.classList.add("is-visible");

    window.addEventListener("appinstalled", function () {
      banner.classList.remove("is-visible");
      deferredInstallPrompt = null;
      showToast("Wolof Njaay Neena est installée sur votre écran d'accueil");
    });

    $("#install-cta").addEventListener("click", function () {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.finally(function () {
          banner.classList.remove("is-visible");
          deferredInstallPrompt = null;
        });
      } else if (isIOS()) {
        guide.classList.add("is-visible");
      } else {
        showToast("Menu du navigateur ⋮ puis « Ajouter à l'écran d'accueil »");
      }
    });

    $("#ios-guide-close").addEventListener("click", function () { guide.classList.remove("is-visible"); });
    guide.addEventListener("click", function (e) { if (e.target === guide) guide.classList.remove("is-visible"); });

    $("#install-dismiss").addEventListener("click", function () {
      banner.classList.remove("is-visible");
      try { localStorage.setItem(STORAGE.installDismissed, "1"); } catch (e) {}
    });
  }

  /* ---------------- Notification quotidienne (OneSignal) ---------------- */

  var push = { os: null, failed: false, busy: false, queued: false };

  function pushAppId() {
    var c = window.APP_CONFIG || {};
    return String(c.oneSignalAppId || "").trim();
  }

  function renderNotif() {
    var card = $("#notif-card");
    var txt = $("#notif-text");
    var btn = $("#notif-btn");
    if (!pushAppId()) { card.hidden = true; return; }
    card.hidden = false;
    btn.hidden = false;
    btn.disabled = false;
    btn.classList.remove("is-ghost");
    btn.dataset.action = "";

    if (isIOS() && !isStandalone()) {
      txt.textContent = "Sur iPhone, installez d'abord l'application sur l'écran d'accueil, puis rouvrez-la pour activer les notifications.";
      btn.textContent = "Voir comment installer";
      btn.dataset.action = "ios-guide";
      return;
    }
    if (push.failed) {
      txt.textContent = "Le service de notifications est injoignable. Vérifiez votre connexion.";
      btn.textContent = "Réessayer";
      btn.dataset.action = "retry";
      return;
    }
    if (!push.os) {
      txt.textContent = "Chargement…";
      btn.textContent = "Activer à 9h";
      btn.disabled = true;
      return;
    }
    if (!push.os.Notifications.isPushSupported()) {
      txt.textContent = "Ce navigateur ne gère pas les notifications. Essayez avec Chrome sur Android.";
      btn.hidden = true;
      return;
    }
    var perm = window.Notification ? Notification.permission : "default";
    if (perm === "denied") {
      txt.textContent = "Les notifications sont bloquées. Autorisez-les dans les réglages du navigateur pour ce site, puis revenez ici.";
      btn.hidden = true;
      return;
    }
    if (perm === "granted" && push.os.User.PushSubscription.optedIn) {
      txt.textContent = "Actives : vous recevrez un léebu chaque jour à 9h (heure de Dakar), prêt à partager.";
      btn.textContent = "Désactiver";
      btn.classList.add("is-ghost");
      btn.dataset.action = "off";
      return;
    }
    txt.textContent = "Recevez chaque matin le léebu du jour, prêt à partager en statut ou sur vos réseaux.";
    btn.textContent = "Activer à 9h";
    btn.dataset.action = "on";
  }

  function loadPushSdk() {
    var appId = pushAppId();
    if (!appId) return;
    push.failed = false;
    renderNotif();

    // Le site peut être servi dans un sous-dossier (GitHub Pages : /nom-du-depot/)
    var base = new URL("./", location.href).pathname;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    if (!push.queued) {
      push.queued = true;
      window.OneSignalDeferred.push(function (OneSignal) {
        return OneSignal.init({
          appId: appId,
          serviceWorkerPath: base.replace(/^\//, "") + "push/onesignal/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: base + "push/onesignal/" },
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: true
        }).then(function () {
          push.os = OneSignal;
          OneSignal.Notifications.addEventListener("permissionChange", renderNotif);
          OneSignal.User.PushSubscription.addEventListener("change", renderNotif);
          renderNotif();
        }).catch(function () {
          push.failed = true;
          renderNotif();
        });
      });
    }

    var old = document.getElementById("onesignal-sdk");
    if (old) old.remove();
    var sc = document.createElement("script");
    sc.id = "onesignal-sdk";
    sc.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    sc.defer = true;
    sc.onerror = function () { push.failed = true; renderNotif(); };
    document.head.appendChild(sc);
  }

  function onNotifClick() {
    var btn = $("#notif-btn");
    var action = btn.dataset.action;
    if (push.busy) return;
    if (action === "ios-guide") { $("#ios-guide").classList.add("is-visible"); return; }
    if (action === "retry") { loadPushSdk(); return; }
    if (!push.os) return;

    push.busy = true;
    btn.disabled = true;
    var job;
    if (action === "on") {
      // La demande d'autorisation doit partir directement du toucher de l'utilisateur
      var ask = (window.Notification && Notification.permission === "granted")
        ? Promise.resolve()
        : Promise.resolve(push.os.Notifications.requestPermission());
      job = ask.then(function () {
        if (window.Notification && Notification.permission === "granted") {
          return Promise.resolve(push.os.User.PushSubscription.optIn()).then(function () {
            buzz(12);
            showToast("Notifications activées : rendez-vous demain à 9h");
          });
        }
        showToast("Autorisation non accordée");
      });
    } else if (action === "off") {
      job = Promise.resolve(push.os.User.PushSubscription.optOut()).then(function () {
        showToast("Notifications désactivées");
      });
    } else {
      job = Promise.resolve();
    }
    job.catch(function () { showToast("Une erreur est survenue, réessayez"); })
       .then(function () { push.busy = false; renderNotif(); });
  }

  function initPush() {
    $("#notif-btn").addEventListener("click", onNotifClick);
    if (!pushAppId()) { renderNotif(); return; }
    renderNotif();
    if (isIOS() && !isStandalone()) return; // rien à charger tant que l'app n'est pas installée
    loadPushSdk();
  }

  /* ---------------- Wire up ---------------- */

  function initEvents() {
    $("#btn-new").addEventListener("click", function () {
      buzz(10);
      var c = pickRandomUnseen();
      setCurrent(c);
    });
    $("#btn-copy").addEventListener("click", copyCurrent);
    $("#btn-share").addEventListener("click", shareTextCurrent);
    $("#btn-share-app").addEventListener("click", shareAppLink);
    $("#btn-fav").addEventListener("click", function () {
      if (!state.current) return;
      toggleFav(state.current.id);
      renderCurrent();
    });
    $("#btn-reset").addEventListener("click", function () {
      if (confirm("Réinitialiser votre parcours de lecture ? Vos favoris seront conservés.")) {
        state.seen.clear();
        saveSet(STORAGE.seen, state.seen);
        updateStats();
        showToast("Parcours réinitialisé");
      }
    });

    $("#search-input").addEventListener("input", function (e) {
      runSearch(e.target.value);
    });
    $("#btn-load-more").addEventListener("click", function () {
      renderExplorerBatch(false);
    });
  }

  function renderTodayLine() {
    var d = new Date();
    var fmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    var s = fmt.format(d);
    $("#today-line").innerHTML = "Aujourd'hui, <strong>" + s.charAt(0).toUpperCase() + s.slice(1) + "</strong>";
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("service-worker.js").catch(function () {});
      });
    }
  }

  function init() {
    state.seen = loadSet(STORAGE.seen);
    state.favs = loadSet(STORAGE.favs);
    renderTodayLine();
    initTabs();
    initEvents();
    initSwipe();
    initImageSheet();
    initInstallBanner();
    initPush();
    loadData().then(function () {
      initHomeCitation();
      runSearch("");
      if (/[?&]source=notification/.test(location.search)) {
        showToast("Léebu du jour : touchez Image ou Partager pour l'envoyer");
        try { history.replaceState(history.state, "", location.pathname + location.hash); } catch (e) {}
      }
    }).catch(function (err) {
      $("#citation-text").textContent = "Impossible de charger les léebu pour le moment.";
      console.error(err);
    });
    registerServiceWorker();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
