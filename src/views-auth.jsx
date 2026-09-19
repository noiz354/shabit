// T5 — AuthHub + Consent + Primer + First habit (spec 07 / P07), tanpa backend wajib
// Layar: AuthSplash(Restore) → AuthOnboarding(Carousel 3) → AuthHub → AuthConsent → PasskeyEnrollment
//        → FirstHabitCreate + FirstCompletion → (primer notifikasi, SATU per momen) → handoff #/beranda
// Motion: deeper=slide-up (nav-deeper-enter), back=slide-down, sheet dari bawah, reduced-motion fade.
// A11y: target 48dp, label SR, focus ke judul tiap langkah, live region status, non-color cues.

import { prefersReducedMotion, trapFocus } from "./motion.js";
import { makeSheetDraggable } from "./gestures.js";
import { makeCTAKeyboardAware, saveDraft, loadDraft, clearDraft } from "./keyboard.js";
import { recordPrimerDecision, shouldShowPrimer, getDecision } from "./permissions.js";
import { requestNotificationPermissionContextual } from "./notifications.js";
import { getPasskeyCapability, enrollPasskey, PASSKEY_REASON_COPY } from "./webauthn.js";
import { createHabit, completeHabit, getTemplates } from "./habit.js";
import { feedbackHabitComplete } from "./feedback.js";
import { store } from "./store.js";
import {
  restoreSession, signup, login, isLoggedIn, getSession, maskEmail,
  markCarouselDone, setOnboardingStep, getOnboardingState,
  saveConsent, validateConsent, CONSENT_COPY,
  deferPasskey, recordBiometricFailure, resetBiometricFailures, shouldFallbackToRecovery, BIO_FAIL_LIMIT,
  completeOnboarding, consumeReturnTo, getNextStep,
} from "./auth.js";

const STEP_LABELS = ["Kenalan", "Akun", "Persetujuan", "Kunci", "Habit pertama"];
const STEP_INDEX = { carousel: 0, hub: 1, consent: 2, passkey: 3, "first-habit": 4 };

// ---------- helpers ----------
function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

function go(hash, { back = false, root } = {}) {
  const page = root ? root.querySelector(".auth-page") : null;
  if (back && page && !prefersReducedMotion()) {
    page.classList.add("nav-back-exit");
    setTimeout(() => (location.hash = hash), 200);
  } else {
    location.hash = hash;
  }
}

function focusHeading(page) {
  const h = page.querySelector("h1");
  if (!h) return;
  h.setAttribute("tabindex", "-1");
  setTimeout(() => h.focus({ preventScroll: true }), 50);
}

function stepsIndicator(current) {
  const ol = el("ol", "auth-steps");
  ol.setAttribute("aria-label", `Langkah ${current + 1} dari ${STEP_LABELS.length}: ${STEP_LABELS[current]}`);
  STEP_LABELS.forEach((label, i) => {
    const li = el("li", i < current ? "done" : "");
    if (i === current) li.setAttribute("aria-current", "step");
    li.title = label;
    ol.appendChild(li);
  });
  return ol;
}

function notice({ tone = "info", icon = "ℹ️", title, body, actions = [] }) {
  const n = el("div", "notice");
  n.dataset.tone = tone;
  n.setAttribute("role", tone === "error" ? "alert" : "status");
  const ic = el("span", "notice-icon", icon);
  ic.setAttribute("aria-hidden", "true");
  const b = el("div", "notice-body");
  if (title) b.appendChild(el("div", "notice-title", title));
  if (body) b.appendChild(el("div", "", body));
  if (actions.length) {
    const a = el("div", "notice-actions");
    actions.forEach(({ label, onClick, primary }) => {
      const btn = el("button", `btn btn-small ${primary ? "btn-primary" : "btn-secondary"}`, label);
      btn.type = "button";
      btn.addEventListener("click", onClick);
      a.appendChild(btn);
    });
    b.appendChild(a);
  }
  n.append(ic, b);
  return n;
}

function liveStatus() {
  const p = el("p", "field-help");
  p.setAttribute("role", "status");
  p.setAttribute("aria-live", "polite");
  return p;
}

