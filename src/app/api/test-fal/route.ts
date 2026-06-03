import { NextResponse } from 'next/server';

export async function GET() {
  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) {
    return NextResponse.json({ error: 'FAL_KEY no configurada en env' });
  }

  const results: Record<string, any> = {};

  // 1. Probar balance
  try {
    const res = await fetch('https://api.fal.ai/v1/account/billing?expand=credits', {
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    results.billingStatus = res.status;
    results.billingData = await res.json();
  } catch (err: any) {
    results.billingError = err.message;
  }

  // 2. Probar Flux Schnell
  try {
    const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'a professional high-quality studio product photo of a blue shirt, solid white background',
        sync_mode: true
      }),
    });
    results.fluxStatus = res.status;
    results.fluxData = await res.json();
  } catch (err: any) {
    results.fluxError = err.message;
  }

  return NextResponse.json(results);
}
