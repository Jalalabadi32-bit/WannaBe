// @vitest-environment jsdom
import './setup';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScanForm } from '../components/ScanForm';

describe('ScanForm Component', () => {
  it('renders input fields and submit button', () => {
    const handleScan = vi.fn();
    render(<ScanForm onScan={handleScan} isLoading={false} />);

    expect(screen.getByPlaceholderText(/left-pad/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 1.3.0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument();
  });

  it('displays validation error if required fields are missing', () => {
    const handleScan = vi.fn();
    render(<ScanForm onScan={handleScan} isLoading={false} />);

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    expect(screen.getByText(/package name is required/i)).toBeInTheDocument();
    expect(handleScan).not.toHaveBeenCalled();
  });

  it('auto-fills express sample on button click and submits successfully', () => {
    const handleScan = vi.fn();
    render(<ScanForm onScan={handleScan} isLoading={false} />);

    const autoFillBtn = screen.getByText(/auto-fill express/i);
    fireEvent.click(autoFillBtn);

    expect(screen.getByDisplayValue('express')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('4.18.2').length).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));
    expect(handleScan).toHaveBeenCalledWith({
      packageName: 'express',
      version: '4.18.2',
      repoUrl: 'https://github.com/expressjs/express',
      gitTag: '4.18.2'
    });
  });
});