function page(root, { step, eyebrow, title, lead, showSteps = true }) {
  const wrap = el("div", "auth-page");
  const hero = el("header", "auth-hero");
  if (eyebrow) hero.appendChild(el("p", "eyebrow", eyebrow));
  hero.appendChild(el("h1", "", title));
  if (lead) hero.appendChild(el("p", "lead", lead));
  wrap.appendChild(hero);
  if (showSteps && step in STEP_INDEX) wrap.appendChild(stepsIndicator(STEP_INDEX[step]));
  const body = el("section", "auth-body");
  body.setAttribute("aria-label", title);
  const footer = el("footer", "auth-footer");
  wrap.append(body, footer);
  root.appendChild(wrap);
  if (!prefersReducedMotion()) {
    wrap.classList.add("nav-deeper-enter");
    wrap.addEventListener("animationend", () => wrap.classList.remove("nav-deeper-enter"), { once: true });
  }
  focusHeading(wrap);
  return { wrap, body, footer };
}

/**
 * Permission primer sheet — SATU per momen. "Nanti" TIDAK memicu dialog sistem.
 * onAllow dipanggil hanya setelah user tap "Izinkan" (recordPrimerDecision granted dulu).
 */
export function showPermissionPrimer({ scope, icon = "🔔", title, desc, allowLabel = "Izinkan", laterLabel = "Nanti", onAllow, onDone }) {
  if (!shouldShowPrimer(scope)) {
    onDone && onDone({ skipped: true });
    return null;
  }
  const scrim = el("div", "scrim");
  const sheet = el("div", "pwa-sheet sheet-bottom");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-labelledby", "primer-title");
  sheet.innerHTML = `
    <div class="sheet-content">
      <div class="sheet-handle" aria-hidden="true"></div>
      <div class="primer-card" style="padding:8px 0 0;background:transparent">
        <div class="primer-icon" aria-hidden="true">${icon}</div>
        <h2 class="sheet-title" id="primer-title"></h2>
        <p class="sheet-desc" id="primer-desc"></p>
      </div>
      <div id="primer-status" role="status" aria-live="polite" class="field-help" style="text-align:center;min-height:18px"></div>
      <div class="sheet-actions" style="margin-top:12px">
        <button type="button" class="btn btn-secondary" data-later></button>
        <button type="button" class="btn btn-primary" data-allow></button>
      </div>
    </div>`;
  sheet.querySelector("#primer-title").textContent = title;
  sheet.querySelector("#primer-desc").textContent = desc;
  const laterBtn = sheet.querySelector("[data-later]");
  const allowBtn = sheet.querySelector("[data-allow]");
  laterBtn.textContent = laterLabel;
  allowBtn.textContent = allowLabel;
  const status = sheet.querySelector("#primer-status");
  document.body.append(scrim, sheet);
  const untrap = trapFocus(sheet);
  const trigger = document.activeElement;

  function close(result) {
    untrap();
    sheet.classList.add("exiting");
    scrim.style.opacity = "0";
    setTimeout(() => {
      sheet.remove();
      scrim.remove();
      try { trigger && trigger.focus && trigger.focus(); } catch {}
      onDone && onDone(result);
    }, prefersReducedMotion() ? 150 : 250);
  }

  laterBtn.addEventListener("click", async () => {
    await recordPrimerDecision(scope, "later"); // tidak pernah memicu dialog sistem
    close({ decision: "later" });
  });
  allowBtn.addEventListener("click", async () => {
    allowBtn.disabled = true;
    await recordPrimerDecision(scope, "granted");
    let res = { state: "prompt" };
    try {
      res = (await onAllow?.()) || res;
    } catch {}
    if (res.state === "granted") {
      status.textContent = "Siap! Pengingat aktif.";
      setTimeout(() => close({ decision: "granted" }), 600);
    } else {
      // Deny/unsupported → fallback copy spec 07
      status.textContent = "Tidak apa-apa! Aktifkan nanti di Pengaturan › Privasi.";
      allowBtn.hidden = true;
      laterBtn.textContent = "Lanjut";
      laterBtn.onclick = () => close({ decision: res.state || "denied" });
    }
  });
  scrim.addEventListener("click", () => laterBtn.click());
  sheet.addEventListener("hw:close-sheet", () => laterBtn.click());
  makeSheetDraggable(sheet, scrim, { onDismiss: () => laterBtn.click() });
  return { close };
}

