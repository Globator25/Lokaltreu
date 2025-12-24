// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { render } from '@testing-library/react';
import Page from './page';
import React from "react";

test('should render', () => {
  const { getByText } = render(<Page />);
  expect(getByText(/Get started by editing/)).toBeInTheDocument();
});