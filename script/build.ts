import { build as viteBuild } from "vite";
import { rm } from "fs/promises";

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("Building frontend...");
  await viteBuild();
  
  console.log("Build complete! Frontend assets in dist/public/");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