// ---------- 1. Splash / RestoreSession ----------
export function AuthSplash(root) {
  const { wrap, body, footer } = page(root, { step: null, title: "HabitWealth", lead: "Rutin harian dan uang, beriringan.", showSteps: false });
  const logo = el("div", "splash-logo", "H");
  logo.setAttribute("aria-hidden", "true");
  wrap.querySelector(".auth-hero").prepend(logo);

  const sk = el("div", "skeleton skeleton-card");
  sk.setAttribute("aria-busy", "true");
  sk.setAttribute("aria-label", "Memeriksa sesi…");
  body.appendChild(sk);
  const status = liveStatus();
  body.appendChild(status);

  (async () => {
    const r = await restoreSession();
    sk.remove();
    const target = r.nextStep === "done" ? (consumeReturnTo() || "/beranda") : `/auth/${r.nextStep}`;
    const proceed = () => go(`#${target}`);

    if (r.expired) {
      body.appendChild(notice({ tone: "warning", icon: "⏳", title: "Sesi berakhir", body: `Demi keamanan, sesi tidak aktif ${30} hari diakhiri. Silakan masuk lagi.`, actions: [{ label: "Masuk", primary: true, onClick: () => go("#/auth/hub?mode=login") }] }));
      return;
    }
    if (r.pendingSync > 0) {
      // Crash-recovery notice (spec 07 §1): tidak memblokir, coba otomatis + tombol Sync Sekarang
      body.appendChild(notice({
        tone: "warning", icon: "🔄", title: "Sinkronisasi tertunda, coba otomatis",
        body: `${r.pendingSync} perubahan menunggu dikirim. Data tetap tersimpan di perangkat.`,
        actions: [
          { label: "Sync Sekarang", primary: true, onClick: async (e) => { e.target.disabled = true; status.textContent = "Menyinkronkan…"; try { await store.drain(); status.textContent = "Selesai."; } catch { status.textContent = "Belum berhasil, akan dicoba lagi otomatis."; } setTimeout(proceed, 600); } },
          { label: "Lanjut", onClick: proceed },
        ],
      }));
      return;
    }
    status.textContent = r.session ? "Selamat datang kembali." : "";
    setTimeout(proceed, r.session ? 350 : 150);
  })();

  footer.appendChild(el("p", "hint", "Data habit dan uang manualmu tersimpan di perangkat ini."));
}

// ---------- 2. OnboardingCarousel (3 slide, Skip jelas) ----------
const SLIDES = [
  { icon: "✅", title: "Satu habit kecil tiap hari", desc: "Centang habit harianmu dalam sekali tap. Streak tumbuh tanpa rasa bersalah kalau terlewat." },
  { icon: "💸", title: "Catat uang tanpa ribet", desc: "Pemasukan dan pengeluaran manual, saldo dimasking Rp•••••• sampai kamu mau melihatnya." },
  { icon: "🔒", title: "Data di tanganmu", desc: "Tersimpan di perangkat, bisa diekspor dan dihapus kapan saja. HabitWealth tidak pernah memindahkan uangmu." },
];

export function AuthCarousel(root) {
  const { body, footer } = page(root, { step: "carousel", eyebrow: "Kenalan dulu", title: "Habit + uang, beriringan", lead: "3 hal singkat sebelum mulai. Bisa dilewati." });
  let idx = 0;
  const card = el("section", "carousel");
  card.setAttribute("aria-roledescription", "carousel");
  card.setAttribute("aria-live", "polite");
  const dots = el("div", "carousel-dots");
  dots.setAttribute("role", "tablist");
  dots.setAttribute("aria-label", "Slide");

  const nextBtn = el("button", "btn btn-primary", "Lanjut");
  nextBtn.type = "button";
  const skipBtn = el("button", "btn btn-flat", "Lewati");
  skipBtn.type = "button";

  function render() {
    const s = SLIDES[idx];
    card.innerHTML = "";
    const ic = el("div", "slide-icon", s.icon);
    ic.setAttribute("aria-hidden", "true");
    card.append(ic, el("h2", "", s.title), el("p", "", s.desc));
    card.setAttribute("aria-label", `Slide ${idx + 1} dari ${SLIDES.length}: ${s.title}`);
    dots.innerHTML = "";
    SLIDES.forEach((_, i) => {
      const b = el("button", "");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-label", `Slide ${i + 1}`);
      b.setAttribute("aria-current", i === idx ? "true" : "false");
      b.appendChild(el("span", ""));
      b.addEventListener("click", () => { idx = i; render(); });
      dots.appendChild(b);
    });
    nextBtn.textContent = idx === SLIDES.length - 1 ? "Mulai" : "Lanjut";
  }
  nextBtn.addEventListener("click", () => {
    if (idx < SLIDES.length - 1) { idx += 1; render(); return; }
    markCarouselDone({ skipped: false });
    go("#/auth/hub");
  });
  skipBtn.addEventListener("click", () => {
    markCarouselDone({ skipped: true });
    go("#/auth/hub");
  });
  // Keyboard: panah kiri/kanan (alternatif tanpa swipe)
  card.tabIndex = 0;
  card.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" && idx < SLIDES.length - 1) { idx += 1; render(); }
    if (e.key === "ArrowLeft" && idx > 0) { idx -= 1; render(); }
  });
  render();
  body.append(card, dots);
  footer.append(nextBtn, skipBtn);
}

