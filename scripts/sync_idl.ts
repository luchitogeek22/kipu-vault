import fs from "fs";
import path from "path";

const ROOT_DIR = path.resolve(__dirname, "..");
const SOURCE_IDL = path.join(ROOT_DIR, "target", "idl", "kipu_vault.json");
const TARGET_FRONTEND_IDL = path.join(
  ROOT_DIR,
  "frontend",
  "src",
  "idl",
  "kipu_vault.json"
);

if (!fs.existsSync(SOURCE_IDL)) {
  console.error(`No existe ${SOURCE_IDL}. Ejecuta primero: anchor build`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(TARGET_FRONTEND_IDL), { recursive: true });
fs.copyFileSync(SOURCE_IDL, TARGET_FRONTEND_IDL);
console.log(`IDL sincronizado: ${SOURCE_IDL} -> ${TARGET_FRONTEND_IDL}`);
