/**
 * BrowserVault OTP Email Dispatcher
 * Deployed as a Cloudflare Worker
 */

export interface Env {
  RESEND_API_KEY: string;
  SHARED_SECRET: string; // Used to authenticate requests from the extension
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/send-otp') {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Authenticate the request
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${env.SHARED_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    try {
      const body = await request.json() as { email: string; otp: string };

      if (!body.email || !body.otp) {
        return new Response(JSON.stringify({ error: 'Missing email or OTP' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      // Dispatch via Resend REST API
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'BrowserVault Security <security@your-domain.com>',
          to: [body.email],
          subject: 'Your BrowserVault Recovery Code',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4f46e5;">BrowserVault Recovery</h2>
              <p>You requested a one-time password (OTP) to recover your BrowserVault account.</p>
              <div style="background: #f3f4f6; padding: 16px; font-size: 24px; font-family: monospace; letter-spacing: 4px; text-align: center; border-radius: 8px; margin: 24px 0;">
                ${body.otp}
              </div>
              <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
            </div>
          `,
        }),
      });

      if (!resendRes.ok) {
        const errorText = await resendRes.text();
        console.error('Resend API Error:', errorText);
        return new Response(JSON.stringify({ error: 'Failed to send email' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  },
};
