/* ==========================================================================
   TAMAYA GOLD — Core App Logic
   Navbar, mobile nav, cart (localStorage), search, FAQ, reveal, counters.
   ========================================================================== */

(function (global) {
  "use strict";

  /* ---------------------------------------------------------------------
     Cart — persisted to localStorage. Swap persistNow()/loadNow() for a
     real backend cart (session/API) later without touching call sites.
  --------------------------------------------------------------------- */
  var CART_KEY = "tamaya_cart_v1";

  function loadCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(items) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch (e) {
      /* storage unavailable — cart stays in-memory for this session */
    }
  }

  var cartItems = loadCart();
  var cartListeners = [];

  function notifyCart() {
    saveCart(cartItems);
    cartListeners.forEach(function (fn) {
      fn(cartItems);
    });
  }

  var TamayaCart = {
    getItems: function () {
      return cartItems.slice();
    },
    add: function (id, qty) {
      qty = qty || 1;
      var line = cartItems.filter(function (l) {
        return l.id === id;
      })[0];
      if (line) {
        line.qty += qty;
      } else {
        cartItems.push({ id: id, qty: qty });
      }
      notifyCart();
    },
    remove: function (id) {
      cartItems = cartItems.filter(function (l) {
        return l.id !== id;
      });
      notifyCart();
    },
    setQty: function (id, qty) {
      if (qty <= 0) {
        TamayaCart.remove(id);
        return;
      }
      var line = cartItems.filter(function (l) {
        return l.id === id;
      })[0];
      if (line) {
        line.qty = qty;
        notifyCart();
      }
    },
    getCount: function () {
      return cartItems.reduce(function (sum, l) {
        return sum + l.qty;
      }, 0);
    },
    getSubtotal: function () {
      var products = global.TamayaProducts;
      if (!products) return 0;
      return cartItems.reduce(function (sum, l) {
        var p = products.getById(l.id);
        return sum + (p ? p.price * l.qty : 0);
      }, 0);
    },
    onChange: function (fn) {
      cartListeners.push(fn);
    },
  };
  global.TamayaCart = TamayaCart;

  /* ---------------------------------------------------------------------
     Toast notifications
  --------------------------------------------------------------------- */
  function showToast(message, iconSvg) {
    var stack = document.querySelector(".toast-stack");
    if (!stack) return;
    var toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML =
      (iconSvg ||
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>') +
      "<span>" +
      message +
      "</span>";
    stack.appendChild(toast);
    setTimeout(function () {
      toast.style.transition = "opacity .4s ease, transform .4s ease";
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(function () {
        toast.remove();
      }, 400);
    }, 2800);
  }
  global.TamayaToast = showToast;

  /* ---------------------------------------------------------------------
     Scroll reveal via IntersectionObserver
  --------------------------------------------------------------------- */
  var revealObserver = null;
  function getRevealObserver() {
    if (revealObserver) return revealObserver;
    revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );
    return revealObserver;
  }

  function observeReveal(nodeList) {
    var obs = getRevealObserver();
    nodeList.forEach(function (el) {
      obs.observe(el);
    });
  }
  global.TamayaApp = global.TamayaApp || {};
  global.TamayaApp.observeReveal = observeReveal;

  /* ---------------------------------------------------------------------
     Number counters
  --------------------------------------------------------------------- */
  function animateCounter(el) {
    var target = parseFloat(el.getAttribute("data-count-to"));
    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var suffix = el.getAttribute("data-suffix") || "";
    var duration = 1600;
    var start = null;

    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var value = target * eased;
      el.textContent = value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function initCounters() {
    var counters = document.querySelectorAll("[data-count-to]");
    if (!counters.length) return;
    var obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 },
    );
    counters.forEach(function (el) {
      obs.observe(el);
    });
  }

  /* ---------------------------------------------------------------------
     Navbar scroll state + mobile nav + active link
  --------------------------------------------------------------------- */
  function initNavbar() {
    var navbar = document.querySelector(".navbar");
    if (!navbar) return;
    function onScroll() {
      if (window.scrollY > 30) navbar.classList.add("scrolled");
      else navbar.classList.remove("scrolled");
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    var page = document.body.getAttribute("data-page");
    if (page) {
      document.querySelectorAll("[data-nav-link]").forEach(function (link) {
        if (link.getAttribute("data-nav-link") === page) link.classList.add("active");
      });
    }
  }

  function initMobileNav() {
    var toggle = document.querySelector("[data-nav-toggle]");
    var drawer = document.querySelector(".mobile-nav");
    if (!toggle || !drawer) return;
    function open() {
      drawer.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function close() {
      drawer.classList.remove("open");
      document.body.style.overflow = "";
    }
    toggle.addEventListener("click", open);
    drawer.querySelectorAll("[data-nav-close]").forEach(function (el) {
      el.addEventListener("click", close);
    });
    drawer.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", close);
    });
  }

  /* ---------------------------------------------------------------------
     Cart drawer UI
  --------------------------------------------------------------------- */
  function goldObjectMarkup(visual, compact) {
    if (global.TamayaProducts && global.TamayaProducts.renderVisual) {
      return global.TamayaProducts.renderVisual(visual, compact);
    }
    return '<div class="gold-object' + (visual === "coin" ? " coin" : "") + '"></div>';
  }

  // LM product names already spell out the weight ("Logam Mulia 10 Gram"),
  // so only append "(Xg)" for names that don't already state it.
  function nameWithWeight(p) {
    return p.name.indexOf("Gram") !== -1 ? p.name : p.name + " (" + p.weight + "g)";
  }
  global.TamayaApp.goldObjectMarkup = goldObjectMarkup;
  global.TamayaApp.nameWithWeight = nameWithWeight;

  function renderCartDrawer() {
    var itemsEl = document.querySelector("[data-cart-items]");
    var subtotalEl = document.querySelector("[data-cart-subtotal]");
    var itemCountEl = document.querySelector("[data-cart-item-count]");
    var qtyCountEl = document.querySelector("[data-cart-qty-count]");
    var countEls = document.querySelectorAll("[data-cart-count]");
    if (!itemsEl) return;

    var lines = TamayaCart.getItems();
    var count = TamayaCart.getCount();
    countEls.forEach(function (el) {
      el.textContent = count;
      el.style.display = count > 0 ? "flex" : "none";
    });

    if (!lines.length) {
      itemsEl.innerHTML =
        '<div class="cart-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6h15l-1.5 9h-12z"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M6 6 5 2H2"/></svg><p>Keranjang Anda masih kosong.</p></div>';
      // Keep the footer (and its "Pesan via WhatsApp" button) visible even when
      // empty, so clicking it still runs the empty-cart guard/toast instead of
      // just being unreachable.
      if (itemCountEl) itemCountEl.textContent = "0 item";
      if (qtyCountEl) qtyCountEl.textContent = "0";
      if (subtotalEl) subtotalEl.textContent = global.TamayaGoldPrice.formatRupiah(0);
      return;
    }

    var products = global.TamayaProducts;
    itemsEl.innerHTML = lines
      .map(function (line) {
        var p = products.getById(line.id);
        if (!p) return "";
        return (
          '<div class="cart-line" data-line="' +
          p.id +
          '"><div class="cart-line-visual">' +
          goldObjectMarkup(p.visual, true) +
          '</div><div class="cart-line-info"><h4>' +
          nameWithWeight(p) +
          '</h4><span>' +
          global.TamayaGoldPrice.formatRupiah(p.price) +
          '</span><div class="cart-line-qty"><button data-qty-dec>−</button><span>' +
          line.qty +
          '</span><button data-qty-inc>+</button></div></div><button class="cart-remove" data-remove>Hapus</button></div>'
        );
      })
      .join("");

    if (subtotalEl) subtotalEl.textContent = global.TamayaGoldPrice.formatRupiah(TamayaCart.getSubtotal());
    if (itemCountEl) itemCountEl.textContent = lines.length + " item";
    if (qtyCountEl) qtyCountEl.textContent = count;
  }

  function initCart() {
    var toggle = document.querySelectorAll("[data-cart-toggle]");
    var drawer = document.querySelector(".cart-drawer");
    if (!drawer) return;

    function open() {
      renderCartDrawer();
      drawer.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function close() {
      drawer.classList.remove("open");
      document.body.style.overflow = "";
    }

    toggle.forEach(function (btn) {
      btn.addEventListener("click", open);
    });
    drawer.querySelectorAll("[data-cart-close]").forEach(function (el) {
      el.addEventListener("click", close);
    });

    drawer.addEventListener("click", function (e) {
      var line = e.target.closest("[data-line]");
      if (!line) return;
      var id = line.getAttribute("data-line");
      if (e.target.matches("[data-qty-inc]")) {
        var current = TamayaCart.getItems().filter(function (l) {
          return l.id === id;
        })[0];
        TamayaCart.setQty(id, (current ? current.qty : 0) + 1);
      } else if (e.target.matches("[data-qty-dec]")) {
        var cur2 = TamayaCart.getItems().filter(function (l) {
          return l.id === id;
        })[0];
        TamayaCart.setQty(id, (cur2 ? cur2.qty : 1) - 1);
      } else if (e.target.matches("[data-remove]")) {
        TamayaCart.remove(id);
      }
    });

    var checkoutBtn = document.querySelector("[data-checkout]");
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", function () {
        if (!TamayaCart.getCount()) {
          if (global.TamayaToast) {
            global.TamayaToast("Keranjang Anda masih kosong. Silakan pilih produk terlebih dahulu.");
          }
          return;
        }
        window.location.href = "checkout.html";
      });
    }

    TamayaCart.onChange(renderCartDrawer);
    renderCartDrawer();

    // Logam Mulia prices are re-derived from the live/fallback gold price
    // (see js/products.js). Re-render the drawer whenever that happens, and
    // — only if it actually changed the number, and only if there's
    // something in the cart to be affected — let the customer know their
    // total was recalculated instead of silently changing it under them.
    var lastNotifiedPrice = null;
    if (global.TamayaProducts && global.TamayaProducts.onPriceChange) {
      global.TamayaProducts.onPriceChange(function () {
        renderCartDrawer();
        var priceState = global.TamayaGoldPrice ? global.TamayaGoldPrice.getState() : null;
        if (!priceState) return;
        if (lastNotifiedPrice !== null && priceState.pricePerGram !== lastNotifiedPrice && TamayaCart.getCount() > 0) {
          showToast("Harga emas telah diperbarui. Total pesanan telah disesuaikan dengan harga terbaru.");
        }
        lastNotifiedPrice = priceState.pricePerGram;
      });
    }
  }

  /* ---------------------------------------------------------------------
     Add to cart / quick view (event delegation, works on every page)
  --------------------------------------------------------------------- */
  function initProductActions() {
    document.addEventListener("click", function (e) {
      var addBtn = e.target.closest("[data-add-to-cart]");
      if (addBtn && !addBtn.disabled) {
        var id = addBtn.getAttribute("data-add-to-cart");
        var product = global.TamayaProducts ? global.TamayaProducts.getById(id) : null;
        TamayaCart.add(id, 1);
        showToast((product ? product.name : "Produk") + " ditambahkan ke keranjang.");
      }

      var quickBtn = e.target.closest("[data-quick-view]");
      if (quickBtn) {
        openQuickView(quickBtn.getAttribute("data-quick-view"));
      }
    });
  }

  function openQuickView(id) {
    var modal = document.querySelector(".quick-view-modal");
    var product = global.TamayaProducts ? global.TamayaProducts.getById(id) : null;
    if (!modal || !product) return;

    modal.querySelector("[data-qv-visual]").innerHTML = goldObjectMarkup(product.visual, false);
    modal.querySelector("[data-qv-name]").textContent = product.name;
    modal.querySelector("[data-qv-category]").textContent = product.categoryLabel;
    modal.querySelector("[data-qv-weight]").textContent = product.weight + " Gram";
    modal.querySelector("[data-qv-purity]").textContent = product.purity;
    modal.querySelector("[data-qv-price]").textContent = global.TamayaGoldPrice.formatRupiah(product.price);
    modal.querySelector("[data-qv-stock]").textContent = product.stockLabel;
    modal.querySelector("[data-qv-stock]").className = "product-stock" + (product.inStock ? "" : " out");
    var addBtn = modal.querySelector("[data-qv-add]");
    addBtn.setAttribute("data-add-to-cart", product.id);
    addBtn.disabled = !product.inStock;

    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function initQuickViewModal() {
    var modal = document.querySelector(".quick-view-modal");
    if (!modal) return;
    modal.querySelectorAll("[data-qv-close]").forEach(function (el) {
      el.addEventListener("click", function () {
        modal.classList.remove("open");
        document.body.style.overflow = "";
      });
    });
  }

  /* ---------------------------------------------------------------------
     Search overlay
  --------------------------------------------------------------------- */
  function initSearch() {
    var toggles = document.querySelectorAll("[data-search-toggle]");
    var overlay = document.querySelector(".search-overlay");
    if (!overlay) return;
    var input = overlay.querySelector("input");
    var resultsEl = overlay.querySelector("[data-search-results]");

    function open() {
      overlay.classList.add("open");
      document.body.style.overflow = "hidden";
      setTimeout(function () {
        input.focus();
      }, 100);
      renderResults("");
    }
    function close() {
      overlay.classList.remove("open");
      document.body.style.overflow = "";
      input.value = "";
    }

    function renderResults(query) {
      var products = (global.TamayaProducts && global.TamayaProducts.PRODUCTS) || [];
      var q = query.trim().toLowerCase();
      var matches = q
        ? products.filter(function (p) {
            return (p.name + " " + p.categoryLabel).toLowerCase().indexOf(q) !== -1;
          })
        : products.slice(0, 5);

      if (!matches.length) {
        resultsEl.innerHTML = '<div class="search-empty">Tidak ada produk yang cocok dengan pencarian Anda.</div>';
        return;
      }
      resultsEl.innerHTML = matches
        .map(function (p) {
          return (
            '<a class="search-result-item" href="product.html?id=' +
            p.id +
            '">' +
            goldObjectMarkup(p.visual, true) +
            '<div><div style="font-weight:700;font-size:0.9rem">' +
            nameWithWeight(p) +
            '</div><div style="font-size:0.8rem;color:var(--ivory-faint)">' +
            global.TamayaGoldPrice.formatRupiah(p.price) +
            "</div></div></a>"
          );
        })
        .join("");
    }

    toggles.forEach(function (btn) {
      btn.addEventListener("click", open);
    });
    overlay.querySelectorAll("[data-search-close]").forEach(function (el) {
      el.addEventListener("click", close);
    });
    input.addEventListener("input", function () {
      renderResults(input.value);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    });
  }

  /* ---------------------------------------------------------------------
     Account dropdown
  --------------------------------------------------------------------- */
  function initAccountMenu() {
    document.querySelectorAll(".account-menu").forEach(function (menu) {
      var toggle = menu.querySelector("[data-account-toggle]");
      if (!toggle) return;
      toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        menu.classList.toggle("open");
      });
    });
    document.addEventListener("click", function () {
      document.querySelectorAll(".account-menu.open").forEach(function (m) {
        m.classList.remove("open");
      });
    });
  }

  /* ---------------------------------------------------------------------
     FAQ accordion
  --------------------------------------------------------------------- */
  function initFaq() {
    document.querySelectorAll(".faq-item").forEach(function (item) {
      var question = item.querySelector(".faq-question");
      var answer = item.querySelector(".faq-answer");
      if (!question || !answer) return;
      question.addEventListener("click", function () {
        var isOpen = item.classList.contains("open");
        item.closest(".faq-list").querySelectorAll(".faq-item.open").forEach(function (openItem) {
          if (openItem !== item) {
            openItem.classList.remove("open");
            openItem.querySelector(".faq-answer").style.maxHeight = null;
          }
        });
        if (isOpen) {
          item.classList.remove("open");
          answer.style.maxHeight = null;
        } else {
          item.classList.add("open");
          answer.style.maxHeight = answer.scrollHeight + "px";
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
     Magnetic buttons (subtle)
  --------------------------------------------------------------------- */
  function initMagnetic() {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    document.querySelectorAll("[data-magnetic]").forEach(function (el) {
      el.addEventListener("mousemove", function (e) {
        var rect = el.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        el.style.transform = "translate(" + x * 0.15 + "px," + y * 0.3 + "px)";
      });
      el.addEventListener("mouseleave", function () {
        el.style.transform = "translate(0,0)";
      });
    });
  }

  /* ---------------------------------------------------------------------
     Init
  --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    initNavbar();
    initMobileNav();
    initCart();
    initProductActions();
    initQuickViewModal();
    initSearch();
    initAccountMenu();
    initFaq();
    initCounters();
    initMagnetic();

    var reveals = document.querySelectorAll("[data-reveal]");
    if (reveals.length) observeReveal(reveals);
  });
})(window);
