import { build as viteBuild } from "vite";
import { build as esbuild } from "esbuild";
import { rm } from "fs/promises";

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("Building frontend...");
  await viteBuild();

  console.log("Building static server...");
  await esbuild({
    entryPoints: ["server/static-server.ts"],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: "dist/index.cjs",
    external: [],
  });
  
  console.log("Build complete!");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