// ---------- 3. SignupLoginHub ----------
export function AuthHub(root, ctx = {}) {
  const mode = (ctx.query && ctx.query.mode) === "login" ? "login" : "signup";
  const { body, footer } = page(root, {
    step: "hub",
    eyebrow: mode === "login" ? "Masuk" : "Buat akun",
    title: mode === "login" ? "Selamat datang kembali" : "Mulai dalam 3 menit",
    lead: "Cukup email untuk mulai. Tanpa kartu, tanpa transfer.",
  });

  const status = liveStatus();
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (offline) {
    body.appendChild(notice({ tone: "warning", icon: "📴", title: "Kamu sedang offline", body: "Akun dibuat di perangkat dulu dan disinkronkan otomatis saat online." }));
  }

  // Email form
  const form = el("form", "hub-list");
  form.noValidate = true;
  const field = el("div", "field");
  const label = el("label", "", "Email");
  label.htmlFor = "auth-email";
  const input = el("input", "field-input");
  input.id = "auth-email";
  input.name = "email";
  input.type = "email";
  input.autocomplete = mode === "login" ? "username" : "email";
  input.inputMode = "email";
  input.placeholder = "nama@contoh.id";
  input.required = true;
  input.setAttribute("aria-describedby", "auth-email-help");
  const help = el("p", "field-help", "Kami tidak mengirim promosi. Email hanya untuk pemulihan akun.");
  help.id = "auth-email-help";
  const err = el("p", "field-error");
  err.id = "auth-email-err";
  err.hidden = true;
  field.append(label, input, help, err);

  const submit = el("button", "hub-btn primary", "");
  submit.type = "submit";
  submit.innerHTML = `<span class="hub-icon" aria-hidden="true">✉️</span><span class="hub-label"></span>`;
  submit.querySelector(".hub-label").textContent = mode === "login" ? "Masuk dengan email" : "Lanjut dengan email";

  function setError(msg) {
    if (!msg) { err.hidden = true; err.textContent = ""; input.removeAttribute("aria-invalid"); return; }
    err.hidden = false;
    err.innerHTML = `<span aria-hidden="true">⚠️</span> <span></span>`;
    err.querySelector("span:last-child").textContent = msg;
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", "auth-email-help auth-email-err");
    input.focus();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("");
    submit.disabled = true;
    submit.setAttribute("aria-busy", "true");
    status.textContent = mode === "login" ? "Memeriksa akun…" : "Membuat akun…";
    const fn = mode === "login" ? login : signup;
    const res = await fn({ method: "email", email: input.value });
    submit.disabled = false;
    submit.removeAttribute("aria-busy");
    if (!res.ok) {
      status.textContent = "";
      if (res.code === "DUPLICATE") {
        // State duplikat → tawarkan masuk
        body.appendChild(notice({ tone: "warning", icon: "👤", title: "Akun sudah ada", body: res.message, actions: [{ label: "Masuk dengan email ini", primary: true, onClick: () => { location.hash = "#/auth/hub?mode=login"; } }] }));
        return;
      }
      if (res.code === "NOT_FOUND") {
        body.appendChild(notice({ tone: "warning", icon: "🆕", title: "Belum terdaftar", body: res.message, actions: [{ label: "Daftar", primary: true, onClick: () => { location.hash = "#/auth/hub"; } }] }));
        return;
      }
      setError(res.message || "Terjadi kesalahan. Coba lagi.");
      return;
    }
    status.textContent = res.offline ? "Akun dibuat di perangkat (offline). Lanjut…" : "Berhasil. Lanjut…";
    const next = getNextStep();
    setTimeout(() => go(next === "done" ? "#/beranda" : `#/auth/${next}`), 300);
  });
  form.append(field, submit);

  // Sosial + passkey (kondisional). Provider belum dikonfigurasi → jujur "Belum tersedia".
  const divider = el("div", "hub-divider", "atau");
  const social = el("div", "hub-list");
  const mkDisabled = (icon, labelTxt, why) => {
    const b = el("button", "hub-btn");
    b.type = "button";
    b.setAttribute("aria-disabled", "true");
    b.innerHTML = `<span class="hub-icon" aria-hidden="true">${icon}</span><span class="hub-label"></span><span class="chip">Belum tersedia</span>`;
    b.querySelector(".hub-label").textContent = labelTxt;
    b.addEventListener("click", () => { status.textContent = why; });
    return b;
  };
  social.appendChild(mkDisabled("G", "Lanjut dengan Google", "Masuk dengan Google belum aktif di versi ini (menunggu konfigurasi penyedia identitas)."));
  social.appendChild(mkDisabled("", "Lanjut dengan Apple", "Masuk dengan Apple belum aktif di versi ini."));

  const passkeySlot = el("div", "");
  getPasskeyCapability().then((cap) => {
    if (!cap.offerPasskey) return; // kondisional: hanya perangkat yang sanggup
    const b = el("button", "hub-btn");
    b.type = "button";
    b.innerHTML = `<span class="hub-icon" aria-hidden="true">🔑</span><span class="hub-label">Masuk dengan passkey</span>${cap.canEnroll ? "" : '<span class="chip">Segera</span>'}`;
    if (!cap.canEnroll) b.setAttribute("aria-disabled", "true");
    b.addEventListener("click", () => { status.textContent = PASSKEY_REASON_COPY.RP_NOT_CONFIGURED; });
    passkeySlot.appendChild(b);
  }).catch(() => {});

  body.append(form, divider, social, passkeySlot, status);

  const switchBtn = el("button", "btn btn-flat", mode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk");
  switchBtn.type = "button";
  switchBtn.addEventListener("click", () => { location.hash = mode === "login" ? "#/auth/hub" : "#/auth/hub?mode=login"; });
  const back = el("button", "btn btn-flat", "Kembali");
  back.type = "button";
  back.addEventListener("click", () => go("#/auth/carousel", { back: true, root }));
  footer.append(switchBtn, back);
  footer.appendChild(el("p", "hint", "Dengan melanjutkan kamu akan diminta persetujuan data di langkah berikutnya."));

  // Keyboard-aware: form scroll into view; draft email bukan PII untuk analytics (tidak dikirim)
  setTimeout(() => input.focus(), 120);
}

