// Wave 1 — placeholder views + bottom tabs + skeleton + app-bar snap + motion
// T3: Motion penuh + HabitToday skeleton isi — nav deeper=up/back=down + sheet + skeleton
// T4: app-bar snap expand/collapse + peer-horizontal

import { createSkeleton, createAppBarController, transitionFor, prefersReducedMotion, withViewTransition } from "./motion.js";
import { makeSheetDraggable } from "./gestures.js";
import { getRange } from "./storage/prefs.js";
import { setTheme } from "./theme.js";
import { showInstallSheet, isStandalone } from "./pwa.js";

const TABS = [
  ["#/beranda", "Beranda"],
  ["#/habit", "Habit"],
  ["#/uang", "Uang"],
  ["#/pengaturan", "Pengaturan"]
];

function bottomNav(currentHash) {
  const nav = document.createElement("nav");
  nav.className = "bottom-tabs";
  nav.setAttribute("aria-label", "Navigasi utama");
  TABS.forEach(([href, label]) => {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    if (currentHash === href || (currentHash.startsWith(href) && href !== "#/beranda") || (href === "#/beranda" && (currentHash === "#/beranda" || currentHash === ""))) {
      a.setAttribute("aria-current", "page");
    }
    // Motion: peer-horizontal for tab switches (spec 04)
    a.addEventListener("click", (e) => {
      if (prefersReducedMotion()) return;
      // Will be handled by router with View Transition
      const relation = "peer";
      const t = transitionFor(relation);
      document.documentElement.style.setProperty("--motion-duration", `${t.duration}ms`);
    });
    nav.appendChild(a);
  });
  return nav;
}

