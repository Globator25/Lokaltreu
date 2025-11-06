import type { components } from '@lokaltreu/types';
export type Problem = components['schemas'] extends never ? unknown : unknown;
console.log('api boot ok');
