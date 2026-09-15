/* ==========================================================================
   TAMAYA GOLD — Investment Calculator
   Pure client-side logic. Reads the live price from gold-price.js; swap that
   module's fetchSnapshot() for a real API and this keeps working unchanged.
   ========================================================================== */

(function (global) {
  "use strict";

  var ANNUAL_GROWTH_ASSUMPTION = 0.08; // illustrative historical average, not guaranteed

  function parseDigits(str) {
    var digits = (str || "").replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  }

  function formatThousands(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function initCalculator(root) {
    if (!root) return;

    var amountInput = root.querySelector("[data-calc-amount]");
    var weightButtons = root.querySelectorAll("[data-calc-weight]");
    var gramsOut = root.querySelector("[data-calc-result-grams]");
    var priceOut = root.querySelector("[data-calc-result-price]");
    var valueOut = root.querySelector("[data-calc-result-value]");
    var projectionOut = root.querySelector("[data-calc-projection]");
    var periodButtons = root.querySelectorAll("[data-calc-period]");

    var currentPrice = (global.TamayaGoldPrice && global.TamayaGoldPrice.getState().pricePerGram) || 2439000;
    var selectedYears = 1;

    function fmtIDR(v) {
      return global.TamayaGoldPrice ? global.TamayaGoldPrice.formatIDR(Math.round(v)) : "Rp " + Math.round(v);
    }

    function refreshPrice() {
      if (!global.TamayaGoldPrice) return;
      global.TamayaGoldPrice.fetchSnapshot().then(function (snap) {
        currentPrice = snap.pricePerGram;
        if (priceOut) priceOut.textContent = fmtIDR(currentPrice) + " / gram";
        recalculate();
      });
    }

    function recalculate() {
      var amount = parseDigits(amountInput.value);
      var grams = currentPrice > 0 ? amount / currentPrice : 0;

      if (gramsOut) gramsOut.textContent = grams.toFixed(2).replace(".", ",") + " gram";
      if (priceOut) priceOut.textContent = fmtIDR(currentPrice) + " / gram";
      if (valueOut) valueOut.textContent = fmtIDR(grams * currentPrice);

      if (projectionOut) {
        var projected = amount * Math.pow(1 + ANNUAL_GROWTH_ASSUMPTION, selectedYears);
        projectionOut.textContent = fmtIDR(projected);
      }

      weightButtons.forEach(function (btn) {
        var w = parseFloat(btn.getAttribute("data-calc-weight"));
        var expected = Math.round(w * currentPrice);
        btn.classList.toggle("active", Math.abs(expected - amount) < currentPrice * 0.5 && amount > 0);
      });
    }

    if (amountInput) {
      amountInput.addEventListener("input", function () {
        var digits = parseDigits(amountInput.value);
        amountInput.value = digits ? formatThousands(digits) : "";
        recalculate();
      });
    }

    weightButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var w = parseFloat(btn.getAttribute("data-calc-weight"));
        var amount = Math.round(w * currentPrice);
        amountInput.value = formatThousands(amount);
        recalculate();
      });
    });

    periodButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        periodButtons.forEach(function (b) {
          b.classList.remove("active");
        });
        btn.classList.add("active");
        selectedYears = parseFloat(btn.getAttribute("data-calc-period"));
        recalculate();
      });
    });

    if (amountInput && !amountInput.value) {
      amountInput.value = formatThousands(Math.round(10 * currentPrice));
    }
    refreshPrice();

    // React to live/fallback gold-price refreshes (initial load or the
    // widget's manual refresh button) so the calculator never shows a
    // stale reference price.
    if (global.TamayaGoldPrice) {
      global.TamayaGoldPrice.onPriceChange(refreshPrice);
    }
  }

  global.TamayaCalculator = { init: initCalculator };

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-calculator]").forEach(function (root) {
      initCalculator(root);
    });
  });
})(window);
