import { expect, test } from 'vitest';
import { render, screen  } from '@testing-library/react';
import Page from './page';
it('renders headline', () => {
  render(<Page />);
  expect(screen.getByRole('heading')).toBeTruthy();
});

test('should render', () => {
  const { getByText } = render(<Page />);
  expect(getByText(/Get started by editing/)).toBeInTheDocument();
});

