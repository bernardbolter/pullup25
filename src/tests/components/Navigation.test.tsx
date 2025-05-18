import { render, screen } from '@testing-library/react';
import Navigation from '@/components/layout/Navigation';
import { usePathname } from 'next/navigation';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

describe('Navigation', () => {
  beforeEach(() => {
    (usePathname as jest.Mock).mockReturnValue('/');
  });

  it('renders the logo', () => {
    render(<Navigation />);
    expect(screen.getByText('The Pullup Gallery')).toBeInTheDocument();
  });

  it('renders all navigation links', () => {
    render(<Navigation />);
    expect(screen.getByText('Locations')).toBeInTheDocument();
    expect(screen.getByText('Artists')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('applies active class to current path', () => {
    (usePathname as jest.Mock).mockReturnValue('/locations');
    render(<Navigation />);
    const locationsLink = screen.getByText('Locations');
    expect(locationsLink.className).toContain('nav__link--active');
  });
}); 