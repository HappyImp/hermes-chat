import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PixelOffice } from '../PixelOffice';
import type { Employee } from '@/types/employee';

const mockEmployees: Employee[] = [
  {
    name: '老财', role: 'AI操盘手', avatar: '💰',
    status: 'working', currentTask: '盘前研判', tasks: ['盘前研判'],
  },
  {
    name: '铁壳', role: 'AI运维', avatar: '🤖',
    status: 'standby', currentTask: '待命', tasks: ['运维'],
  },
  {
    name: '小K', role: 'AI情报', avatar: '🔍',
    status: 'working', currentTask: '早报', tasks: ['早报'],
  },
  {
    name: '404', role: 'AI开发', avatar: '💻',
    status: 'off', currentTask: '休息', tasks: ['开发'],
  },
  {
    name: '裁判君', role: 'AI审查', avatar: '⚖️',
    status: 'off', currentTask: '休息', tasks: ['审查'],
  },
];

/** Mock getContext to return a fake 2D context */
function mockGetContext() {
  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    textAlign: 'start',
    font: '',
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    mockCtx as unknown as CanvasRenderingContext2D,
  );
  return mockCtx;
}

describe('PixelOffice', () => {
  beforeEach(() => {
    mockGetContext();
  });

  it('renders the office header', () => {
    render(<PixelOffice employees={mockEmployees} onBack={vi.fn()} />);
    expect(screen.getByText(/像素办公室/)).toBeInTheDocument();
  });

  it('renders the back button', () => {
    render(<PixelOffice employees={mockEmployees} onBack={vi.fn()} />);
    expect(screen.getByTitle('返回面板')).toBeInTheDocument();
  });

  it('calls onBack when back button clicked', () => {
    const onBack = vi.fn();
    render(<PixelOffice employees={mockEmployees} onBack={onBack} />);
    fireEvent.click(screen.getByTitle('返回面板'));
    expect(onBack).toHaveBeenCalled();
  });

  it('renders a canvas element', () => {
    const { container } = render(
      <PixelOffice employees={mockEmployees} onBack={vi.fn()} />,
    );
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('canvas has pixelated rendering style', () => {
    const { container } = render(
      <PixelOffice employees={mockEmployees} onBack={vi.fn()} />,
    );
    const canvas = container.querySelector('canvas');
    expect(canvas?.style.imageRendering).toBe('pixelated');
  });
});
