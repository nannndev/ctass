// Rakit landing page ke dist/ buat Vercel:
//   dist/          landing (web/)
//   dist/engine/   mesin pecut dari src/js (dipakai demo di landing)
//   dist/play/     versi browser full layar (sama kayak app, tanpa overlay)
import { cpSync, rmSync, mkdirSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
cpSync("web", "dist", { recursive: true });
cpSync("src/js", "dist/engine", { recursive: true });
cpSync("src", "dist/play", { recursive: true });
cpSync("src/sounds", "dist/sounds", { recursive: true }); // rekaman pecut buat demo di landing (engine/../sounds)
cpSync("scripts/icon.png", "dist/icon.png");
console.log("dist/ siap");
