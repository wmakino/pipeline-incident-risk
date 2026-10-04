import type { Consequence, Level, Product } from './types';

export const productLabel: Record<Product, string> = {
  crude_oil: 'Crude oil',
  sour_gas: 'Sour gas',
  sweet_gas: 'Sweet gas',
};

/** Token used for the product dot colour. */
export const productColor: Record<Product, string> = {
  crude_oil: 'var(--status-warning)',
  sour_gas: 'var(--status-high)',
  sweet_gas: 'var(--action-blue)',
};

export const consequenceLabel: Record<Consequence, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const consequenceColor: Record<Consequence, string> = {
  high: 'var(--status-high)',
  medium: 'var(--status-warning)',
  low: 'var(--status-low)',
};

export const levelLabel: Record<Level, string> = {
  5: 'Very high',
  4: 'High',
  3: 'Medium',
  2: 'Low',
  1: 'Very low',
};

export const levelColor = (l: Level) => `var(--incident-${l})`;
