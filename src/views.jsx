// Scaffold-only: placeholder views + bottom tabs (maks 5, tanpa swipe — specs/02/03).
// Setiap view: viewing area (judul) + interaction area (nav). Isi fitur = sesi terpisah.
const TABS = [
  ["#/beranda", "Beranda"],
  ["#/habit", "Habit"],
  ["#/uang", "Uang"],
  ["#/pengaturan", "Pengaturan"]
];

function shell(root, title, bodyText) {
  const wrap = document.createElement("div");
  wrap.className = "page";

  const header = document.createElement("header");
  header.className = "viewing-area";
  const h1 = document.createElement("h1");
  h1.textContent = title;
  header.appendChild(h1);

  const main = document.createElement("div");
  main.className = "interaction-area";
  const p = document.createElement("p");
  p.className = "placeholder";
  p.textContent = bodyText;
  main.appendChild(p);

  const nav = document.createElement("nav");
  nav.className = "bottom-tabs";
  nav.setAttribute("aria-label", "Navigasi utama");
  TABS.forEach(([href, label]) => {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    if (location.hash === href) a.setAttribute("aria-current", "page");
    nav.appendChild(a);
  });

  wrap.append(header, main, nav);
  root.appendChild(wrap);
}

export function Beranda(root) { shell(root, "HabitWealth", "Ringkasan — segera hadir (T6–T7)."); }
export function Habit(root) { shell(root, "Habit", "Habit hari ini — segera hadir (T6)."); }
export function Uang(root) { shell(root, "Uang", "Keuangan — segera hadir (T7)."); }
export function Pengaturan(root) { shell(root, "Pengaturan", "Pengaturan — segera hadir (T8)."); }
export function NotFound(root) { shell(root, "Tidak ditemukan", "Halaman tidak ada. Kembali via tab di bawah."); }
