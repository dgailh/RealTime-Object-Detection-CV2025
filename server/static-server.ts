import express from "express";
import path from "path";

const app = express();
const PORT = parseInt(process.env.PORT || "5000", 10);

const distDir = path.resolve(process.cwd(), "dist");
const publicPath = path.join(distDir, "public");

app.use(express.static(publicPath));

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Static server running on port ${PORT}`);
});
