// @vitest-environment jsdom
import './setup';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskMeter } from '../components/RiskMeter';

describe('RiskMeter Component', () => {
  it('renders clean release state for score 0', () => {
    render(<RiskMeter score={0} level="clean" />);
    expect(screen.getByText('CLEAN RELEASE')).toBeInTheDocument();
    expect(screen.getByText('clean Risk Tier')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders suspicious release state for score 45', () => {
    render(<RiskMeter score={45} level="suspicious" />);
    expect(screen.getByText('SUSPICIOUS RELEASE')).toBeInTheDocument();
    expect(screen.getByText('suspicious Risk Tier')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('renders critical threat state for score 96', () => {
    render(<RiskMeter score={96} level="critical" />);
    expect(screen.getByText('CRITICAL THREAT')).toBeInTheDocument();
    expect(screen.getByText('critical Risk Tier')).toBeInTheDocument();
    expect(screen.getByText('96')).toBeInTheDocument();
  });
});
