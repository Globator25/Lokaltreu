import type { components } from '@lokaltreu/types';
type Problem = components['schemas']['Problem'];
export function problem(p: Problem) {
  return {
    toResponse(): Response {
      return new Response(JSON.stringify(p), {
        status: p.status ?? 500,
        headers: { 'content-type': 'application/problem+json' }
      });
    }
  };
}
