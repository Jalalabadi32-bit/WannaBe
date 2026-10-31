// @vitest-environment jsdom
import './setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../App';

describe('App Dashboard Component', () => {
  beforeEach(() => {
    // Mock fetch to simulate offline / demo mode
    global.fetch = vi.fn().mockRejectedValue(new Error('API offline'));
  });

  it('renders header, brand, and default clean scan report', async () => {
    render(<App />);

    expect(screen.getAllByText('WANNABE').length).toBeGreaterThan(0);
    expect(screen.getByText(/CLEAN RELEASE/i)).toBeInTheDocument();
    expect(screen.getAllByText('left-pad').length).toBeGreaterThan(0);
    expect(screen.getByText(/All 6 files in published npm tarball match/i)).toBeInTheDocument();
  });

  it('switches between clean baseline and tampered package demos', async () => {
    render(<App />);

    // Click Tampered Package button
    const tamperedBtn = screen.getByText('Tampered Package');
    fireEvent.click(tamperedBtn);

    await waitFor(() => {
      expect(screen.getByText('CRITICAL THREAT')).toBeInTheDocument();
      expect(screen.getAllByText('flatmap-stream-tamper').length).toBeGreaterThan(0);
      expect(screen.getByText(/CRITICAL SUPPLY CHAIN ATTACK DETECTED/i)).toBeInTheDocument();
    });

    // Click Clean Baseline button
    const cleanBtn = screen.getByText('Clean Baseline');
    fireEvent.click(cleanBtn);

    await waitFor(() => {
      expect(screen.getByText('CLEAN RELEASE')).toBeInTheDocument();
      expect(screen.getAllByText('left-pad').length).toBeGreaterThan(0);
    });
  });

  it('navigates across tabs to view file tree and security findings', async () => {
    render(<App />);

    // Switch to Tampered demo so we have findings
    fireEvent.click(screen.getByText('Tampered Package'));

    // Switch to File Tree Tab
    const fileTreeTab = screen.getByText(/File Tree & Hashes/i);
    fireEvent.click(fileTreeTab);

    expect(screen.getByText('build/bootstrap.js')).toBeInTheDocument();
    expect(screen.getAllByText('Ghost / Added').length).toBeGreaterThan(0);

    // Switch to Security Anomalies Tab
    const findingsTab = screen.getByText(/AST & Entropy Flags/i);
    fireEvent.click(findingsTab);

    expect(screen.getByText(/Security Vulnerabilities & AST Detections/i)).toBeInTheDocument();
    expect(screen.getByText('SEC-001')).toBeInTheDocument();
  });
});
