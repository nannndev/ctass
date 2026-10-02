// Bikin latest.json buat auto-update app (dibaca tauri-plugin-updater).
// Dipanggil di job release CI: node scripts/updater-manifest.mjs out v0.2.5 owner/repo
// Cuma jalan kalau file .sig ada (artinya secret TAURI_SIGNING_PRIVATE_KEY udah dipasang).
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const [dir, tag, repo] = process.argv.slice(2);
const base = `https://github.com/${repo}/releases/download/${tag}/`;
const files = {
  "darwin-aarch64": "Ctas-macOS.app.tar.gz",
  "darwin-x86_64": "Ctas-macOS.app.tar.gz", // universal, satu file buat dua-duanya
  "windows-x86_64": "Ctas-Windows-setup.exe",
  "linux-x86_64": "Ctas-Linux.AppImage",
};
const platforms = {};
for (const [p, f] of Object.entries(files)) {
  const sig = `${dir}/${f}.sig`;
  if (existsSync(sig)) platforms[p] = { signature: readFileSync(sig, "utf8").trim(), url: base + f };
}
if (!Object.keys(platforms).length) {
  console.log("nggak ada file .sig, latest.json nggak dibikin (secret signing belum dipasang?)");
  process.exit(0);
}
const manifest = { version: tag.replace(/^v/, ""), notes: `Ctas ${tag}`, pub_date: new Date().toISOString(), platforms };
writeFileSync(`${dir}/latest.json`, JSON.stringify(manifest, null, 2));
console.log("latest.json:", Object.keys(platforms).join(", "));
