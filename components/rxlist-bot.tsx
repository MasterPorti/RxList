"use client";

import { useEffect, useRef } from "react";

export default function RxlistBot({ emotion = "idle", size = 34 }: { emotion?: "idle" | "thinking" | "happy"; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    const pixels = 100;
    canvas.width = pixels * ratio;
    canvas.height = pixels * ratio;
    context.scale(ratio, ratio);
    let frame = 0;
    let animation = 0;
    const started = performance.now();

    const draw = (now: number) => {
      const t = (now - started) / 1000;
      const pulse = emotion === "thinking" ? Math.sin(t * 4) * 0.05 : Math.sin(t * 1.8) * 0.025;
      const bob = Math.sin(t * (emotion === "thinking" ? 3.4 : 1.45)) * (emotion === "thinking" ? 1.8 : 1.1);
      context.clearRect(0, 0, pixels, pixels);
      context.save();
      context.translate(50, 50 + bob);
      context.rotate(Math.sin(t * 0.8) * 0.018);
      context.shadowColor = "rgba(76, 234, 222, .38)";
      context.shadowBlur = 12;

      const glow = context.createRadialGradient(-13, -17, 3, 0, 0, 46);
      glow.addColorStop(0, "#74fff0");
      glow.addColorStop(.45, "#168f8a");
      glow.addColorStop(1, "#071f2b");
      context.fillStyle = glow;
      context.beginPath();
      for (let i = 0; i <= 36; i++) {
        const angle = (i / 36) * Math.PI * 2;
        const radius = 31 + Math.sin(angle * 4 + t * 1.8) * 2.3 + pulse * 18;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.closePath();
      context.fill();
      context.shadowBlur = 0;

      context.fillStyle = "rgba(4, 24, 37, .78)";
      context.beginPath();
      context.ellipse(0, 1, 22, 17, 0, 0, Math.PI * 2);
      context.fill();
      const eyeOffset = emotion === "thinking" ? Math.sin(t * 3) * 1.3 : 0;
      context.fillStyle = "#8ffff5";
      context.shadowColor = "#8ffff5";
      context.shadowBlur = 7;
      context.beginPath();
      context.arc(-9, -2 + eyeOffset, 3.2, 0, Math.PI * 2);
      context.arc(9, -2 - eyeOffset, 3.2, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = "rgba(143, 255, 245, .8)";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(0, 5, 7, .15, Math.PI - .15);
      context.stroke();
      context.restore();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [emotion]);

  return <canvas ref={canvasRef} className="rxlist-bot" width={100} height={100} style={{ width: size, height: size }} aria-hidden="true" />;
}
