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
    installDismissed: "njaay.installDismissed.v1"
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

  function initTabs() {
    $all(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        buzz(8);
        activateTab(btn.dataset.target);
      });
    });
    // Le bouton retour du téléphone revient à l'onglet précédent (puis à l'accueil)
    window.addEventListener("popstate", function (e) {
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

  /* ---------------- Image card (canvas) ---------------- */

  function ensureFontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('600 44px "Fraunces"'),
      document.fonts.load('italic 32px "Fraunces"'),
      document.fonts.load('500 30px "Work Sans"'),
      document.fonts.load('600 30px "Work Sans"')
    ]).catch(function () {});
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

  function drawWovenBand(ctx, x, y, w, colorA, colorB) {
    var step = 26;
    var h = 14;
    for (var i = 0; x + i * step < x + w; i++) {
      ctx.fillStyle = i % 2 === 0 ? colorA : colorB;
      ctx.beginPath();
      ctx.moveTo(x + i * step, y);
      ctx.lineTo(x + i * step + step / 2, y + h);
      ctx.lineTo(x + i * step + step, y);
      ctx.closePath();
      ctx.fill();
    }
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

  function fitCitationLayout(ctx, citation, traduction, maxTextW, maxBlockH) {
    // Try progressively smaller sizes until the wrapped text (citation +
    // optional translation) fits the available height. Guarantees no
    // overflow regardless of how long a léebu's text is.
    var sizes = [46, 42, 38, 34, 30, 27, 24, 22];
    var chosen = null;
    for (var i = 0; i < sizes.length; i++) {
      var size = sizes[i];
      var lineH = Math.round(size * 1.34);
      ctx.font = "560 " + size + "px 'Fraunces'";
      var lines = wrapText(ctx, citation, maxTextW);
      var blockH = lines.length * lineH;

      var tSize = Math.round(size * 0.65);
      var tLineH = Math.round(tSize * 1.42);
      var tLines = [];
      if (traduction) {
        ctx.font = "italic " + tSize + "px 'Fraunces'";
        tLines = wrapText(ctx, traduction, maxTextW - 40);
        blockH += 28 + tLines.length * tLineH;
      }

      if (blockH <= maxBlockH || i === sizes.length - 1) {
        chosen = {
          size: size, lineH: lineH, lines: lines,
          tSize: tSize, tLineH: tLineH, tLines: tLines,
          blockH: blockH
        };
        if (blockH <= maxBlockH) break;
      }
    }
    // last-resort truncation if even the smallest size overflows
    var maxLines = Math.max(3, Math.floor((maxBlockH - (chosen.tLines.length ? 28 + chosen.tLines.length * chosen.tLineH : 0)) / chosen.lineH));
    if (chosen.lines.length > maxLines) {
      chosen.lines = chosen.lines.slice(0, maxLines);
      var last = chosen.lines[maxLines - 1];
      chosen.lines[maxLines - 1] = last.replace(/[.,;: ]+$/, "") + "…";
    }
    return chosen;
  }

  function drawShareCard(c) {
    var canvas = $("#share-canvas");
    var W = canvas.width, H = canvas.height;
    var ctx = canvas.getContext("2d");

    var night = "#1c2b33";
    var parchment = "#f1e4c6";
    var ink = "#2a2118";
    var inkSoft = "#55483a";
    var saffron = "#e3a23c";
    var brick = "#a8442e";
    var green = "#2f5d50";

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = night;
    ctx.fillRect(0, 0, W, H);

    // subtle diagonal texture
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = parchment;
    ctx.lineWidth = 2;
    for (var d = -H; d < W; d += 40) {
      ctx.beginPath();
      ctx.moveTo(d, 0);
      ctx.lineTo(d + H, H);
      ctx.stroke();
    }
    ctx.restore();

    var cardX = 70, cardY = 230, cardW = W - 140, cardH = H - 570;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 30;
    ctx.fillStyle = parchment;
    roundRect(ctx, cardX, cardY, cardW, cardH, 40);
    ctx.fill();
    ctx.restore();

    drawWovenBand(ctx, cardX + 40, cardY + 34, cardW - 80, brick, green);

    // badge
    ctx.fillStyle = "rgba(47,93,80,0.12)";
    roundRect(ctx, cardX + 40, cardY + 76, 300, 46, 23);
    ctx.fill();
    ctx.fillStyle = green;
    ctx.font = "600 22px 'Work Sans'";
    ctx.textBaseline = "middle";
    ctx.fillText("✦ Citation du jour", cardX + 62, cardY + 100);

    // citation text — sized to always fit within the card, then centered
    // vertically in the space below the badge so short léebu don't leave
    // an awkward empty gap and long ones never overflow.
    var maxTextW = cardW - 110;
    var contentTop = cardY + 150;
    var contentBottom = cardY + cardH - 90;
    var maxBlockH = contentBottom - contentTop;
    var layout = fitCitationLayout(ctx, c.citation, c.traduction, maxTextW, maxBlockH);

    ctx.fillStyle = ink;
    ctx.font = "560 " + layout.size + "px 'Fraunces'";
    ctx.textBaseline = "alphabetic";
    var verticalGap = Math.max(0, (maxBlockH - layout.blockH) / 2);
    var ty = contentTop + verticalGap + layout.size * 0.78;
    layout.lines.forEach(function (line) {
      ctx.fillText(line, cardX + 55, ty);
      ty += layout.lineH;
    });

    if (c.traduction && layout.tLines.length) {
      ty += 18;
      var quoteTop = ty - layout.tSize;
      var quoteBottom = ty + (layout.tLines.length - 1) * layout.tLineH + 8;
      ctx.strokeStyle = saffron;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cardX + 55, quoteTop);
      ctx.lineTo(cardX + 55, quoteBottom);
      ctx.stroke();

      ctx.fillStyle = inkSoft;
      ctx.font = "italic " + layout.tSize + "px 'Fraunces'";
      layout.tLines.forEach(function (line) {
        ctx.fillText(line, cardX + 80, ty);
        ty += layout.tLineH;
      });
    }

    drawWovenBand(ctx, cardX + 40, cardY + cardH - 48, cardW - 80, green, brick);

    // footer branding
    var fy = cardY + cardH + 70;
    // baobab mark
    ctx.save();
    ctx.translate(cardX + 10, fy - 22);
    ctx.fillStyle = saffron;
    roundRect(ctx, 0, 0, 12, 30, 4);
    ctx.fill();
    ctx.fillStyle = parchment;
    ctx.beginPath();
    ctx.arc(6, -10, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = parchment;
    ctx.font = "600 34px 'Fraunces'";
    ctx.fillText("Wolof Njaay Neena", cardX + 46, fy);
    ctx.fillStyle = "rgba(241,228,198,0.6)";
    ctx.font = "500 24px 'Work Sans'";
    ctx.fillText("Léebu — sagesse wolof du Sénégal", cardX + 46, fy + 34);

    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve(blob); }, "image/png", 0.95);
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

  function generateAndShareImage() {
    if (!state.current) return;
    showToast("Préparation de l'image…");
    ensureFontsReady().then(function () {
      var canvas = drawShareCard(state.current);
      return canvasToBlob(canvas);
    }).then(function (blob) {
      var filename = "wolof-njaay-neena-leebu-" + state.current.id + ".png";
      var file;
      try { file = new File([blob], filename, { type: "image/png" }); } catch (e) { file = null; }

      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: "Wolof Njaay Neena",
          text: "Léebu du jour, à partager en statut ou sur vos réseaux."
        }).catch(function () {
          downloadBlob(blob, filename);
          showToast("Image téléchargée");
        });
      } else {
        downloadBlob(blob, filename);
        showToast("Image téléchargée — prête pour vos statuts");
      }
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

  /* ---------------- Wire up ---------------- */

  function initEvents() {
    $("#btn-new").addEventListener("click", function () {
      buzz(10);
      var c = pickRandomUnseen();
      setCurrent(c);
    });
    $("#btn-copy").addEventListener("click", copyCurrent);
    $("#btn-share").addEventListener("click", shareTextCurrent);
    $("#btn-image").addEventListener("click", generateAndShareImage);
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
    initInstallBanner();
    loadData().then(function () {
      initHomeCitation();
      runSearch("");
    }).catch(function (err) {
      $("#citation-text").textContent = "Impossible de charger les léebu pour le moment.";
      console.error(err);
    });
    registerServiceWorker();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
