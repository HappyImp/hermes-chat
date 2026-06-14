import { useRef, useEffect, useState, useCallback } from 'react';
import type { Employee } from '@/types/employee';
import { drawImageSprite, fillWithTile } from './pixelArt';
import { loadOfficeSprites, type OfficeSprites } from './spriteLoader';
import {
  getAnimationState,
  getImageForState,
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

/** Draw the wall background using tile image */
function drawWall(
  ctx: CanvasRenderingContext2D,
  w: number,
  wallH: number,
  scale: number,
  tile: HTMLImageElement,
): void {
  fillWithTile(ctx, tile, 0, 0, w, wallH, scale);
}

/** Draw a window on the wall */
function drawWindowSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  img: HTMLImageElement,
): void {
  drawImageSprite(ctx, img, x, y, scale);
}

/** Draw a complete workstation (desk + monitor + chair) */
function drawWorkstation(
  ctx: CanvasRenderingContext2D,
  lx: number,
  ly: number,
  scale: number,
  sprites: OfficeSprites,
): void {
  drawImageSprite(ctx, sprites.desk, lx, ly, scale);
  drawImageSprite(ctx, sprites.chair, lx + 14, ly + 18, scale);
}

/** Draw status indicator dot above character */
function drawStatusDot(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  status: Employee['status'],
  frame: number,
  scale: number,
  sprites: OfficeSprites,
): void {
  const statusImg = status === 'working'
    ? sprites.statusWorking
    : status === 'standby'
      ? sprites.statusStandby
      : sprites.statusOff;
  const alpha = status === 'off' ? 0.4 : 0.5 + 0.5 * Math.sin(frame * 0.15);
  ctx.globalAlpha = alpha;
  drawImageSprite(ctx, statusImg, cx, cy, scale);
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
  ctx.fillStyle = '#FFFFFF';
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
  const [sprites, setSprites] = useState<OfficeSprites | null>(null);

  /** Load sprites once on mount */
  useEffect(() => {
    loadOfficeSprites().then(setSprites).catch(console.error);
  }, []);

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
    if (!canvas || !sprites) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = canvasSize;
    canvas.width = w;
    canvas.height = h;
    const scale = calcScale(w);
    const layouts = getDeskLayouts(w / scale, h / scale);

    if (!sprites) return;
    const sp = sprites;
    function render(): void {
      if (!ctx) return;
      frameRef.current++;
      const frame = frameRef.current;
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = false;

      // Background: tiled wall + floor
      const wallH = 12 * scale;
      drawWall(ctx, w, wallH, scale, sp.wallTile);
      fillWithTile(ctx, sp.floorTile, 0, wallH, w, h - wallH, scale);

      // Windows on wall
      drawWindowSprite(ctx, w * 0.18, scale * 2, scale, sp.window);
      drawWindowSprite(ctx, w * 0.58, scale * 2, scale, sp.window);

      // Draw each workstation + character
      layouts.forEach((desk, i) => {
        const emp = employees[i];
        if (!emp) return;
        drawWorkstation(ctx, desk.x, desk.y, scale, sp);

        const animState = getAnimationState(emp.status, frame);
        const charImg = getImageForState(animState, sp);

        if (charImg) {
          const charX = desk.x + 8;
          const charY = desk.y + 8;
          drawImageSprite(ctx, charImg, charX, charY, scale);
          drawStatusDot(
            ctx, charX + 12, charY - 2, emp.status, frame, scale, sp,
          );
        } else {
          // Empty desk — show coffee cup
          drawImageSprite(ctx, sp.coffee, desk.x + 18, desk.y + 12, scale);
        }

        drawLabel(ctx, desk.label, desk.x + 12, desk.y + 40, scale);
      });

      animRef.current = requestAnimationFrame(render);
    }

    render();
    return () => cancelAnimationFrame(animRef.current);
  }, [canvasSize, employees, sprites]);

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
