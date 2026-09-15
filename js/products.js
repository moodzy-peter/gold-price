/* ==========================================================================
   TAMAYA GOLD — Product Catalog
   Static catalog for now; swap PRODUCTS with a fetch() to a real product
   API/database later — every consumer only relies on this array's shape.
   Prices are plain numbers (IDR) so they can be edited by hand or replaced
   by a live price feed without touching any rendering code.
   ========================================================================== */

(function (global) {
  "use strict";

  // Fixed reference price for the non-LM lines below (Batangan/Koin/Investasi/
  // Hadiah). Deliberately NOT tied to the live Logam Mulia price service —
  // those categories are priced as a percentage premium over this fixed
  // number, and mixing in a fluctuating gold-price feed would move every one
  // of their prices any time the LM reference price changes, which nothing
  // asked for and nobody browsing those categories would expect.
  var LEGACY_GRAM_PRICE = 1876400;

  function priceFor(grams, premiumPct) {
    return Math.round(grams * LEGACY_GRAM_PRICE * (1 + premiumPct));
  }

  /**
   * Logam Mulia pricing — the only line tied to the live gold-price service.
   * Reference (wholesale) price comes from js/gold-price.js's live-fetch-
   * with-fallback service; falls back to fallbackBasePricePerGram below if
   * js/gold-price.js hasn't loaded at all.
   *
   * getSellingPrice() below is the ONLY place the margin is applied, and
   * this is the ONLY price that should ever reach the UI or the WhatsApp
   * message — never the raw reference price on its own. The gold-price
   * widget and the calculator both call getSellingPrice(1) rather than
   * reading the raw reference price directly, specifically so the raw
   * number and a marked-up product price never appear side by side (that
   * would let a customer just divide the two and read off the margin).
   */
  var GOLD_CONFIG = {
    fallbackBasePricePerGram: 2439000,
    marginPct: 0.1,
  };

  function getCurrentGoldPrice() {
    if (window.TamayaGoldPrice) return window.TamayaGoldPrice.getState().pricePerGram;
    return GOLD_CONFIG.fallbackBasePricePerGram;
  }

  function getSellingPrice(weight, basePricePerGram) {
    var base = basePricePerGram != null ? basePricePerGram : getCurrentGoldPrice();
    return Math.round(weight * base * (1 + GOLD_CONFIG.marginPct));
  }

  var CATEGORIES = [
    { id: "semua", label: "Semua" },
    { id: "lm", label: "Logam Mulia" },
    { id: "batangan", label: "Emas Batangan" },
    { id: "koin", label: "Emas Koin" },
    { id: "investasi", label: "Emas Investasi" },
    { id: "hadiah", label: "Emas Hadiah" },
  ];

  var PRODUCTS = [
    // --- Logam Mulia (flagship line) ---
    { id: "lm-05g", name: "Logam Mulia 0.5 Gram", category: "lm", categoryLabel: "Logam Mulia", weight: 0.5, purity: "999.9 Fine Gold", price: getSellingPrice(0.5), inStock: true, stockLabel: "Tersedia", badge: "Terlaris", visual: "lm" },
    { id: "lm-1g", name: "Logam Mulia 1 Gram", category: "lm", categoryLabel: "Logam Mulia", weight: 1, purity: "999.9 Fine Gold", price: getSellingPrice(1), inStock: true, stockLabel: "Tersedia", badge: "Populer", visual: "lm" },
    { id: "lm-2g", name: "Logam Mulia 2 Gram", category: "lm", categoryLabel: "Logam Mulia", weight: 2, purity: "999.9 Fine Gold", price: getSellingPrice(2), inStock: true, stockLabel: "Tersedia", visual: "lm" },
    { id: "lm-5g", name: "Logam Mulia 5 Gram", category: "lm", categoryLabel: "Logam Mulia", weight: 5, purity: "999.9 Fine Gold", price: getSellingPrice(5), inStock: true, stockLabel: "Tersedia", visual: "lm" },
    { id: "lm-10g", name: "Logam Mulia 10 Gram", category: "lm", categoryLabel: "Logam Mulia", weight: 10, purity: "999.9 Fine Gold", price: getSellingPrice(10), inStock: true, stockLabel: "Tersedia", visual: "lm" },
    { id: "lm-25g", name: "Logam Mulia 25 Gram", category: "lm", categoryLabel: "Logam Mulia", weight: 25, purity: "999.9 Fine Gold", price: getSellingPrice(25), inStock: true, stockLabel: "Sisa 6 pcs", visual: "lm" },
    { id: "lm-50g", name: "Logam Mulia 50 Gram", category: "lm", categoryLabel: "Logam Mulia", weight: 50, purity: "999.9 Fine Gold", price: getSellingPrice(50), inStock: true, stockLabel: "Tersedia", visual: "lm" },
    { id: "lm-100g", name: "Logam Mulia 100 Gram", category: "lm", categoryLabel: "Logam Mulia", weight: 100, purity: "999.9 Fine Gold", price: getSellingPrice(100), inStock: true, stockLabel: "Tersedia", badge: "Nilai Terbaik", visual: "lm" },

    // --- Emas Batangan ---
    { id: "bar-1g", name: "TAMAYA Gold Bar", category: "batangan", categoryLabel: "Emas Batangan", weight: 1, purity: "999.9 Fine Gold", price: priceFor(1, 0.09), inStock: true, stockLabel: "Tersedia", visual: "bar" },
    { id: "bar-5g", name: "TAMAYA Gold Bar", category: "batangan", categoryLabel: "Emas Batangan", weight: 5, purity: "999.9 Fine Gold", price: priceFor(5, 0.065), inStock: true, stockLabel: "Tersedia", visual: "bar" },
    { id: "bar-10g", name: "TAMAYA Gold Bar", category: "batangan", categoryLabel: "Emas Batangan", weight: 10, purity: "999.9 Fine Gold", price: priceFor(10, 0.05), inStock: true, stockLabel: "Tersedia", badge: "Populer", visual: "bar" },
    { id: "bar-25g", name: "TAMAYA Gold Bar", category: "batangan", categoryLabel: "Emas Batangan", weight: 25, purity: "999.9 Fine Gold", price: priceFor(25, 0.035), inStock: true, stockLabel: "Sisa 6 pcs", visual: "bar" },
    { id: "bar-50g", name: "TAMAYA Gold Bar", category: "batangan", categoryLabel: "Emas Batangan", weight: 50, purity: "999.9 Fine Gold", price: priceFor(50, 0.028), inStock: false, stockLabel: "Segera Tersedia", visual: "bar" },

    // --- Emas Koin ---
    { id: "coin-1g", name: "TAMAYA Sovereign Coin", category: "koin", categoryLabel: "Emas Koin", weight: 1, purity: "999.9 Fine Gold", price: priceFor(1, 0.12), inStock: true, stockLabel: "Tersedia", visual: "coin" },
    { id: "coin-8g", name: "TAMAYA Heritage Coin", category: "koin", categoryLabel: "Emas Koin", weight: 8, purity: "999.9 Fine Gold", price: priceFor(8, 0.08), inStock: true, stockLabel: "Tersedia", badge: "Edisi Terbatas", visual: "coin" },

    // --- Emas Investasi ---
    { id: "invest-100g", name: "TAMAYA Investment Ingot", category: "investasi", categoryLabel: "Emas Investasi", weight: 100, purity: "999.9 Fine Gold", price: priceFor(100, 0.018), inStock: true, stockLabel: "Tersedia", badge: "Nilai Terbaik", visual: "bar" },
    { id: "invest-250g", name: "TAMAYA Vault Bar", category: "investasi", categoryLabel: "Emas Investasi", weight: 250, purity: "999.9 Fine Gold", price: priceFor(250, 0.012), inStock: true, stockLabel: "Tersedia", visual: "bar" },

    // --- Emas Hadiah ---
    { id: "gift-2g", name: "TAMAYA Gift Bar", category: "hadiah", categoryLabel: "Emas Hadiah", weight: 2, purity: "999.9 Fine Gold", price: priceFor(2, 0.14), inStock: true, stockLabel: "Tersedia", badge: "Siap Hadiah", visual: "bar" },
    { id: "gift-coin-3g", name: "TAMAYA Gift Coin", category: "hadiah", categoryLabel: "Emas Hadiah", weight: 3, purity: "999.9 Fine Gold", price: priceFor(3, 0.13), inStock: true, stockLabel: "Tersedia", visual: "coin" },
  ];

  var DESCRIPTIONS = {
    lm: "Logam Mulia dengan kemurnian 999.9 Fine Gold, cocok untuk koleksi maupun investasi jangka panjang.",
    batangan: "Batangan emas TAMAYA GOLD dicetak dengan presisi tinggi dan disertifikasi 999.9 fine gold, pilihan ideal untuk investasi jangka panjang maupun koleksi pribadi.",
    koin: "Koin emas edisi TAMAYA GOLD menggabungkan nilai investasi dengan desain eksklusif, dicetak dalam jumlah terbatas untuk para kolektor.",
    investasi: "Dirancang khusus untuk investor serius, seri investasi TAMAYA GOLD menawarkan margin premium terendah dengan kemurnian dan keaslian terjamin.",
    hadiah: "Dikemas secara elegan dan siap diberikan, seri hadiah TAMAYA GOLD menjadi simbol perhatian yang bernilai abadi.",
  };

  function getById(id) {
    for (var i = 0; i < PRODUCTS.length; i++) {
      if (PRODUCTS[i].id === id) return PRODUCTS[i];
    }
    return null;
  }

  function getDescription(product) {
    return DESCRIPTIONS[product.category] || "";
  }

  function formatIDR(v) {
    return window.TamayaGoldPrice ? window.TamayaGoldPrice.formatRupiah(v) : "Rp " + v;
  }

  /**
   * Renders the CSS/3D gold visual for a product. Shared by product cards,
   * the product detail page, the quick-view modal, cart lines, and search
   * results — no visual markup should be duplicated anywhere else.
   *
   * `compact` renders a bare shape only (for small contexts like cart lines
   * or search rows); the full "Logam Mulia" certificate framing is only
   * worth the space in larger contexts (product cards, detail page, modal).
   */
  function renderVisual(visual, compact) {
    var isLM = visual === "lm";
    var shapeClass = "gold-object" + (visual === "coin" ? " coin" : "");

    if (isLM && !compact) {
      return (
        '<div class="lm-frame">' +
        '<span class="lm-corner tl"></span><span class="lm-corner tr"></span>' +
        '<span class="lm-corner bl"></span><span class="lm-corner br"></span>' +
        '<div class="' + shapeClass + '"></div>' +
        '<div class="lm-cert-label">Certified &middot; 999.9 Fine Gold</div>' +
        "</div>"
      );
    }
    return '<div class="' + shapeClass + '"></div>';
  }

  function cardHTML(p) {
    var badge = p.badge ? '<span class="product-card-badge">' + p.badge + "</span>" : "";
    var stockClass = p.inStock ? "" : "out";
    var addDisabled = p.inStock ? "" : "disabled";
    return (
      '<article class="product-card glass" data-reveal data-category="' +
      p.category +
      '">' +
      badge +
      '<div class="product-visual">' +
      renderVisual(p.visual) +
      "</div>" +
      '<div class="product-info">' +
      "<h3>" +
      p.name +
      "</h3>" +
      '<div class="product-meta"><span>' +
      p.weight +
      " Gram</span><span>" +
      p.purity +
      "</span></div>" +
      '<div class="product-price">' +
      formatIDR(p.price) +
      "</div>" +
      '<div class="product-stock ' +
      stockClass +
      '">' +
      p.stockLabel +
      "</div>" +
      '<div class="product-note">Harga dapat berubah mengikuti kondisi pasar.</div>' +
      '<div class="product-actions">' +
      '<button class="btn btn-ghost btn-sm" data-quick-view="' +
      p.id +
      '">Lihat Detail</button>' +
      '<button class="btn btn-gold btn-sm" data-add-to-cart="' +
      p.id +
      '" ' +
      addDisabled +
      ">Tambah ke Keranjang</button>" +
      "</div></div></article>"
    );
  }

  function renderGrid(container, list) {
    if (!container) return;
    if (!list.length) {
      container.innerHTML =
        '<div class="search-empty" style="grid-column:1/-1;padding:60px 20px;">Tidak ada produk pada kategori ini.</div>';
      return;
    }
    container.innerHTML = list.map(cardHTML).join("");
    if (window.TamayaApp && window.TamayaApp.observeReveal) {
      window.TamayaApp.observeReveal(container.querySelectorAll("[data-reveal]"));
    }
  }

  function initProductGrid(container, options) {
    if (!container) return;
    options = options || {};
    var limit = options.limit;
    var currentCategory = "semua";

    function listForCategory(cat) {
      if (limit) return PRODUCTS.slice(0, limit);
      return cat === "semua" ? PRODUCTS.slice() : PRODUCTS.filter(function (p) { return p.category === cat; });
    }

    renderGrid(container, listForCategory(currentCategory));

    var filterRow = options.filterRow;
    if (filterRow) {
      filterRow.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-filter]");
        if (!btn) return;
        filterRow.querySelectorAll(".filter-pill").forEach(function (b) {
          b.classList.remove("active");
        });
        btn.classList.add("active");
        currentCategory = btn.getAttribute("data-filter");
        renderGrid(container, listForCategory(currentCategory));
      });
    }

    // Logam Mulia prices can change after this grid is already on screen —
    // re-render whatever filter/list is currently showing so prices stay fresh.
    onPriceChange(function () {
      renderGrid(container, listForCategory(currentCategory));
    });
  }

  /**
   * Picks a variety-first sample for homepage-style previews: one product
   * per category first (so "Logam Mulia" is always represented up front),
   * then fills the remainder in catalog order.
   */
  function getFeatured(count) {
    count = count || 8;
    var seenCategories = {};
    var featured = [];

    PRODUCTS.forEach(function (p) {
      if (featured.length >= count) return;
      if (!seenCategories[p.category]) {
        seenCategories[p.category] = true;
        featured.push(p);
      }
    });
    PRODUCTS.forEach(function (p) {
      if (featured.length >= count) return;
      if (featured.indexOf(p) === -1) featured.push(p);
    });
    return featured;
  }

  /**
   * Re-derives every Logam Mulia product's price from the current gold-price
   * state (LIVE or FALLBACK — see js/gold-price.js). Product objects are
   * mutated in place, so anything that reads product.price fresh at render
   * time (cart subtotal, product cards, checkout) picks up the new number
   * automatically; this only needs to also re-render whatever is already on
   * screen, which is what the onPriceChange listeners below are for.
   */
  function recalcLmPrices() {
    var base = getCurrentGoldPrice();
    PRODUCTS.forEach(function (p) {
      if (p.category !== "lm") return;
      p.price = getSellingPrice(p.weight, base);
    });
  }

  var priceListeners = [];
  function onPriceChange(fn) {
    priceListeners.push(fn);
  }
  function notifyPriceListeners() {
    priceListeners.forEach(function (fn) {
      try {
        fn();
      } catch (e) {
        /* one bad listener should not break the others */
      }
    });
  }

  if (window.TamayaGoldPrice) {
    window.TamayaGoldPrice.onPriceChange(function () {
      recalcLmPrices();
      notifyPriceListeners();
    });
  }

  global.TamayaProducts = {
    PRODUCTS: PRODUCTS,
    CATEGORIES: CATEGORIES,
    GOLD_CONFIG: GOLD_CONFIG,
    getCurrentGoldPrice: getCurrentGoldPrice,
    getSellingPrice: getSellingPrice,
    recalcLmPrices: recalcLmPrices,
    onPriceChange: onPriceChange,
    getById: getById,
    getDescription: getDescription,
    renderVisual: renderVisual,
    cardHTML: cardHTML,
    renderGrid: renderGrid,
    initProductGrid: initProductGrid,
    getFeatured: getFeatured,
  };
})(window);
