import Navigo from "navigo";
import { Beranda, Habit, Uang, Pengaturan, NotFound } from "./views.jsx";

// Scaffold-only: hash router (tanpa rewrite Apache di shared hosting).
// Hubungan nav: deeper=slide-up, back=slide-down (kelas di motion.css); tanpa fade global.
const routes = {
  "/beranda": Beranda,
  "/habit": Habit,
  "/uang": Uang,
  "/pengaturan": Pengaturan
};

export function initRouter(root) {
  const router = new Navigo("/", { hash: true });

  Object.entries(routes).forEach(([path, View]) => {
    router.on(path, () => {
      root.innerHTML = "";
      View(root);
    });
  });

  router.notFound(() => {
    root.innerHTML = "";
    NotFound(root);
  });

  router.on(() => router.navigate("/beranda"));
  router.resolve();
  return router;
}
