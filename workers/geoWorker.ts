/**
 * Geometry Calculation Web Worker
 * 
 * This worker offloads heavy geoContains calculations from the main thread.
 * Per rules.md: Logic MUST NOT be deleted, only offloaded.
 */

// Import d3-geo functions (will be bundled by Next.js/Webpack)
import { geoContains, geoBounds } from 'd3-geo';

export interface GeoWorkerInput {
    type: 'CALCULATE_MATCHES';
    paths: Array<{
        code: string;
        name: string;
        featureGeometry: any; // GeoJSON geometry
    }>;
    stations: Array<{
        name: string;
        x: number;
        y: number;
        city_code?: string;
    }>;
}

export interface GeoWorkerOutput {
    type: 'CALCULATION_COMPLETE';
    results: Array<{
        code: string;
        matchedStations: string[];
        stationCount: number;
    }>;
    stationCityCodeMap: Record<string, string>;
    totalMatched: number;
}

// Message handler
self.onmessage = function (event: MessageEvent<GeoWorkerInput>) {
    const { type, paths, stations } = event.data;

    if (type !== 'CALCULATE_MATCHES') return;

    console.log(`[Worker] Starting calculation: ${paths.length} polygons, ${stations.length} stations`);

    const results: GeoWorkerOutput['results'] = [];
    const stationCityCodeMap: Record<string, string> = {};
    let totalMatched = 0;

    // Pre-process stations for performance
    const searchableStations = stations.map(s => ({
        ...s,
        _searchString: JSON.stringify(s).toLowerCase(),
        _validGeo: typeof s.x === 'number' && typeof s.y === 'number'
    }));

    for (const path of paths) {
        const matched: string[] = [];

        // 1. JIS Code Match (Fastest)
        if (path.code) {
            searchableStations
                .filter(s => s.city_code === path.code)
                .forEach(s => matched.push(s.name));
        }

        // 2. Geometry Match (BBOX + geoContains)
        // This is the HEAVY calculation - now safely in worker
        if (path.featureGeometry) {
            try {
                const feature = { type: 'Feature', geometry: path.featureGeometry };
                const bounds = geoBounds(feature as any);
                const [minLng, minLat] = bounds[0];
                const [maxLng, maxLat] = bounds[1];

                // BBOX filter first (lightweight)
                const candidates = searchableStations.filter(s => {
                    if (!s._validGeo) return false;
                    return s.x >= minLng && s.x <= maxLng && s.y >= minLat && s.y <= maxLat;
                });

                // Precise polygon check (heavy - but now in worker!)
                for (const s of candidates) {
                    if (geoContains(feature as any, [s.x, s.y])) {
                        if (!matched.includes(s.name)) {
                            matched.push(s.name);
                        }
                    }
                }
            } catch (e) {
                // Geometry error - skip this polygon
            }
        }

        // 3. Name Fallback
        if (matched.length === 0) {
            const terms = [path.name, path.name.replace(/[市区町村]/g, '')].filter(Boolean);
            searchableStations
                .filter(s => terms.some(t => s._searchString.includes(t.toLowerCase())))
                .forEach(s => {
                    if (!matched.includes(s.name)) matched.push(s.name);
                });
        }

        // Record matches
        matched.forEach(name => {
            stationCityCodeMap[name] = path.code;
        });

        const uniqueCount = new Set(matched).size;
        totalMatched += uniqueCount;

        results.push({
            code: path.code,
            matchedStations: matched,
            stationCount: uniqueCount
        });
    }

    console.log(`[Worker] Calculation complete: ${totalMatched} stations matched`);

    // Post results back to main thread
    const output: GeoWorkerOutput = {
        type: 'CALCULATION_COMPLETE',
        results,
        stationCityCodeMap,
        totalMatched
    };

    self.postMessage(output);
};