// ---------- 4. DataConsent (3 lapis; opsional tanpa preselect) ----------
export function AuthConsent(root) {
  const { body, footer } = page(root, { step: "consent", eyebrow: "Persetujuan data", title: "Kamu yang pegang kendali", lead: "Satu yang wajib, dua yang opsional. Semua bisa diubah di Pengaturan › Data & Privasi." });
  const status = liveStatus();
  const state = { dasar: false, kesehatan: false, finansial: false }; // TANPA preselect

  function consentCard(key, required) {
    const c = CONSENT_COPY[key];
    const card = el("div", "consent-card");
    const text = el("div", "consent-text");
    const title = el("div", "consent-title");
    title.append(document.createTextNode(c.title), el("span", required ? "badge-required" : "badge-optional", required ? "Wajib" : "Opsional"));
    const desc = el("p", "consent-desc", c.desc);
    desc.id = `consent-${key}-desc`;
    text.append(title, desc);
    const sw = el("label", "switch");
    const input = el("input", "");
    input.type = "checkbox";
    input.setAttribute("role", "switch");
    input.setAttribute("aria-checked", "false");
    input.setAttribute("aria-label", `${c.title}${required ? ", wajib" : ", opsional"}`);
    input.setAttribute("aria-describedby", desc.id);
    input.checked = false;
    input.addEventListener("change", () => {
      state[key] = input.checked;
      input.setAttribute("aria-checked", String(input.checked));
      if (key === "dasar" && input.checked) status.textContent = "";
    });
    sw.append(input, el("span", "track"), el("span", "thumb"));
    card.append(text, sw);
    return card;
  }

  body.append(consentCard("dasar", true), consentCard("kesehatan", false), consentCard("finansial", false));
  body.appendChild(el("p", "consent-legal", "Persetujuan dasar = pengakuan legal untuk memproses data yang kamu masukkan sendiri. Izin sistem (notifikasi/kamera) akan diminta terpisah, hanya saat kamu memakai fiturnya."));
  body.appendChild(status);

  const cont = el("button", "btn btn-primary", "Simpan & lanjut");
  cont.type = "button";
  cont.addEventListener("click", async () => {
    const v = validateConsent(state);
    if (!v.ok) {
      status.textContent = v.message;
      status.setAttribute("role", "alert");
      body.querySelector('input[aria-label^="Dasar"]')?.focus();
      return;
    }
    cont.disabled = true;
    await saveConsent(state);
    go("#/auth/passkey");
  });
  footer.append(cont);
  footer.appendChild(el("p", "hint", "Kami tidak menjual data. Detail di Kebijakan Privasi (tautan aktif sebelum rilis)."));
}

