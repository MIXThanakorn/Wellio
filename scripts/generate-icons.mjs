import sharp from "sharp";
for (const size of [192, 512])
  await sharp("public/icon.svg")
    .resize(size, size)
    .png()
    .toFile(`public/icon-${size}.png`);
await sharp("public/icon.svg")
  .resize(180, 180)
  .png()
  .toFile("public/apple-touch-icon.png");
console.log("Generated PNG app icons from the project SVG source.");
