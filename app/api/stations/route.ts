import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('name') || searchParams.get('q') || '';

        // Read stations data
        const filePath = path.join(process.cwd(), 'public', 'data', 'stations.json');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const stationsData = JSON.parse(fileContent);

        // Convert stations object to array
        const stations = Object.values(stationsData);

        // If no query, return all stations (limited)
        if (!query) {
            return NextResponse.json({
                stations: stations.slice(0, 100)
            });
        }

        // Filter stations by name (case-insensitive)
        const normalizedQuery = query.toLowerCase();
        const filtered = stations.filter((station: any) => {
            const name = (station.name || '').toLowerCase();
            const kana = (station.kana || '').toLowerCase();
            return name.includes(normalizedQuery) || kana.includes(normalizedQuery);
        });

        // Sort by passenger volume (higher first)
        filtered.sort((a: any, b: any) => {
            const volA = a.passengerVolume || 0;
            const volB = b.passengerVolume || 0;
            return volB - volA;
        });

        return NextResponse.json({
            stations: filtered.slice(0, 50)
        });

    } catch (error) {
        console.error('[/api/stations] Error:', error);
        return NextResponse.json({
            error: 'Failed to fetch stations',
            stations: []
        }, { status: 500 });
    }
}
