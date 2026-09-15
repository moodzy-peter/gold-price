/* ==========================================================================
   TAMAYA GOLD — Gold Price Service
   Single source of truth for the Logam Mulia REFERENCE (wholesale) price per
   gram. This module only tracks that raw number — TAMAYA's margin is
   applied on top of it in js/products.js (getSellingPrice).

   IMPORTANT: the raw reference price from this module (state.pricePerGram /
   getState()) must NEVER be rendered directly in the UI. TAMAYA GOLD is a
   reseller; if the raw wholesale price were ever shown next to a marked-up
   product price, a customer could just divide the two and read off the
   exact margin. mountWidget() below and calculator.js both call through
   TamayaProducts.getSellingPrice(1) instead, which already has the margin
   baked in, and that's the only number that reaches the page. Tries
   official sources first, is honest with the UI about whether that
   succeeded (LIVE) or not (FALLBACK), and never pretends to be live when it
   isn't.

   Real browsers cannot safely read hartadinataabadi.co.id / hrtagold.id
   cross-origin — verified directly, neither sends Access-Control-Allow-
   Origin, so a plain fetch() to either one is blocked by CORS every time.
   Instead this goes through a CORS-enabled proxy (see GOLD_PRICE_CONFIG.proxy
   below) that mirrors both sources' published prices — verified to actually
   send Access-Control-Allow-Origin: *, so it really works from the browser.

   IMPORTANT: that proxy is an unofficial, community-run project
   (github.com/iamutaki/logam-mulia-api on Cloudflare Workers), not operated
   by Hartadinata Abadi/HRTA Gold. It could change shape or go offline
   without notice — that's exactly the kind of failure fetchHartadinataPrice()
   /fetchHrtaGoldPrice() already catch and fall back from cleanly. Swap
   proxy.baseUrl for a first-party API or your own serverless proxy the
   moment one exists; everything downstream (products, cart, calculator,
   chart) already reacts to onPriceChange() and needs no changes.
   ========================================================================== */

