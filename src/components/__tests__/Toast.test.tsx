import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toast } from '../Toast/Toast';

describe('Toast', () => {
  it('renders nothing when message is null', () => {
    const { container } = render(<Toast message={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders toast message', () => {
    render(<Toast message="Hello" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
