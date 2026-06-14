interface SpeechBubbleProps {
  text: string;
  x: number;
  y: number;
  visible: boolean;
}

/** Pixel-art styled speech bubble overlay */
export function SpeechBubble({ text, x, y, visible }: SpeechBubbleProps) {
  if (!visible) return null;
  return (
    <div
      className="absolute pointer-events-none z-10"
      style={{ left: x, top: y, transform: 'translate(-50%, -100%)' }}
    >
      <div
        className="relative px-3 py-1.5 rounded text-xs font-mono whitespace-nowrap"
        style={{
          backgroundColor: '#FFFFFF',
          color: '#333333',
          border: '2px solid #333333',
          boxShadow: '2px 2px 0px #333333',
          imageRendering: 'pixelated',
        }}
      >
        {text}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: -8,
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '8px solid #333333',
          }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: -5,
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '6px solid #FFFFFF',
          }}
        />
      </div>
    </div>
  );
}
