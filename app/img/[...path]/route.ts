// Барааны SVG (/img/p/:id.svg, /img/preview.svg) ба байршуулсан зураг (/img/u/:file)
import { dispatch } from '@/lib/dispatch.ts';

export async function GET(request: Request): Promise<Response> {
  return (await dispatch(request)) ?? new Response('Not found', { status: 404 });
}
