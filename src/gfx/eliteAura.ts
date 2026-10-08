/**
 * The elite's mark (Etap 73): a pulsing gold ring at a creature's feet and a
 * few motes rising off it. Drawing only — moved out of systems/elite.ts in
 * Etap 3.1b, which says WHICH creatures are elite and leaves how that looks
 * to the client.
 */
export function drawEliteAura(ctx: CanvasRenderingContext2D, sx: number, sy: number, t: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.save();
  ctx.globalAlpha = 0.3 + 0.35 * pulse;
  ctx.strokeStyle = "#ffd23a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(sx, sy, 15 + pulse * 2, 6 + pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ffe98a";
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.6 + i / 3) % 1;
    ctx.globalAlpha = 0.8 * (1 - ph);
    const mx = sx + Math.sin(i * 2.1 + t * 1.7) * 10;
    const my = sy - 4 - ph * 26;
    ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 1, 2, 2);
  }
  ctx.restore();
}
