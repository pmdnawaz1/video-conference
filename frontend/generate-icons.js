import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = "./public/icons";

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Create gradient background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#3b82f6");
  gradient.addColorStop(1, "#1d4ed8");

  // Fill background with gradient
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Create rounded corners
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.18);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // Draw video camera icon
  const centerX = size / 2;
  const centerY = size / 2;
  const iconSize = size * 0.4;

  // Camera body
  ctx.fillStyle = "white";
  const bodyWidth = iconSize * 0.8;
  const bodyHeight = iconSize * 0.6;
  const bodyX = centerX - bodyWidth / 2;
  const bodyY = centerY - bodyHeight / 2;

  ctx.beginPath();
  ctx.roundRect(bodyX, bodyY, bodyWidth, bodyHeight, iconSize * 0.05);
  ctx.fill();

  // Camera lens
  ctx.fillStyle = "#1d4ed8";
  ctx.beginPath();
  ctx.arc(centerX - bodyWidth * 0.15, centerY, iconSize * 0.18, 0, 2 * Math.PI);
  ctx.fill();

  // Lens inner circle
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath();
  ctx.arc(centerX - bodyWidth * 0.15, centerY, iconSize * 0.1, 0, 2 * Math.PI);
  ctx.fill();

  // Viewfinder/Record button
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(
    centerX + bodyWidth * 0.2,
    centerY - bodyHeight * 0.15,
    iconSize * 0.08,
    0,
    2 * Math.PI,
  );
  ctx.fill();

  // Save the icon
  const buffer = canvas.toBuffer("image/png");
  const filename = path.join(iconsDir, `icon-${size}x${size}.png`);
  fs.writeFileSync(filename, buffer);

  console.log(`Generated: ${filename}`);
}

// Generate all icon sizes
console.log("Generating PWA icons...");
sizes.forEach(generateIcon);

// Also create apple-touch-icon.png (180x180)
const appleCanvas = createCanvas(180, 180);
const appleCtx = appleCanvas.getContext("2d");

// Same design for Apple touch icon
const appleGradient = appleCtx.createLinearGradient(0, 0, 180, 180);
appleGradient.addColorStop(0, "#3b82f6");
appleGradient.addColorStop(1, "#1d4ed8");

appleCtx.fillStyle = appleGradient;
appleCtx.fillRect(0, 0, 180, 180);

appleCtx.globalCompositeOperation = "destination-in";
appleCtx.beginPath();
appleCtx.roundRect(0, 0, 180, 180, 32);
appleCtx.fill();
appleCtx.globalCompositeOperation = "source-over";

// Draw camera icon for Apple
const appleCenterX = 90;
const appleCenterY = 90;
const appleIconSize = 72;

appleCtx.fillStyle = "white";
const appleBodyWidth = appleIconSize * 0.8;
const appleBodyHeight = appleIconSize * 0.6;
const appleBodyX = appleCenterX - appleBodyWidth / 2;
const appleBodyY = appleCenterY - appleBodyHeight / 2;

appleCtx.beginPath();
appleCtx.roundRect(appleBodyX, appleBodyY, appleBodyWidth, appleBodyHeight, 4);
appleCtx.fill();

appleCtx.fillStyle = "#1d4ed8";
appleCtx.beginPath();
appleCtx.arc(
  appleCenterX - appleBodyWidth * 0.15,
  appleCenterY,
  appleIconSize * 0.18,
  0,
  2 * Math.PI,
);
appleCtx.fill();

appleCtx.fillStyle = "#3b82f6";
appleCtx.beginPath();
appleCtx.arc(
  appleCenterX - appleBodyWidth * 0.15,
  appleCenterY,
  appleIconSize * 0.1,
  0,
  2 * Math.PI,
);
appleCtx.fill();

appleCtx.fillStyle = "#ef4444";
appleCtx.beginPath();
appleCtx.arc(
  appleCenterX + appleBodyWidth * 0.2,
  appleCenterY - appleBodyHeight * 0.15,
  appleIconSize * 0.08,
  0,
  2 * Math.PI,
);
appleCtx.fill();

const appleBuffer = appleCanvas.toBuffer("image/png");
fs.writeFileSync("./public/apple-touch-icon.png", appleBuffer);

console.log("Generated: ./public/apple-touch-icon.png");
console.log("✅ All PWA icons generated successfully!");