// ---------- 5. PasskeyEnrollment (kondisional) + Primer biometrik Day-1 ----------
export function AuthPasskey(root) {
  const { body, footer } = page(root, { step: "passkey", eyebrow: "Kunci masuk", title: "Wajahmu adalah kuncimu", lead: "Opsional. Bisa diatur nanti dari Pengaturan." });
  const status = liveStatus();
  const card = el("div", "primer-card");
  card.innerHTML = `<div class="primer-icon" aria-hidden="true">🔐</div><h2>Passkey, tanpa kata sandi</h2><p>Masuk dan buka saldo dengan sidik jari/wajah lewat kunci layar HP-mu. Verifikasi biometrik dilakukan oleh perangkatmu; HabitWealth hanya menerima kunci publik — bukan data wajah atau sidik jarimu.</p><p class="primer-note" id="passkey-note"></p>`;
  body.append(card, status);

  const later = el("button", "btn btn-secondary", "Nanti Saja");
  later.type = "button";
  later.addEventListener("click", () => {
    deferPasskey(); // → badge pengingat di Pengaturan
    go("#/auth/first-habit");
  });

  const enable = el("button", "btn btn-primary", "Aktifkan passkey");
  enable.type = "button";
  enable.hidden = true;
  enable.addEventListener("click", async () => {
    enable.disabled = true;
    status.textContent = "Menyiapkan…";
    const r = await enrollPasskey();
    if (r.ok) { resetBiometricFailures(); go("#/auth/first-habit"); return; }
    if (r.reason === "RP_NOT_CONFIGURED" || r.reason === "NOT_IMPLEMENTED") {
      // Bukan kegagalan biometrik — jujur, tidak dihitung sebagai gagal
      status.textContent = PASSKEY_REASON_COPY[r.reason];
      enable.hidden = true;
      later.textContent = "Lanjut tanpa passkey";
      later.focus();
      return;
    }
    const f = recordBiometricFailure();
    status.textContent = `${PASSKEY_REASON_COPY[r.reason] || "Gagal."} (${f.count}/${BIO_FAIL_LIMIT})`;
    enable.disabled = false;
    if (f.fallback) go("#/auth/recovery");
  });

  getPasskeyCapability().then((cap) => {
    const note = card.querySelector("#passkey-note");
    if (cap.offerPasskey) {
      enable.hidden = false;
      note.textContent = cap.canEnroll ? "Perangkat ini mendukung passkey." : "Perangkat ini mendukung passkey; fitur diaktifkan bertahap.";
    } else {
      note.textContent = cap.supported ? PASSKEY_REASON_COPY[cap.secureContext ? "NO_PLATFORM_AUTHENTICATOR" : "INSECURE_CONTEXT"] : PASSKEY_REASON_COPY.UNSUPPORTED;
      later.textContent = "Lanjut";
      later.className = "btn btn-primary";
    }
  }).catch(() => { later.textContent = "Lanjut"; });

  footer.append(enable, later);
  footer.appendChild(el("p", "hint", "Kalau passkey gagal 3×, tersedia jalur pemulihan lewat email."));
}

