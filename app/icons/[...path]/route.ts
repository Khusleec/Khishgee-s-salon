// PWA дүрс — /icons/icon-:size.png, /icons/maskable-:size.png (кодоор зурагдана)
import { dispatch } from '@/lib/dispatch.ts';

export async function GET(request: Request): Promise<Response> {
  return (await dispatch(request)) ?? new Response('Not found', { status: 404 });
}
