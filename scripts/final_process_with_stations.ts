import fs from 'fs';
import path from 'path';
import { geoArea, geoContains } from 'd3-geo';

/**
 * Geometry-Safe GeoJSON Processing with Station Integration
 * Uses pre-built station master and moderate simplification
 */

// Load station master
const stationMasterPath = path.join(process.cwd(), 'src/data/station_master.json');
const stationMaster = JSON.parse(fs.readFileSync(stationMasterPath, 'utf-8'));

console.log(`Loaded station master: ${Object.keys(stationMaster).length} unique stations`);

// Douglas-Peucker (same as before)
function douglasPeucker(points: number[][], tolerance: number): number[][] {
    if (points.length <= 2) return points;
    let maxDistance = 0;
    let maxIndex = 0;
    const first = points[0];
    const last = points[points.length - 1];
    for (let i = 1; i < points.length - 1; i++) {
        const distance = perpendicularDistance(points[i], first, last);
        if (distance > maxDistance) {
            maxDistance = distance;
            maxIndex = i;
        }
    }
    if (maxDistance > tolerance) {
        const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
        const right = douglasPeucker(points.slice(maxIndex), tolerance);
        return [...left.slice(0, -1), ...right];
    }
    return [first, last];
}

function perpendicularDistance(point: number[], lineStart: number[], lineEnd: number[]): number {
    const [x, y] = point;
    const [x1, y1] = lineStart;
    const [x2, y2] = lineEnd;
    const numerator = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1);
    const denominator = Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2);
    return denominator === 0 ? 0 : numerator / denominator;
}

function simplifyRing(ring: number[][], tolerance: number): number[][] {
    if (ring.length < 4) return ring;
    const simplified = douglasPeucker(ring, tolerance);
    if (simplified[0][0] !== simplified[simplified.length - 1][0] ||
        simplified[0][1] !== simplified[simplified.length - 1][1]) {
        simplified.push([...simplified[0]]);
    }
    return simplified;
}

function simplifyGeometry(geometry: any, tolerance: number): any {
    if (!geometry || !geometry.coordinates) return geometry;
    const simplifyCoords = (coords: any, depth: number): any => {
        if (depth === 0) return coords;
        if (depth === 1) return simplifyRing(coords, tolerance);
        return coords.map((c: any) => simplifyCoords(c, depth - 1));
    };
    const newGeometry = { ...geometry };
    if (geometry.type === 'Polygon') {
        newGeometry.coordinates = simplifyCoords(geometry.coordinates, 2);
    } else if (geometry.type === 'MultiPolygon') {
        newGeometry.coordinates = simplifyCoords(geometry.coordinates, 3);
    }
    return newGeometry;
}

function reverseRing(ring: number[][]): number[][] {
    return [...ring].reverse();
}

function fixWindingOrder(geometry: any): any {
    if (!geometry || !geometry.coordinates) return geometry;
    const fixCoords = (coords: any, depth: number, shouldReverse: boolean): any => {
        if (depth === 0) return coords;
        if (depth === 1) return shouldReverse ? reverseRing(coords) : coords;
        return coords.map((c: any, idx: number) => {
            const reverse = depth === 2 ? (idx === 0 ? shouldReverse : !shouldReverse) : shouldReverse;
            return fixCoords(c, depth - 1, reverse);
        });
    };
    const newGeometry = { ...geometry };
    if (geometry.type === 'Polygon') {
        newGeometry.coordinates = fixCoords(geometry.coordinates, 2, true);
    } else if (geometry.type === 'MultiPolygon') {
        newGeometry.coordinates = fixCoords(geometry.coordinates, 3, true);
    }
    return newGeometry;
}