// ---------- 6. FirstHabitCreate + FirstCompletion ----------
export function AuthFirstHabit(root) {
  const { wrap, body, footer } = page(root, { step: "first-habit", eyebrow: "Habit pertama", title: "Mulai dari satu hal kecil", lead: "Pilih template atau tulis sendiri. Selesaikan sekali hari ini untuk merasakan alurnya." });
  footer.remove(); // CTA sticky menggantikan footer
  const status = liveStatus();
  const DRAFT_KEY = "first-habit";
  const draft = loadDraft(DRAFT_KEY) || {};
  const state = { title: draft.title || "", goal_type: draft.goal_type || "check", category: draft.category || "umum", schedule: draft.schedule };

  // Templates
  const tplWrap = el("div", "first-habit-templates");
  tplWrap.setAttribute("role", "group");
  tplWrap.setAttribute("aria-label", "Template cepat");
  const tplBtns = [];
  getTemplates().forEach((t) => {
    const b = el("button", "tpl-chip", t.title);
    b.type = "button";
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => {
      state.title = t.title; state.goal_type = t.goal_type; state.category = t.category; state.schedule = t.schedule;
      input.value = t.title;
      tplBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === t.goal_type)));
      saveDraft(DRAFT_KEY, state);
      cta.focus();
    });
    tplBtns.push(b);
    tplWrap.appendChild(b);
  });

  // Title field
  const field = el("div", "field");
  const label = el("label", "", "Nama habit");
  label.htmlFor = "first-habit-title";
  const input = el("input", "field-input");
  input.id = "first-habit-title";
  input.name = "first-habit-title";
  input.maxLength = 100;
  input.placeholder = "mis. Minum air setelah bangun";
  input.autocomplete = "off";
  input.value = state.title;
  input.addEventListener("input", () => { state.title = input.value; tplBtns.forEach((x) => x.setAttribute("aria-pressed", String(x.textContent === input.value))); });
  input.addEventListener("blur", () => saveDraft(DRAFT_KEY, state)); // autosave draft
  const help = el("p", "field-help", "Draf tersimpan otomatis. Tap di luar untuk menutup keyboard.");
  field.append(label, input, help);

  // Goal type segmented
  const seg = el("div", "segmented");
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", "Jenis target");
  [["check", "Centang"], ["count", "Hitungan"], ["duration", "Durasi"]].forEach(([v, l]) => {
    const b = el("button", "", l);
    b.type = "button";
    b.dataset.v = v;
    b.setAttribute("aria-pressed", String(state.goal_type === v));
    b.addEventListener("click", () => { state.goal_type = v; seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); saveDraft(DRAFT_KEY, state); });
    seg.appendChild(b);
  });

  const previewSlot = el("div", "");
  body.append(tplWrap, field, seg, previewSlot, status);

  // Sticky CTA di atas keyboard
  const ctaWrap = el("div", "auth-cta");
  const cta = el("button", "btn btn-primary", "Simpan habit");
  cta.type = "button";
  ctaWrap.appendChild(cta);
  body.appendChild(ctaWrap);
  const cleanupKbd = makeCTAKeyboardAware(ctaWrap, input);
  wrap.addEventListener("hw:destroy", cleanupKbd, { once: true });

  // Tap luar → dismiss keyboard (blur) + autosave
  wrap.addEventListener("pointerdown", (e) => {
    if (document.activeElement === input && !field.contains(e.target) && !ctaWrap.contains(e.target)) input.blur();
  });

  let habit = null;
  cta.addEventListener("click", async () => {
    if (habit) return;
    const title = (state.title || "").trim();
    if (!title) { status.textContent = "Tulis nama habit atau pilih template dulu."; status.setAttribute("role", "alert"); input.focus(); return; }
    cta.disabled = true;
    cta.setAttribute("aria-busy", "true");
    try {
      habit = await createHabit({ title, goal_type: state.goal_type, category: state.category, schedule: state.schedule });
    } catch (e) {
      cta.disabled = false; cta.removeAttribute("aria-busy");
      status.textContent = "Gagal menyimpan. Coba lagi.";
      return;
    }
    clearDraft(DRAFT_KEY);
    status.textContent = "Habit tersimpan. Sekarang tandai selesai untuk hari ini.";
    renderPreview();
    cta.textContent = "Tandai selesai hari ini";
    cta.disabled = false;
    cta.removeAttribute("aria-busy");
    cta.onclick = doComplete;
    input.disabled = true;
    tplBtns.forEach((b) => (b.disabled = true));
    seg.querySelectorAll("button").forEach((b) => (b.disabled = true));
  });

  function renderPreview() {
    previewSlot.innerHTML = "";
    const card = el("div", "habit-preview");
    const check = el("button", "check-btn", "✓");
    check.type = "button";
    check.setAttribute("aria-pressed", "false");
    check.setAttribute("aria-label", `Tandai ${habit.title} selesai hari ini`);
    check.addEventListener("click", doComplete);
    const info = el("div", "");
    info.append(el("div", "hp-title", habit.title), el("div", "hp-sub", "Hari ini • belum selesai"));
    card.append(check, info);
    previewSlot.appendChild(card);
  }

  let completed = false;
  async function doComplete() {
    if (!habit || completed) return;
    completed = true;
    const today = new Date().toISOString().slice(0, 10);
    try { await completeHabit(habit.id, today); } catch {}
    feedbackHabitComplete();
    const check = previewSlot.querySelector(".check-btn");
    if (check) { check.setAttribute("aria-pressed", "true"); check.disabled = true; }
    const sub = previewSlot.querySelector(".hp-sub");
    if (sub) sub.textContent = "Hari ini • selesai ✓ • streak 1 hari";
    ctaWrap.remove();

    const cel = el("div", "celebrate");
    cel.innerHTML = `<div class="celebrate-ring" aria-hidden="true">🎉</div><h2>Habit pertama selesai!</h2><p>Itu tadi inti HabitWealth. Besok tinggal ulangi.</p>`;
    body.appendChild(cel);
    const done = await completeOnboarding({ firstHabitId: habit.id });
    status.textContent = done.duration_s ? `Selesai dalam ${Math.floor(done.duration_s / 60)} mnt ${done.duration_s % 60} dtk.` : "";

    const toHome = el("button", "btn btn-primary", "Ke Beranda");
    toHome.type = "button";
    toHome.style.width = "100%";
    toHome.addEventListener("click", () => { location.hash = `#${consumeReturnTo() || "/beranda"}?first=1`; });
    body.appendChild(toHome);
    toHome.focus();

    // Primer notifikasi — SATU per momen, setelah first habit (spec 07 §6)
    showPermissionPrimer({
      scope: "notifications",
      icon: "🔔",
      title: "Ingatkan aku besok?",
      desc: "Satu pengingat ramah di jam yang kamu pilih. Tanpa nominal uang di layar kunci. Bisa dimatikan kapan saja.",
      onAllow: () => requestNotificationPermissionContextual(),
      onDone: () => toHome.focus(),
    });
  }

  setTimeout(() => (state.title ? cta : input).focus(), 150);
}

