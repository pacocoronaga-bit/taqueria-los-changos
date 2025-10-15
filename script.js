/* =========================================================
   Taquería Los Changos — script.js (v4)
   Autor: Francisco Corona (Paco)
   ---------------------------------------------------------
   Cambios:
   - Nombre obligatorio con validación visual (Bootstrap).
   - Campo se guarda en localStorage y se incluye en mensaje.
   ========================================================= */

(() => {
  "use strict";

  /* ========================== CONFIG ========================== */
  const $body = document.body;
  const STORE_NAME = ($body.dataset.storeName || "Taquería Los Changos").trim();
  const WPP_NUMBER = ($body.dataset.wppNumber || "529994552650").replace(/\D+/g, "");
  const CURRENCY = "MXN";

  /* ======================== SELECTORES ======================== */
  const $grid        = document.getElementById("productGrid");
  const $search      = document.getElementById("searchInput");
  const $empty       = document.getElementById("emptyState");
  const $cartItems   = document.getElementById("cartItems");
  const $cartTotal   = document.getElementById("cartTotal");
  const $cartCount   = document.getElementById("cartCount");
  const $btnWpp      = document.getElementById("btnWpp");
  const $btnClear    = document.getElementById("btnClear");
  const $fabCart     = document.getElementById("fabCart");
  const $orderNotes  = document.getElementById("orderNotes");
  const $orderMode   = document.getElementById("orderMode");
  const $offcanvas   = document.getElementById("cartOffcanvas");
  const $clientName  = document.getElementById("clientName");
  const $$filters    = Array.from(document.querySelectorAll(".btn-filter"));

  /* ===================== ESTADO / PERSISTENCIA ===================== */
  const STORAGE_KEY = "tlc_cart_v4";
  const NAME_KEY = "tlc_client_name";
  let CART = loadCart();

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
    catch { return {}; }
  }
  function saveCart() { localStorage.setItem(STORAGE_KEY, JSON.stringify(CART)); }

  /* ======================== UTILIDADES ======================== */
  const money = (n) => new Intl.NumberFormat("es-MX", {
    style: "currency", currency: CURRENCY, maximumFractionDigits: 0
  }).format(n);

  const norm = (s) => (s || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "").trim();

  const debounce = (fn, ms = 160) => {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  function announce(txt) {
    if (!announce.node) {
      announce.node = document.createElement("div");
      announce.node.setAttribute("aria-live", "polite");
      announce.node.className = "visually-hidden";
      document.body.appendChild(announce.node);
    }
    announce.node.textContent = "";
    setTimeout(() => announce.node.textContent = txt, 20);
  }

  function sumTotal() { return Object.values(CART).reduce((a, it) => a + it.price * it.qty, 0); }
  function countItems() { return Object.values(CART).reduce((a, it) => a + it.qty, 0); }

  /* ==================== RENDER DEL CARRITO ==================== */
  function renderCart() {
    $cartItems.innerHTML = "";
    const items = Object.values(CART);

    if (!items.length) {
      $cartItems.innerHTML = `<div class="list-group-item text-center text-muted">
        Tu carrito está vacío. Agrega algo rico 😋
      </div>`;
    } else {
      for (const it of items) {
        const row = document.createElement("div");
        row.className = "list-group-item d-flex align-items-center justify-content-between gap-2";
        row.innerHTML = `
          <div class="flex-grow-1">
            <div class="fw-semibold">${it.name}</div>
            <div class="small text-muted">${money(it.price)} c/u</div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-outline-secondary btn-sm" data-action="dec" data-id="${it.id}" aria-label="Quitar uno">–</button>
            <span class="min-w-2 text-center" aria-live="polite">${it.qty}</span>
            <button class="btn btn-outline-secondary btn-sm" data-action="inc" data-id="${it.id}" aria-label="Agregar uno">+</button>
            <div class="fw-semibold ms-2">${money(it.qty * it.price)}</div>
            <button class="btn btn-outline-danger btn-sm ms-2" data-action="del" data-id="${it.id}" aria-label="Eliminar del carrito">✕</button>
          </div>`;
        $cartItems.appendChild(row);
      }
    }

    $cartTotal.textContent = money(sumTotal());
    $cartCount.textContent = countItems();
    saveCart();

    $cartItems.querySelectorAll("button[data-action]").forEach(btn =>
      btn.addEventListener("click", onCartItemAction));
  }

  function onCartItemAction(e) {
    const { action, id } = e.currentTarget.dataset;
    const item = CART[id]; if (!item) return;

    if (action === "inc") item.qty++;
    if (action === "dec") item.qty = Math.max(0, item.qty - 1);
    if (action === "del" || item.qty === 0) delete CART[id];
    renderCart();
  }

  function addToCart({ id, name, price }) {
    const p = Number(price);
    if (!CART[id]) CART[id] = { id, name, price: p, qty: 0 };
    CART[id].qty++;
    renderCart();
    announce(`${name} agregado al carrito`);
  }

  /* =================== FILTROS Y BÚSQUEDA =================== */
  let activeFilter = "all";
  function applyFiltersAndSearch() {
    const q = norm($search?.value);
    const cards = Array.from($grid.querySelectorAll(".product-card"));
    let visible = 0;

    for (const card of cards) {
      const cat = (card.dataset.category || "").toLowerCase();
      const title = norm(card.querySelector(".card-title")?.textContent);
      const text  = norm(card.querySelector(".card-text")?.textContent);
      const matchCat = activeFilter === "all" || cat === activeFilter;
      const matchText = !q || title.includes(q) || text.includes(q);
      const show = matchCat && matchText;
      card.classList.toggle("d-none", !show);
      if (show) visible++;
    }
    $empty.classList.toggle("d-none", visible !== 0);
  }

  function onFilterClick(e) {
    $$filters.forEach(b => b.classList.remove("active"));
    const btn = e.currentTarget;
    btn.classList.add("active");
    activeFilter = btn.dataset.filter || "all";
    applyFiltersAndSearch();
  }

  /* ================== WHATSAPP · MENSAJE ================== */
  function buildWhatsAppMessage() {
    const name = ($clientName?.value || "").trim();
    const items = Object.values(CART);
    if (!items.length) return "";

    const lines = [
      `*${STORE_NAME}*`,
      `Pedido nuevo de *${name}*`,
      ""
    ];

    for (const it of items)
      lines.push(`• ${it.name} × ${it.qty} — ${money(it.price * it.qty)}`);

    lines.push("", `*Total:* ${money(sumTotal())}`);

    const mode  = $orderMode?.value || "pickup";
    const notes = ($orderNotes?.value || "").trim();
    if (notes) lines.push(`Notas: ${notes}`);
    lines.push(mode === "pickup" ? "Modo: Recoger en sucursal" : "Modo: Entrega a domicilio");
    lines.push("", "¿Me confirmas, por favor?");
    return lines.join("\n");
  }

  function buildWhatsAppUrl() {
    const msg = buildWhatsAppMessage();
    const isMobile = /Android|iPhone|Mobile/i.test(navigator.userAgent);
    const base = isMobile ? "https://wa.me" : "https://web.whatsapp.com/send";
    return isMobile
      ? `${base}/${WPP_NUMBER}?text=${encodeURIComponent(msg)}`
      : `${base}?phone=${WPP_NUMBER}&text=${encodeURIComponent(msg)}`;
  }

  /* ================= VALIDACIÓN DEL NOMBRE ================= */
  function validateName() {
    const name = ($clientName?.value || "").trim();
    const $error = document.getElementById("nameError");
    if (!name) {
      $clientName.classList.add("is-invalid");
      if ($error) $error.classList.remove("d-none");
      return false;
    } else {
      $clientName.classList.remove("is-invalid");
      if ($error) $error.classList.add("d-none");
      return true;
    }
  }

  function sendWhatsApp() {
    if (!validateName()) {
      $clientName.focus();
      return;
    }
    const name = $clientName.value.trim();
    localStorage.setItem(NAME_KEY, name);
    if (countItems() === 0) return alert("Tu carrito está vacío.");
    const url = buildWhatsAppUrl();
    if (url) window.open(url, "_blank", "noopener");
  }

  /* ===================== EVENTOS ===================== */
  $grid.addEventListener("click", (e) => {
    const $btn = e.target.closest(".btn-add");
    if (!$btn) return;
    const { id, name, price } = $btn.dataset;
    addToCart({ id, name, price });
  });

  $$filters.forEach(btn => btn.addEventListener("click", onFilterClick));
  $search?.addEventListener("input", debounce(applyFiltersAndSearch, 140));
  $btnWpp?.addEventListener("click", sendWhatsApp);
  $btnClear?.addEventListener("click", () => {
    if (!Object.keys(CART).length) return;
    if (confirm("¿Vaciar carrito?")) { CART = {}; renderCart(); }
  });
  if ($clientName) $clientName.addEventListener("input", validateName);

  if ($offcanvas && $fabCart) {
    $offcanvas.addEventListener("show.bs.offcanvas", () => $fabCart.classList.add("invisible"));
    $offcanvas.addEventListener("hidden.bs.offcanvas", () => $fabCart.classList.remove("invisible"));
  }

  /* ====================== ARRANQUE ====================== */
  renderCart();
  applyFiltersAndSearch();
  const savedName = localStorage.getItem(NAME_KEY);
  if (savedName && $clientName) $clientName.value = savedName;
})();

