import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:3000';

async function proxyRequest(req: NextRequest) {
  const url = new URL(req.url);
  // Strip /api/proxy prefix to get the real backend path
  const backendPath = url.pathname.replace(/^\/api\/proxy/, '');
  const target = `${BACKEND_URL}${backendPath}${url.search}`;

  const headers = new Headers();
  // Forward relevant headers
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const accept = req.headers.get('accept');
  headers.set('accept', accept || 'application/json');
  // Correlation id minted by apiFetch. Without forwarding it the backend logs a
  // different id than the browser saw, and a failed upload cannot be traced across
  // the two systems.
  const requestId = req.headers.get('x-request-id');
  if (requestId) headers.set('x-request-id', requestId);

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }

  try {
    const res = await fetch(target, init);
    const contentType = res.headers.get('content-type') || '';

    if (!contentType.includes('application/json') && !contentType.includes('+json')) {
      const body = await res.text();
      return NextResponse.json(
        {
          message: `Backend returned ${contentType || 'non-JSON'} for ${req.method} ${backendPath}`,
          status: res.status,
          target,
          body: body.slice(0, 500),
        },
        { status: res.status, headers: requestId ? { 'x-request-id': requestId } : undefined }
      );
    }

    const responseHeaders: Record<string, string> = {
      'content-type': contentType,
      'cache-control': 'no-store',
    };
    // Echo the id back so the client can log the exact value the backend used.
    const resRequestId = res.headers.get('x-request-id') || requestId;
    if (resRequestId) responseHeaders['x-request-id'] = resRequestId;

    return new NextResponse(await res.arrayBuffer(), {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { message: `Proxy error: ${message}` },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
