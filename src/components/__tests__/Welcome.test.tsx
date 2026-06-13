import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Welcome } from '../Chat/Welcome';

describe('Welcome', () => {
  it('renders welcome message', () => {
    render(<Welcome />);
    expect(screen.getByText(/Hermes Chat/)).toBeInTheDocument();
    expect(screen.getByText('开始对话吧')).toBeInTheDocument();
  });
});
