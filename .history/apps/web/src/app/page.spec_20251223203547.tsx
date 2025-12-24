import { expect, test } from 'vitest';
import { render } from '@testing-library/react';
import Page from './page';

test('should render', () => {
  const { getByText } = render(<Page />);
  expect(getByText(/Get started by editing/)).toBeInTheDocument();
});