// ---------- 7. FallbackRecovery ----------
export function AuthRecovery(root) {
  const { body, footer } = page(root, { step: null, eyebrow: "Pemulihan", title: "Tidak masalah, ada jalan lain", lead: `Biometrik gagal ${BIO_FAIL_LIMIT}× atau tidak tersedia. Pilih cara lain untuk masuk.`, showSteps: false });
  const list = el("div", "hub-list");
  const emailBtn = el("button", "hub-btn primary");
  emailBtn.type = "button";
  emailBtn.innerHTML = `<span class="hub-icon" aria-hidden="true">✉️</span><span class="hub-label">Masuk ulang dengan email</span>`;
  emailBtn.addEventListener("click", () => { resetBiometricFailures(); location.hash = isLoggedIn() ? `#/auth/${getNextStep() === "done" ? "" : getNextStep()}` : "#/auth/hub?mode=login"; });
  const pinBtn = el("button", "hub-btn");
  pinBtn.type = "button";
  pinBtn.setAttribute("aria-disabled", "true");
  pinBtn.innerHTML = `<span class="hub-icon" aria-hidden="true">🔢</span><span class="hub-label">PIN</span><span class="chip">Belum diatur</span>`;
  const linkBtn = el("button", "hub-btn");
  linkBtn.type = "button";
  linkBtn.setAttribute("aria-disabled", "true");
  linkBtn.innerHTML = `<span class="hub-icon" aria-hidden="true">🔗</span><span class="hub-label">Tautan masuk via email</span><span class="chip">Belum tersedia</span>`;
  list.append(emailBtn, pinBtn, linkBtn);
  body.appendChild(list);
  body.appendChild(el("p", "consent-legal", "PIN dan tautan email menyusul setelah backend identitas tersedia. Data habit/uangmu tetap aman di perangkat."));
  const back = el("button", "btn btn-flat", "Kembali");
  back.type = "button";
  back.addEventListener("click", () => history.back());
  footer.appendChild(back);
}

// ---------- Router entry ----------
export function Auth(root, ctx = {}) {
  const step = (ctx.params && ctx.params.step) || "";
  switch (step) {
    case "carousel": return AuthCarousel(root, ctx);
    case "hub": return AuthHub(root, ctx);
    case "consent": return AuthConsent(root, ctx);
    case "passkey": return AuthPasskey(root, ctx);
    case "first-habit": return AuthFirstHabit(root, ctx);
    case "recovery": return AuthRecovery(root, ctx);
    default: return AuthSplash(root, ctx);
  }
}

export const authViews = { Auth, AuthSplash, AuthCarousel, AuthHub, AuthConsent, AuthPasskey, AuthFirstHabit, AuthRecovery, showPermissionPrimer };
// Untuk QA/CDP
export { getSession, maskEmail, getOnboardingState, shouldFallbackToRecovery, getDecision };
