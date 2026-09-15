/* ==========================================================================
   TAMAYA GOLD — WhatsApp Ordering
   Single source of truth for the store's WhatsApp number, shipping rules,
   and every auto-generated message. No payment gateway — WhatsApp is only
   used to send an order REQUEST; the team confirms availability, final
   price, and payment there.
   ========================================================================== */

(function (global) {
  "use strict";

  // The only place the store's WhatsApp number is defined — change it here.
  var STORE_CONFIG = {
    whatsappNumber: "6285210532288",
  };

  // Free shipping within West Java; a flat surcharge everywhere else.
  // Change the number/cost here and every price shown across the site follows.
  var SHIPPING_CONFIG = {
    freeProvince: "Jawa Barat",
    outsideCost: 20000,
  };

  var PROVINCES = [
    "Aceh", "Sumatera Utara", "Sumatera Barat", "Riau", "Kepulauan Riau",
    "Jambi", "Sumatera Selatan", "Bangka Belitung", "Bengkulu", "Lampung",
    "DKI Jakarta", "Jawa Barat", "Jawa Tengah", "DI Yogyakarta", "Jawa Timur", "Banten",
    "Bali", "Nusa Tenggara Barat", "Nusa Tenggara Timur",
    "Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Selatan", "Kalimantan Timur", "Kalimantan Utara",
    "Sulawesi Utara", "Sulawesi Tengah", "Sulawesi Selatan", "Sulawesi Tenggara", "Gorontalo", "Sulawesi Barat",
    "Maluku", "Maluku Utara",
    "Papua", "Papua Barat", "Papua Tengah", "Papua Pegunungan", "Papua Selatan", "Papua Barat Daya",
  ];

  function formatRupiah(value) {
    return global.TamayaGoldPrice ? global.TamayaGoldPrice.formatRupiah(value) : "Rp " + value;
  }

  function calculateShipping(province) {
    return province === SHIPPING_CONFIG.freeProvince ? 0 : SHIPPING_CONFIG.outsideCost;
  }

  function buildWhatsAppUrl(message) {
    return "https://wa.me/" + STORE_CONFIG.whatsappNumber + "?text=" + encodeURIComponent(message);
  }

  function openWhatsApp(message) {
    window.open(buildWhatsAppUrl(message), "_blank", "noopener");
  }

  var DIVIDER = "━━━━━━━━━━━━━━━━━━";

  function cartLines() {
    var products = global.TamayaProducts;
    var lines = global.TamayaCart ? global.TamayaCart.getItems() : [];
    var rows = [];
    var subtotal = 0;

    lines.forEach(function (line, index) {
      var p = products ? products.getById(line.id) : null;
      if (!p) return;
      var lineSubtotal = p.price * line.qty;
      subtotal += lineSubtotal;
      rows.push(
        (index + 1) + ". " + p.name + "\n" +
        "   Berat: " + p.weight + " Gram\n" +
        "   Harga: " + formatRupiah(p.price) + "\n" +
        "   Qty: " + line.qty + "\n" +
        "   Subtotal: " + formatRupiah(lineSubtotal)
      );
    });

    return { rows: rows, subtotal: subtotal };
  }

  /**
   * Full checkout message: itemized order + subtotal/shipping/total +
   * the customer's shipping details. Everything is pulled from the live
   * cart and the checkout form at send-time — nothing here is hardcoded.
   */
  function buildOrderMessage(customer) {
    var cart = cartLines();
    var shippingCost = calculateShipping(customer.province);
    var total = cart.subtotal + shippingCost;
    var shippingLine = shippingCost === 0 ? "Gratis" : formatRupiah(shippingCost);

    return (
      "Halo TAMAYA GOLD 👋\n\n" +
      "Saya ingin melakukan pemesanan:\n\n" +
      DIVIDER + "\n" +
      "DETAIL PESANAN\n" +
      DIVIDER + "\n\n" +
      cart.rows.join("\n\n") + "\n\n" +
      DIVIDER + "\n" +
      "RINGKASAN\n" +
      DIVIDER + "\n\n" +
      "Subtotal Produk:\n" + formatRupiah(cart.subtotal) + "\n\n" +
      "Pengiriman:\n" + shippingLine + "\n\n" +
      "TOTAL:\n" + formatRupiah(total) + "\n\n" +
      DIVIDER + "\n" +
      "DATA PENGIRIMAN\n" +
      DIVIDER + "\n\n" +
      "Nama:\n" + customer.name + "\n\n" +
      "WhatsApp:\n" + customer.phone + "\n\n" +
      "Provinsi:\n" + customer.province + "\n\n" +
      "Kota/Kabupaten:\n" + customer.city + "\n\n" +
      "Kecamatan:\n" + customer.district + "\n\n" +
      "Kelurahan:\n" + customer.subdistrict + "\n\n" +
      "Kode Pos:\n" + customer.postalCode + "\n\n" +
      "Alamat:\n" + customer.address + "\n\n" +
      DIVIDER + "\n\n" +
      "Mohon konfirmasi:\n" +
      "1. Ketersediaan produk\n" +
      "2. Harga terbaru\n" +
      "3. Total pembayaran\n" +
      "4. Proses pembayaran\n" +
      "5. Estimasi pengiriman\n\n" +
      "Terima kasih."
    );
  }

  /**
   * Cart + shipping form -> WhatsApp. Refuses (with a toast) on an empty
   * cart, and never claims the order is placed/paid — only that a request
   * was sent; the team confirms everything else over WhatsApp.
   */
  function openCheckoutOrder(customer) {
    var count = global.TamayaCart ? global.TamayaCart.getCount() : 0;
    if (!count) {
      if (global.TamayaToast) {
        global.TamayaToast("Keranjang Anda masih kosong. Silakan pilih produk terlebih dahulu.");
      }
      return false;
    }
    openWhatsApp(buildOrderMessage(customer));
    if (global.TamayaToast) {
      global.TamayaToast("Pesanan akan dikonfirmasi oleh tim TAMAYA GOLD melalui WhatsApp.");
    }
    return true;
  }

  function generateProductInquiryMessage(product) {
    return (
      "Halo TAMAYA GOLD 👋\n\n" +
      "Saya ingin menanyakan produk:\n\n" +
      product.name + "\n" +
      "Berat: " + product.weight + " Gram\n" +
      "Kemurnian: " + product.purity + "\n" +
      "Harga: " + formatRupiah(product.price) + "\n\n" +
      "Apakah produk ini masih tersedia?\n\n" +
      "Terima kasih."
    );
  }

  function openProductInquiry(product) {
    openWhatsApp(generateProductInquiryMessage(product));
  }

  function generateGeneralInquiryMessage() {
    return (
      "Halo TAMAYA GOLD 👋\n\n" +
      "Saya ingin menanyakan informasi mengenai produk emas."
    );
  }

  /** Every static WhatsApp CTA (hero, footer, floating button) shares this href. */
  function wireStaticLinks() {
    var url = buildWhatsAppUrl(generateGeneralInquiryMessage());
    document.querySelectorAll("[data-wa-general]").forEach(function (el) {
      el.setAttribute("href", url);
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener");
    });
  }

  function injectFloatingButton() {
    if (document.querySelector(".wa-float")) return;
    var el = document.createElement("a");
    el.className = "wa-float";
    el.href = "#";
    el.setAttribute("data-wa-general", "");
    el.setAttribute("aria-label", "Chat dengan TAMAYA GOLD");
    el.innerHTML =
      '<span class="wa-tooltip">Chat dengan TAMAYA GOLD</span>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.4 8.4 8.3 8.3 0 0 1-4-1L3 21l2.1-5.6a8.3 8.3 0 0 1-1-4A8.4 8.4 0 0 1 12.6 3 8.4 8.4 0 0 1 21 11.5z"/></svg>';
    document.body.appendChild(el);
  }

  global.TamayaWhatsApp = {
    NUMBER: STORE_CONFIG.whatsappNumber,
    PROVINCES: PROVINCES,
    SHIPPING_CONFIG: SHIPPING_CONFIG,
    calculateShipping: calculateShipping,
    openWhatsApp: openWhatsApp,
    buildOrderMessage: buildOrderMessage,
    openCheckoutOrder: openCheckoutOrder,
    generateProductInquiryMessage: generateProductInquiryMessage,
    openProductInquiry: openProductInquiry,
    generateGeneralInquiryMessage: generateGeneralInquiryMessage,
  };

  document.addEventListener("DOMContentLoaded", function () {
    injectFloatingButton();
    wireStaticLinks();
  });
})(window);
