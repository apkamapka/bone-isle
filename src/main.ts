import "./style.css";

const canvas = document.createElement("canvas");
canvas.width = 480;
canvas.height = 320;
canvas.style.imageRendering = "pixelated";
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d")!;
ctx.fillStyle = "#2e8f8a";
ctx.fillRect(0, 0, 480, 320);
ctx.fillStyle = "#6f9a44";
ctx.fillRect(120, 80, 240, 160);