async function processFile(filePath: string, tolerance: number = 0.0001) {
    const prefCode = path.basename(filePath, '.json');
    console.log(`\n📍 Processing: ${prefCode}`);

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const originalSize = JSON.stringify(data).length;

    // Step 1: Fix winding + simplify
    console.log('  🔧 Geometry processing...');
    let windingFixed = 0;
    data.features = data.features.map((feature: any) => {
        const area = geoArea(feature);
        if (area > 2 * Math.PI) {
            feature.geometry = fixWindingOrder(feature.geometry);
            windingFixed++;
        }
        feature.geometry = simplifyGeometry(feature.geometry, tolerance);
        return feature;
    });

    // Step 2: Integrate station metadata
    console.log('  🚉 Integrating station metadata...');
    const prefStations = Object.values(stationMaster).filter((s: any) => s.prefCode === prefCode);

    let totalStations = 0;
    let stationAreas = 0;

    data.features.forEach((feature: any) => {
        const stationsInArea: any[] = [];
        const uniqueLines = new Set<string>();

        prefStations.forEach((station: any) => {
            try {
                // const point = { type: 'Point', coordinates: station.coordinates };
                if (geoContains(feature, station.coordinates)) {
                    stationsInArea.push(station);
                    station.lines.forEach((line: string) => uniqueLines.add(line));
                }
            } catch (e) {
                // Skip
            }
        });

        feature.properties.stationCount = stationsInArea.length;
        feature.properties.railwayLineCount = uniqueLines.size;
        feature.properties.hasStation = stationsInArea.length > 0;

        const density = stationsInArea.length;
        if (density === 0) feature.properties.densityTier = 0;
        else if (density <= 2) feature.properties.densityTier = 1;
        else if (density <= 5) feature.properties.densityTier = 2;
        else if (density <= 10) feature.properties.densityTier = 3;
        else feature.properties.densityTier = 4;

        if (stationsInArea.length > 0) {
            stationAreas++;
            totalStations += stationsInArea.length;
        }
    });

    const newSize = JSON.stringify(data).length;
    const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);

    fs.writeFileSync(filePath, JSON.stringify(data));

    console.log(`  ✅ Winding fixes: ${windingFixed}`);
    console.log(`  💾 Size: ${(originalSize / 1024).toFixed(1)}KB → ${(newSize / 1024).toFixed(1)}KB (${reduction}%)`);
    console.log(`  🚉 Stations: ${totalStations} in ${stationAreas}/${data.features.length} municipalities (${(stationAreas / data.features.length * 100).toFixed(1)}%)`);

    return {
        prefCode,
        features: data.features.length,
        windingFixed,
        originalSize,
        newSize,
        reduction: parseFloat(reduction),
        totalStations,
        stationAreas,
        coverage: (stationAreas / data.features.length * 100).toFixed(1)
    };
}

async function main() {
    const dataDir = path.join(process.cwd(), 'public/data');
    const files = fs.readdirSync(dataDir)
        .filter(f => f.match(/^\d{2}\.json$/))
        .sort()
        .map(f => path.join(dataDir, f));

    console.log('\n🚀 Geometry-Safe Processing with Station Integration');
    console.log('═'.repeat(80));
    console.log(`Processing ${files.length} prefectures\n`);

    const results = [];
    for (const file of files) {
        const result = await processFile(file);
        results.push(result);
    }

    console.log('\n\n📊 FINAL SUMMARY');
    console.log('═'.repeat(80));

    const totalStations = results.reduce((sum, r) => sum + r.totalStations, 0);
    const totalAreas = results.reduce((sum, r) => sum + r.stationAreas, 0);
    const totalMunicipalities = results.reduce((sum, r) => sum + r.features, 0);
    const avgCoverage = results.reduce((sum, r) => sum + parseFloat(r.coverage), 0) / results.length;
    const avgReduction = results.reduce((sum, r) => sum + r.reduction, 0) / results.length;

    console.log(`✅ Prefectures: ${results.length}/47`);
    console.log(`💾 Average Size Reduction: ${avgReduction.toFixed(1)}%`);
    console.log(`🚉 Total Stations: ${totalStations}`);
    console.log(`📍 Station Areas: ${totalAreas}/${totalMunicipalities}`);
    console.log(`📊 Average Coverage: ${avgCoverage.toFixed(1)}%`);
    console.log('═'.repeat(80));

    // Proof points
    console.log('\n🔍 PROOF POINTS:');
    const tokyo = results.find(r => r.prefCode === '13');
    const fukushima = results.find(r => r.prefCode === '07');

    if (tokyo) {
        console.log(`\n東京都 (13):`);
        console.log(`  Stations: ${tokyo.totalStations}`);
        console.log(`  Coverage: ${tokyo.stationAreas}/${tokyo.features} municipalities (${tokyo.coverage}%)`);
    }

    if (fukushima) {
        console.log(`\n福島県 (07):`);
        console.log(`  Stations: ${fukushima.totalStations}`);
        console.log(`  Coverage: ${fukushima.stationAreas}/${fukushima.features} municipalities (${fukushima.coverage}%)`);
    }

    fs.writeFileSync(
        path.join(process.cwd(), 'final_processing_report.json'),
        JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2)
    );

    console.log('\n✨ Processing complete!\n');
}

main();
