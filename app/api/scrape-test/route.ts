import { ModoScraper } from '@/lib/scrapers/modo';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const promos = await ModoScraper.run();
        return NextResponse.json({ count: promos.length, promos });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}