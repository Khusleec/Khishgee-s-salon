// Бүх /api/* хүсэлт lib/api.ts дахь маршрутын хүснэгтээр дамжина.
import { dispatch, apiNotFound } from '@/lib/dispatch.ts';

async function handle(request: Request): Promise<Response> {
  return (await dispatch(request)) ?? apiNotFound();
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