(function (global) {
  "use strict";

  var GOLD_PRICE_CONFIG = {
    fallbackPricePerGram: 2439000,
    // The actual supplier homepages. NOT linked or named anywhere in the UI
    // on purpose — TAMAYA GOLD is a reseller, so customers are never handed
    // a direct path to buy from the supplier instead. Kept here only so the
    // proxy fetch functions below have something to attribute internally.
    officialSources: {
      primary: "https://hartadinataabadi.co.id/",
      secondary: "https://hrtagold.id/id/gold-price",
    },
    // Unofficial CORS-enabled proxy actually used for the live fetch (see
    // the file header above). primaryPath/secondaryPath both trace back to
    // PT Hartadinata Abadi's EMASKU fine-gold price, just via two of the
    // proxy's mirrored sources.
    proxy: {
      baseUrl: "https://logam-mulia-api.iamutaki.workers.dev",
      primaryPath: "/api/prices/hartadinataabadi",
      secondaryPath: "/api/prices/emasku",
    },
    requestTimeoutMs: 8000,
    attemptLiveFetch: true,
    // How often to auto-refresh while a page is open, in ms. Kept within
    // the "no more than every 5–15 minutes" guideline — this is a third-
    // party community service, not our own infrastructure, so it shouldn't
    // be hammered. Refreshing only happens while the tab is visible.
    autoRefreshMs: 10 * 60 * 1000,
  };

  var state = {
    pricePerGram: GOLD_PRICE_CONFIG.fallbackPricePerGram,
    isLive: false,
    source: "Fallback internal",
    sourceUrl: null,
    updatedAtLabel: null, // human-readable timestamp scraped from the source (LIVE only)
    lastCheckedAt: null, // Date.now() of the last refresh attempt, live or not
  };

  function getState() {
    return {
      pricePerGram: state.pricePerGram,
      isLive: state.isLive,
      source: state.source,
      sourceUrl: state.sourceUrl,
      updatedAtLabel: state.updatedAtLabel,
      lastCheckedAt: state.lastCheckedAt,
    };
  }

  // Shared across every page on the site via localStorage — without this,
  // index.html and gold-price.html (or any two tabs) each run their own
  // independent fetch on load and can legitimately show different numbers
  // (one lands on LIVE, the other on FALLBACK from a transient hiccup, or
  // the upstream price simply ticks between the two loads). Caching the
  // resolved state means every page agrees on the same price for the
  // lifetime of CACHE_TTL_MS, and only the first page to go stale re-fetches
  // for everyone.
  var CACHE_KEY = "tamaya_gold_price_cache_v1";
  var CACHE_TTL_MS = GOLD_PRICE_CONFIG.autoRefreshMs;

  function loadCachedState() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var cached = JSON.parse(raw);
      if (!cached || typeof cached.lastCheckedAt !== "number") return null;
      if (Date.now() - cached.lastCheckedAt > CACHE_TTL_MS) return null; // stale
      return cached;
    } catch (e) {
      return null;
    }
  }

  function saveCachedState() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(getState()));
    } catch (e) {
      /* storage unavailable — each page just falls back to fetching independently */
    }
  }

  var listeners = [];
  function onPriceChange(fn) {
    listeners.push(fn);
  }
  function notify() {
    var snapshot = getState();
    listeners.forEach(function (fn) {
      try {
        fn(snapshot);
      } catch (e) {
        /* one bad listener should not break the others */
      }
    });
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error("Request timed out"));
        }, ms);
      }),
    ]);
  }

  /** "2026-09-15T03:56:12.183Z" (UTC) -> "15 September 2026, 10:56 WIB" */
  function formatWibTimestamp(isoString) {
    try {
      var d = new Date(isoString);
      if (isNaN(d.getTime())) return null;
      return (
        d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }) +
        ", " +
        d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) +
        " WIB"
      );
    } catch (e) {
      return null;
    }
  }

  /**
   * Fetches one gold-price entry from the CORS-enabled proxy (see the file
   * header) and normalizes it to {pricePerGram, updatedAtLabel, source,
   * sourceUrl}. Resolves null on any failure (network error, unexpected
   * response shape, timeout) — never throws past the caller, so
   * getOfficialGoldPrice() can fall through cleanly to the next source.
   */
  async function fetchProxyPrice(path, sourceLabel, sourceUrl) {
    try {
      var res = await withTimeout(
        fetch(GOLD_PRICE_CONFIG.proxy.baseUrl + path, { mode: "cors" }),
        GOLD_PRICE_CONFIG.requestTimeoutMs,
      );
      if (!res.ok) return null;
      var json = await res.json();
      if (!json || !json.success || !Array.isArray(json.data) || !json.data.length) return null;

      var entry = null;
      for (var i = 0; i < json.data.length; i++) {
        if (json.data[i].weight === 1) {
          entry = json.data[i];
          break;
        }
      }
      if (!entry) entry = json.data[0];
      if (!entry.weight || !entry.sellPrice) return null;

      var pricePerGram = Math.round(entry.sellPrice / entry.weight);
      if (!pricePerGram || pricePerGram < 100000) return null;

      return {
        pricePerGram: pricePerGram,
        updatedAtLabel: formatWibTimestamp(json.timestamp) || entry.recordedDate || null,
        source: sourceLabel,
        sourceUrl: sourceUrl,
      };
    } catch (err) {
      return null;
    }
  }

  /** PT Hartadinata Abadi's own EMASKU price, via the proxy's mirror of hartadinataabadi.co.id. */
  function fetchHartadinataPrice() {
    return fetchProxyPrice(
      GOLD_PRICE_CONFIG.proxy.primaryPath,
      "Hartadinata Abadi",
      GOLD_PRICE_CONFIG.officialSources.primary,
    );
  }

  /** EMASKU's own price page, via the proxy's mirror of emasku.co.id — same fine-gold reference, different channel. */
  function fetchHrtaGoldPrice() {
    return fetchProxyPrice(GOLD_PRICE_CONFIG.proxy.secondaryPath, "EMASKU", "https://www.emasku.co.id");
  }

  /** Hartadinata Abadi (primary) -> EMASKU (secondary) -> null (caller falls back). */
  async function getOfficialGoldPrice() {
    if (!GOLD_PRICE_CONFIG.attemptLiveFetch) return null;
    var primary = await fetchHartadinataPrice();
    if (primary) return primary;
    var secondary = await fetchHrtaGoldPrice();
    if (secondary) return secondary;
    return null;
  }

  var isRefreshing = false;

  /**
   * Attempts a live refresh; always resolves (never rejects) with the
   * resulting state — LIVE if an official source answered, FALLBACK
   * otherwise. Notifies every onPriceChange() listener (products.js
   * recalculates Logam Mulia prices from this, main.js re-renders the
   * cart) whether the number actually changed or not.
   */
  async function refreshGoldPrice() {
    if (isRefreshing) return getState();
    isRefreshing = true;
    try {
      var official = await getOfficialGoldPrice();
      if (official) {
        state.pricePerGram = official.pricePerGram;
        state.isLive = true;
        state.source = official.source;
        state.sourceUrl = official.sourceUrl;
        state.updatedAtLabel = official.updatedAtLabel;
      } else {
        state.pricePerGram = GOLD_PRICE_CONFIG.fallbackPricePerGram;
        state.isLive = false;
        state.source = "Fallback internal";
        state.sourceUrl = null;
        state.updatedAtLabel = null;
      }
      state.lastCheckedAt = Date.now();
      saveCachedState();
      notify();
      return getState();
    } finally {
      isRefreshing = false;
    }
  }

  var CHANGE_PCT = 0.82; // illustrative day-over-day movement for the demo chart

  var PERIODS = {
    "1H": { points: 48, spanMs: 24 * 60 * 60 * 1000, volatility: 0.0016, drift: 0.0006, label: "1 Hari" },
    "1M": { points: 42, spanMs: 30 * 24 * 60 * 60 * 1000, volatility: 0.005, drift: 0.006, label: "1 Bulan" },
    "3M": { points: 54, spanMs: 90 * 24 * 60 * 60 * 1000, volatility: 0.007, drift: 0.014, label: "3 Bulan" },
    "6M": { points: 60, spanMs: 182 * 24 * 60 * 60 * 1000, volatility: 0.009, drift: 0.03, label: "6 Bulan" },
    "1T": { points: 72, spanMs: 365 * 24 * 60 * 60 * 1000, volatility: 0.011, drift: 0.06, label: "1 Tahun" },
    "5T": { points: 90, spanMs: 5 * 365 * 24 * 60 * 60 * 1000, volatility: 0.02, drift: 0.32, label: "5 Tahun" },
  };

  function mulberry32(seed) {
    var a = seed;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedFromString(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return h;
  }

  /**
   * Demo/dummy historical series anchored to whatever endPrice the caller
   * passes in. Clearly a placeholder until a real historical-price
   * API/endpoint is wired in (see fetchHistory()).
   */
  function generateHistory(period, endPrice) {
    var cfg = PERIODS[period];
    var rand = mulberry32(seedFromString(period) + 7);
    var now = Date.now();
    var points = [];

    var price = endPrice / (1 + cfg.drift);
    var trendPerStep = (endPrice - price) / cfg.points;

    for (var i = 0; i <= cfg.points; i++) {
      var noise = (rand() - 0.5) * 2 * cfg.volatility * price;
      price = price + trendPerStep + noise;
      var t = now - cfg.spanMs + (i / cfg.points) * cfg.spanMs;
      points.push({ t: t, price: Math.max(price, 1000) });
    }
    points[points.length - 1] = { t: now, price: endPrice };
    return points;
  }

  /** Current LM reference-price snapshot (LIVE or FALLBACK — see getState() for status). */
  function fetchSnapshot() {
    return Promise.resolve({
      pricePerGram: state.pricePerGram,
      currency: "IDR",
      changePct: CHANGE_PCT,
      changeAbs: Math.round((state.pricePerGram * CHANGE_PCT) / 100),
      updatedAt: Date.now(),
    });
  }

  /**
   * Demo history for now — real historical data depends on an official
   * historical-price endpoint, which neither source exposes publicly today.
   * Swap this body for a real API call when one exists; keep the same
   * return shape (array of {t, price}) and callers need no changes.
   *
   * `endPriceOverride` lets a caller anchor the series to a different final
   * value than the raw reference price — mountWidget() uses this so the
   * customer-facing chart/headline always reflect TAMAYA's selling price
   * (reference + margin), never the raw wholesale number, so the two can't
   * be compared side by side to reverse the margin.
   */
  function fetchHistory(period, endPriceOverride) {
    var endPrice = endPriceOverride != null ? endPriceOverride : state.pricePerGram;
    return Promise.resolve(generateHistory(period, endPrice));
  }

  function formatIDR(value, decimals) {
    decimals = decimals || 0;
    try {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      })
        .format(value)
        .replace(/ /g, " "); // Intl inserts a non-breaking space after "Rp"; normalize to a regular space
    } catch (e) {
      return "Rp " + Math.round(value).toString();
    }
  }

  function formatNumber(value, decimals) {
    decimals = decimals || 0;
    return new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    }).format(value);
  }

  /* ---------------------------------------------------------------------
     Canvas chart renderer — premium fintech styling, no external library
  --------------------------------------------------------------------- */
  function GoldChart(canvas, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.options = options || {};
    this.points = [];
    this.hoverIndex = null;
    this.tooltipEl = options.tooltipEl || null;

    var self = this;
    this._onMove = function (e) {
      self._handleHover(e);
    };
    this._onLeave = function () {
      self.hoverIndex = null;
      self.draw();
      if (self.tooltipEl) self.tooltipEl.style.opacity = "0";
    };
    canvas.addEventListener("mousemove", this._onMove);
    canvas.addEventListener("mouseleave", this._onLeave);
    canvas.addEventListener(
      "touchmove",
      function (e) {
        if (e.touches && e.touches[0]) self._handleHover(e.touches[0]);
      },
      { passive: true },
    );

    window.addEventListener("resize", function () {
      self._resize();
      self.draw();
    });
  }

  GoldChart.prototype._resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(rect.width, 100) * dpr;
    this.canvas.height = Math.max(rect.height, 100) * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = rect.width;
    this.h = rect.height;
  };

  GoldChart.prototype.setData = function (points) {
    this.points = points;
    this._resize();
    this._animateIn();
  };

  GoldChart.prototype._animateIn = function () {
    var self = this;
    var start = null;
    var duration = 900;
    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      self.draw(eased);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };

  GoldChart.prototype._handleHover = function (e) {
    if (!this.points.length) return;
    var rect = this.canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var idx = Math.round((x / rect.width) * (this.points.length - 1));
    idx = Math.max(0, Math.min(this.points.length - 1, idx));
    this.hoverIndex = idx;
    this.draw();

    if (this.tooltipEl) {
      var pt = this.points[idx];
      var xPct = (idx / (this.points.length - 1)) * 100;
      this.tooltipEl.style.opacity = "1";
      this.tooltipEl.style.left = xPct + "%";
      var date = new Date(pt.t);
      this.tooltipEl.innerHTML =
        '<div style="font-weight:700;color:#f4e3a8">' +
        formatIDR(pt.price) +
        '</div><div style="color:rgba(246,241,230,0.6);font-size:11px">' +
        date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
        "</div>";
    }
  };

  GoldChart.prototype.draw = function (revealProgress) {
    if (!this.w) this._resize();
    var ctx = this.ctx;
    var w = this.w,
      h = this.h;
    var pts = this.points;
    revealProgress = revealProgress == null ? 1 : revealProgress;

    ctx.clearRect(0, 0, w, h);
    if (!pts.length) return;

    var padY = 14;
    var prices = pts.map(function (p) {
      return p.price;
    });
    var min = Math.min.apply(null, prices);
    var max = Math.max.apply(null, prices);
    var range = max - min || 1;

    var coords = pts.map(function (p, i) {
      var x = (i / (pts.length - 1)) * w;
      var y = padY + (1 - (p.price - min) / range) * (h - padY * 2);
      return { x: x, y: y };
    });

    var visibleCount = Math.max(2, Math.floor(coords.length * revealProgress));
    var visible = coords.slice(0, visibleCount);

    // grid lines
    ctx.strokeStyle = "rgba(212,175,55,0.08)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    for (var g = 1; g < 4; g++) {
      var gy = padY + (g / 4) * (h - padY * 2);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // area fill
    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(224,185,98,0.4)");
    grad.addColorStop(0.6, "rgba(224,185,98,0.08)");
    grad.addColorStop(1, "rgba(224,185,98,0)");

    ctx.beginPath();
    ctx.moveTo(visible[0].x, visible[0].y);
    for (var i = 1; i < visible.length; i++) ctx.lineTo(visible[i].x, visible[i].y);
    ctx.lineTo(visible[visible.length - 1].x, h);
    ctx.lineTo(visible[0].x, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    var lineGrad = ctx.createLinearGradient(0, 0, w, 0);
    lineGrad.addColorStop(0, "#96690f");
    lineGrad.addColorStop(0.4, "#f4e3a8");
    lineGrad.addColorStop(0.55, "#fff6d9");
    lineGrad.addColorStop(0.75, "#e0b962");
    lineGrad.addColorStop(1, "#b8860b");

    ctx.beginPath();
    ctx.moveTo(visible[0].x, visible[0].y);
    for (var j = 1; j < visible.length; j++) ctx.lineTo(visible[j].x, visible[j].y);
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // hover crosshair
    if (this.hoverIndex != null && coords[this.hoverIndex]) {
      var hp = coords[this.hoverIndex];
      ctx.beginPath();
      ctx.moveTo(hp.x, 0);
      ctx.lineTo(hp.x, h);
      ctx.strokeStyle = "rgba(212,175,55,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(hp.x, hp.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#fff6d9";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#b8860b";
      ctx.stroke();
    }
  };

  /**
   * Mounts a complete price widget (value, LIVE/FALLBACK status, timestamp,
   * chart, period tabs, refresh button) inside `root` using the shared data-
   * attribute contract below. Used by both index.html and gold-price.html so
   * the wiring only exists once:
   *   [data-price-value] [data-price-change] [data-price-change-pct]
   *   [data-price-status] [data-price-status-text] [data-price-fallback-note]
   *   [data-price-updated] [data-price-source] [data-price-refresh]
   *   [data-price-refresh][data-price-refresh-label] [data-price-chart]
   *   [data-chart-tooltip] [data-price-periods]
   */
  function mountWidget(root, options) {
    if (!root) return;
    options = options || {};
    var valueEl = root.querySelector("[data-price-value]");
    var changeEl = root.querySelector("[data-price-change]");
    var changePctEl = root.querySelector("[data-price-change-pct]");
    var statusEl = root.querySelector("[data-price-status]");
    var statusTextEl = root.querySelector("[data-price-status-text]");
    var fallbackNoteEl = root.querySelector("[data-price-fallback-note]");
    var updatedEl = root.querySelector("[data-price-updated]");
    var sourceEl = root.querySelector("[data-price-source]");
    var refreshBtn = root.querySelector("[data-price-refresh]");
    var refreshLabelEl = refreshBtn ? refreshBtn.querySelector("[data-price-refresh-label]") : null;
    var chartCanvas = root.querySelector("[data-price-chart]");
    var tooltipEl = root.querySelector("[data-chart-tooltip]");
    var periodTabs = root.querySelector("[data-price-periods]");

    var chart = chartCanvas ? new GoldChart(chartCanvas, { tooltipEl: tooltipEl }) : null;
    var activeTab = periodTabs ? periodTabs.querySelector(".active[data-period]") : null;
    var currentPeriod = activeTab ? activeTab.getAttribute("data-period") : "1H";

    // TAMAYA's actual selling price for 1 gram (reference + margin) — the
    // ONLY price this widget ever shows. Never the raw state.pricePerGram:
    // showing that number anywhere next to a marked-up product price would
    // let a customer divide the two and read off the exact margin. Falls
    // back to the raw price only if products.js somehow isn't loaded.
    function displayPricePerGram() {
      if (global.TamayaProducts && typeof global.TamayaProducts.getSellingPrice === "function") {
        return global.TamayaProducts.getSellingPrice(1);
      }
      return getState().pricePerGram;
    }

    function formatTimestamp(snap) {
      if (snap.isLive && snap.updatedAtLabel) return snap.updatedAtLabel;
      if (snap.lastCheckedAt) {
        var d = new Date(snap.lastCheckedAt);
        return (
          "Dicoba " +
          d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) +
          ", " +
          d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) +
          " WIB"
        );
      }
      return "—";
    }

    function render() {
      var snap = getState();
      if (valueEl) valueEl.textContent = formatIDR(displayPricePerGram());
      if (statusEl) {
        statusEl.classList.toggle("is-live", snap.isLive);
        statusEl.classList.toggle("is-fallback", !snap.isLive);
      }
      if (statusTextEl) statusTextEl.textContent = snap.isLive ? "LIVE" : "FALLBACK";
      // Deliberately generic — snap.source/sourceUrl name the specific
      // supplier (Hartadinata Abadi/EMASKU) internally, but TAMAYA GOLD is
      // a reseller and customers should never be handed a direct path to
      // buy from the supplier instead. Keep the brand name out of the UI.
      if (sourceEl) sourceEl.textContent = snap.isLive ? "Pasar Emas Resmi" : "Cadangan Sistem";
      if (updatedEl) updatedEl.textContent = formatTimestamp(snap);
      if (fallbackNoteEl) fallbackNoteEl.style.display = snap.isLive ? "none" : "block";
    }

    function loadPeriod(period) {
      currentPeriod = period;
      fetchHistory(period, displayPricePerGram()).then(function (points) {
        if (chart) chart.setData(points);
        if (typeof options.onHistoryLoaded === "function") options.onHistoryLoaded(points);
      });
    }

    fetchSnapshot().then(function (snap) {
      if (changePctEl) {
        changePctEl.textContent = (snap.changePct >= 0 ? "+" : "") + snap.changePct.toFixed(2).replace(".", ",") + "%";
      }
      if (changeEl) changeEl.classList.toggle("down", snap.changePct < 0);
    });
    loadPeriod(currentPeriod);
    render();

    if (periodTabs) {
      periodTabs.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-period]");
        if (!btn) return;
        periodTabs.querySelectorAll("button").forEach(function (b) {
          b.classList.remove("active");
        });
        btn.classList.add("active");
        loadPeriod(btn.getAttribute("data-period"));
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        if (refreshBtn.classList.contains("is-loading")) return;
        refreshBtn.classList.add("is-loading");
        refreshBtn.disabled = true;
        var originalLabel = refreshLabelEl ? refreshLabelEl.textContent : null;
        if (refreshLabelEl) refreshLabelEl.textContent = "Memperbarui harga...";

        refreshGoldPrice().then(function (snap) {
          render();
          loadPeriod(currentPeriod);
          if (refreshLabelEl) refreshLabelEl.textContent = originalLabel;
          refreshBtn.classList.remove("is-loading");
          refreshBtn.disabled = false;
          if (global.TamayaToast) {
            global.TamayaToast(
              snap.isLive
                ? "Harga berhasil diperbarui."
                : "Harga resmi tidak dapat diperbarui saat ini. Menggunakan harga fallback terakhir.",
            );
          }
        });
      });
    }

    onPriceChange(function () {
      render();
      loadPeriod(currentPeriod);
    });
  }

  global.TamayaGoldPrice = {
    GOLD_PRICE_CONFIG: GOLD_PRICE_CONFIG,
    PERIODS: PERIODS,
    getState: getState,
    onPriceChange: onPriceChange,
    refreshGoldPrice: refreshGoldPrice,
    fetchHartadinataPrice: fetchHartadinataPrice,
    fetchHrtaGoldPrice: fetchHrtaGoldPrice,
    getOfficialGoldPrice: getOfficialGoldPrice,
    fetchSnapshot: fetchSnapshot,
    fetchHistory: fetchHistory,
    formatIDR: formatIDR,
    formatRupiah: formatIDR,
    formatNumber: formatNumber,
    GoldChart: GoldChart,
    mountWidget: mountWidget,
  };

  // On load: reuse a still-fresh cached price if every page recently agreed
  // on one (see saveCachedState() above — this is what keeps index.html and
  // gold-price.html, or any two tabs, showing the exact same number instead
  // of each independently fetching and potentially landing on different
  // results). Only fetch fresh when the cache is missing or stale. Manual
  // refresh (the widget's button) always fetches fresh regardless.
  document.addEventListener("DOMContentLoaded", function () {
    var cached = loadCachedState();
    if (cached) {
      state.pricePerGram = cached.pricePerGram;
      state.isLive = cached.isLive;
      state.source = cached.source;
      state.sourceUrl = cached.sourceUrl;
      state.updatedAtLabel = cached.updatedAtLabel;
      state.lastCheckedAt = cached.lastCheckedAt;
      notify();
    } else {
      refreshGoldPrice();
    }

    if (GOLD_PRICE_CONFIG.autoRefreshMs > 0) {
      setInterval(function () {
        // Skip while the tab is in the background — no point spending a
        // request on a third-party service for a page nobody's looking at.
        if (document.visibilityState === "visible") refreshGoldPrice();
      }, GOLD_PRICE_CONFIG.autoRefreshMs);
    }
  });
})(window);
