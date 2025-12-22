import React from 'react';
import { expect, test } from 'vitest';
import { render } from '@testing-library/react';
import Page from './page';

test('should render', () => {
  const { getByText } = render(<Page />);
  const el = getByText(/Get started by editing/);
  expect(el).toBeTruthy();          // statt toBeInTheDocument
});
