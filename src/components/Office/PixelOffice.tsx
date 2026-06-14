import { useRef, useEffect, useState, useCallback } from 'react';
import type { Employee } from '@/types/employee';
import { PALETTE, createFloorPattern, drawSprite } from './pixelArt';
import {
  DESK_SPRITE,
  MONITOR_SPRITE,
  CHAIR_SPRITE,
  COFFEE_SPRITE,
} from './sprites';
import {
  getAnimationState,
  getSpriteForState,
  getDeskLayouts,
  calcScale,
  type DeskLayout,
} from './officeLayout';
import { SpeechBubble } from './SpeechBubble';

interface PixelOfficeProps {
  employees: Employee[];
  onBack: () => void;
}

interface BubbleState {
  index: number;
  x: number;
  y: number;
  text: string;
  visible: boolean;
}

/** Draw the wall background */
function drawWall(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scale: number,
): void {
  const wallH = 12 * scale;
  ctx.fillStyle = PALETTE.wall;
  ctx.fillRect(0, 0, w, wallH);
  ctx.fillStyle = PALETTE.wallLight;
  ctx.fillRect(0, 0, w, scale * 2);
  ctx.fillStyle = PALETTE.wallDark;
  ctx.fillRect(0, wallH - scale * 2, w, scale * 2);
}

/** Draw a window on the wall */
function drawWindow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
): void {
  const w = 16 * scale;
  const h = 10 * scale;
  ctx.fillStyle = PALETTE.wallDark;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#AADDFF';
  ctx.fillRect(x + scale, y + scale, w - 2 * scale, h - 2 * scale);
  ctx.strokeStyle = PALETTE.wallDark;
  ctx.lineWidth = scale;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();
}

/** Draw a complete workstation (desk + monitor + chair) */
function drawWorkstation(
  ctx: CanvasRenderingContext2D,
  lx: number,
  ly: number,
  scale: number,
): void {
  drawSprite(ctx, DESK_SPRITE, lx, ly + 10, scale);
  drawSprite(ctx, MONITOR_SPRITE, lx + 6, ly + 2, scale);
  drawSprite(ctx, CHAIR_SPRITE, lx + 7, ly + 22, scale);
}

/** Draw status indicator dot above character */
function drawStatusDot(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  status: Employee['status'],
  frame: number,
  scale: number,
): void {
  const colors = {
    working: PALETTE.statusGreen,
    standby: PALETTE.statusYellow,
    off: PALETTE.statusGray,
  };
  const alpha = 0.5 + 0.5 * Math.sin(frame * 0.15);
  ctx.globalAlpha = status === 'off' ? 0.4 : alpha;
  ctx.fillStyle = colors[status];
  ctx.beginPath();
  ctx.arc(cx * scale, cy * scale, 2 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Draw name label below workstation */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  scale: number,
): void {
  ctx.fillStyle = PALETTE.white;
  ctx.font = `bold ${scale * 3}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(text, cx * scale, y * scale);
}

/** Check if click is within a desk hitbox */
function hitTestDesk(
  clickX: number,
  clickY: number,
  desk: DeskLayout,
  scale: number,
): boolean {
  const w = 24 * scale;
  const h = 36 * scale;
  return (
    clickX >= desk.x * scale &&
    clickX <= desk.x * scale + w &&
    clickY >= desk.y * scale &&
    clickY <= desk.y * scale + h
  );
}

export function PixelOffice({ employees, onBack }: PixelOfficeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const animRef = useRef<number>(0);
  const [canvasSize, setCanvasSize] = useState({ w: 600, h: 400 });
  const [bubble, setBubble] = useState<BubbleState>({
    index: -1, x: 0, y: 0, text: '', visible: false,
  });

  /** Handle window resize */
  const handleResize = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(Math.max(300, rect.height));
    setCanvasSize({ w, h });
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  /** Main render loop */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = canvasSize;
    canvas.width = w;
    canvas.height = h;
    const scale = calcScale(w);
    const layouts = getDeskLayouts(w / scale, h / scale);

    function render(): void {
      if (!ctx) return;
      frameRef.current++;
      const frame = frameRef.current;
      ctx.clearRect(0, 0, w, h);

      // Background
      drawWall(ctx, w, h, scale);
      createFloorPattern(ctx, w / scale, h / scale, scale);

      // Windows on wall
      drawWindow(ctx, w * 0.2, scale, scale);
      drawWindow(ctx, w * 0.6, scale, scale);

      // Draw each workstation + character
      layouts.forEach((desk, i) => {
        const emp = employees[i];
        if (!emp) return;
        drawWorkstation(ctx, desk.x, desk.y, scale);

        const animState = getAnimationState(emp.status, frame);
        const sprite = getSpriteForState(animState);

        // Draw character
        if (sprite) {
          const charX = desk.x + 4;
          const charY = desk.y + 20;
          drawSprite(ctx, sprite, charX, charY, scale);
          drawStatusDot(
            ctx, charX + 8, charY - 2, emp.status, frame, scale,
          );
        } else {
          // Empty chair pulled out
          drawSprite(ctx, COFFEE_SPRITE, desk.x + 20, desk.y + 26, scale);
        }

        drawLabel(ctx, desk.label, desk.x + 12, desk.y + 40, scale);
      });

      animRef.current = requestAnimationFrame(render);
    }

    render();
    return () => cancelAnimationFrame(animRef.current);
  }, [canvasSize, employees]);

  /** Handle canvas click → show bubble */
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const scale = calcScale(canvasSize.w);
      const layouts = getDeskLayouts(canvasSize.w / scale, canvasSize.h / scale);

      const hitIndex = layouts.findIndex(
        (d) => hitTestDesk(clickX, clickY, d, scale),
      );
      if (hitIndex < 0) {
        setBubble((prev) => ({ ...prev, visible: false }));
        return;
      }

      const emp = employees[hitIndex];
      const desk = layouts[hitIndex];
      if (!emp) return;

      const statusIcon = emp.status === 'working' ? '🟢' : emp.status === 'standby' ? '🟡' : '⚪';
      setBubble({
        index: hitIndex,
        x: (desk.x + 12) * scale,
        y: (desk.y - 2) * scale,
        text: `${statusIcon} ${emp.currentTask}`,
        visible: true,
      });
    },
    [canvasSize, employees],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold text-text">
          🏢 像素办公室
        </span>
        <button
          onClick={onBack}
          className="text-text2 bg-transparent border-none cursor-pointer hover:text-text text-sm"
          title="返回面板"
        >
          ← 返回面板
        </button>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        style={{ imageRendering: 'pixelated' }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-pointer"
          onClick={handleCanvasClick}
          style={{ imageRendering: 'pixelated' }}
        />
        <SpeechBubble
          text={bubble.text}
          x={bubble.x}
          y={bubble.y}
          visible={bubble.visible}
        />
      </div>
    </div>
  );
}