function appBar(title, options = {}) {
  const { collapsible = true, rangeLabel = "" } = options;
  const header = document.createElement("header");
  header.className = "appbar viewing-area";
  header.dataset.state = "expanded";

  const h1 = document.createElement("h1");
  h1.className = "appbar-title";
  h1.textContent = title;
  header.appendChild(h1);

  if (rangeLabel) {
    const sub = document.createElement("p");
    sub.className = "placeholder";
    sub.style.fontSize = "12px";
    sub.style.marginTop = "4px";
    sub.textContent = rangeLabel;
    header.appendChild(sub);
  }

  // App bar controller for snap expand/collapse (T4)
  if (collapsible) {
    const controller = createAppBarController(header);
    let lastScrollY = 0;
    let ticking = false;

    function onScroll() {
      const scrollY = window.scrollY;
      const delta = scrollY - lastScrollY;
      lastScrollY = scrollY;

      if (!ticking) {
        requestAnimationFrame(() => {
          const progress = Math.min(scrollY / 96, 1); // 96px = expanded -> collapsed diff
          controller.setProgress(progress, false);
          ticking = false;
        });
        ticking = true;
      }

      // Snap on scroll end
      clearTimeout(header._snapTimeout);
      header._snapTimeout = setTimeout(() => {
        controller.settle(delta > 0 ? -500 : 500);
      }, 150);
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    // Cleanup on page change — store controller for removal? Simplified: remove listener when root cleared
    header._cleanup = () => window.removeEventListener("scroll", onScroll);
  }

  return header;
}

function shell(root, title, bodyBuilder, options = {}) {
  const { showRange = false, collapsible = true } = options;
  const wrap = document.createElement("div");
  wrap.className = "page";

  const range = showRange ? getRange() : null;
  const rangeLabel = range ? `${range.preset || "Bulan ini"} • ${range.tz}` : "";

  const header = appBar(title, { collapsible, rangeLabel });

  const main = document.createElement("div");
  main.className = "interaction-area";

  if (typeof bodyBuilder === "function") {
    bodyBuilder(main);
  } else {
    const p = document.createElement("p");
    p.className = "placeholder";
    p.textContent = bodyBuilder;
    main.appendChild(p);
  }

  const nav = bottomNav(location.hash);

  wrap.append(header, main, nav);
  root.appendChild(wrap);

  // Motion: deeper=up for entering this page (if coming from list)
  if (!prefersReducedMotion()) {
    wrap.classList.add("nav-deeper-enter");
    wrap.addEventListener("animationend", () => wrap.classList.remove("nav-deeper-enter"), { once: true });
  }
}

// Skeleton builders (T3)
function habitTodaySkeleton(container) {
  // Title skeleton
  const titleSk = createSkeleton("title");
  titleSk.classList.add("skeleton-title");
  container.appendChild(titleSk);

  // Habit cards skeleton
  const list = document.createElement("div");
  list.className = "habit-list";
  for (let i = 0; i < 3; i++) {
    const card = document.createElement("div");
    card.className = "skeleton skeleton-card";
    list.appendChild(card);
  }
  container.appendChild(list);

  // Simulate loading then replace with placeholder (for Wave 1 demo)
  setTimeout(() => {
    list.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "habit-list";
    const card = document.createElement("div");
    card.className = "habit-card";
    card.innerHTML = `<div class="check"></div><div class="info"><div class="title">Minum air 8 gelas</div><div class="subtitle">Streak 3 hari • Hari ini</div></div>`;
    empty.appendChild(card);

    const card2 = document.createElement("div");
    card2.className = "habit-card";
    card2.innerHTML = `<div class="check"></div><div class="info"><div class="title">Jalan 30 menit</div><div class="subtitle">Belum selesai</div></div>`;
    empty.appendChild(card2);

    container.replaceChild(empty, list);
    titleSk.remove();
  }, 1200);
}

function berandaSkeleton(container) {
  const range = getRange();
  const info = document.createElement("p");
  info.className = "placeholder";
  info.style.marginBottom = "16px";
  info.textContent = `Ringkasan ${range.preset} • ${range.tz} — segera hadir (T6–T7). Offline-ready, data terakhir tetap tampil.`;
  container.appendChild(info);

  // Ring placeholder + bar
  for (let i = 0; i < 2; i++) {
    const sk = createSkeleton("card");
    sk.classList.add("skeleton-card");
    container.appendChild(sk);
  }

  setTimeout(() => {
    container.querySelectorAll(".skeleton").forEach((el) => {
      el.style.opacity = "0.5";
    });
  }, 800);
}

export function Beranda(root) {
  shell(root, "HabitWealth", berandaSkeleton, { showRange: true, collapsible: true });
}

export function Habit(root, ctx = {}) {
  // If id present, show detail with back=down motion
  if (ctx.params && ctx.params.id) {
    shell(
      root,
      `Habit #${ctx.params.id}`,
      (c) => {
        const p = document.createElement("p");
        p.className = "placeholder";
        p.textContent = `Detail habit ${ctx.params.id} — segera hadir (T6). Back akan slide-down.`;
        c.appendChild(p);

        const backBtn = document.createElement("button");
        backBtn.className = "btn btn-secondary";
        backBtn.textContent = "Kembali";
        backBtn.style.marginTop = "16px";
        backBtn.addEventListener("click", () => {
          // Back motion
          const page = root.querySelector(".page");
          if (page && !prefersReducedMotion()) {
            page.classList.add("nav-back-exit");
            setTimeout(() => (location.hash = "#/habit"), 200);
          } else {
            location.hash = "#/habit";
          }
        });
        c.appendChild(backBtn);
      },
      { collapsible: false }
    );
    return;
  }

  shell(root, "Habit", habitTodaySkeleton, { showRange: true, collapsible: true });
}

export function Uang(root, ctx = {}) {
  if (ctx.params && ctx.params.id) {
    shell(root, `Transaksi #${ctx.params.id}`, `Detail transaksi ${ctx.params.id} — segera hadir (T7).`, { showRange: true });
    return;
  }

  shell(
    root,
    "Uang",
    (c) => {
      const p = document.createElement("p");
      p.className = "placeholder";
      p.textContent = "Keuangan — segera hadir (T7). Masking Rp•••• default. Offline queue siap.";
      c.appendChild(p);

      // Demo sheet (bottom sheet from bottom, one-hand reach)
      const btn = document.createElement("button");
      btn.className = "btn btn-primary";
      btn.textContent = "Coba Sheet";
      btn.style.marginTop = "16px";
      btn.addEventListener("click", () => {
        const scrim = document.createElement("div");
        scrim.className = "scrim";
        const sheet = document.createElement("div");
        sheet.className = "sheet-bottom pwa-sheet";
        sheet.innerHTML = `<div class="sheet-content"><div class="sheet-handle"></div><h2 class="sheet-title">Filter</h2><p class="sheet-desc">Contoh bottom sheet One UI — drag down untuk tutup, atau tap tombol.</p><div class="sheet-actions"><button class="btn btn-secondary" data-close-sheet>Tutup</button><button class="btn btn-primary">Terapkan</button></div></div>`;
        document.body.append(scrim, sheet);
        sheet.classList.add("open");

        const close = () => {
          sheet.classList.add("exiting");
          scrim.style.opacity = "0";
          setTimeout(() => {
            sheet.remove();
            scrim.remove();
          }, 250);
        };

        sheet.querySelector("[data-close-sheet]")?.addEventListener("click", close);
        scrim.addEventListener("click", close);

        // Make draggable (AUD-GEST-01)
        makeSheetDraggable(sheet, scrim, { onDismiss: close });
      });
      c.appendChild(btn);
    },
    { showRange: true }
  );
}

export function Pengaturan(root) {
  shell(
    root,
    "Pengaturan",
    (c) => {
      const p = document.createElement("p");
      p.className = "placeholder";
      p.textContent = "Pengaturan — segera hadir (T8). Theme system/light/dark, offline status, PWA version.";
      c.appendChild(p);

      // Theme switcher demo (AUD-THEME-01)
      const themeRow = document.createElement("div");
      themeRow.style.marginTop = "16px";
      themeRow.style.display = "flex";
      themeRow.style.gap = "8px";
      ["system", "light", "dark"].forEach((th) => {
        const b = document.createElement("button");
        b.className = "btn btn-secondary btn-small";
        b.textContent = th;
        b.addEventListener("click", async () => {
          setTheme(th);
        });
        themeRow.appendChild(b);
      });
      c.appendChild(themeRow);

      // PWA install demo
      const pwaBtn = document.createElement("button");
      pwaBtn.className = "btn btn-secondary";
      pwaBtn.textContent = "Cek Install PWA";
      pwaBtn.style.marginTop = "12px";
      pwaBtn.addEventListener("click", async () => {
        if (isStandalone()) alert("Sudah standalone");
        else showInstallSheet();
      });
      c.appendChild(pwaBtn);
    },
    { collapsible: false }
  );
}

export function NotFound(root) {
  shell(root, "Tidak ditemukan", "Halaman tidak ada. Kembali via tab di bawah.", { collapsible: false });
}
