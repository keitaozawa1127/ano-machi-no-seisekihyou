import fs from 'fs';
import path from 'path';
import { geoArea, geoContains, geoCentroid } from 'd3-geo';

/**
 * Enhanced GeoJSON Processing Script
 * - Douglas-Peucker coordinate simplification
 * - Winding order normalization
 * - Station metadata integration (count + railway lines)
 * - Performance metrics collection
 */

// ============================================================================
// DOUGLAS-PEUCKER SIMPLIFICATION
// ============================================================================

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
    } else {
        return [first, last];
    }
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

    // Ensure ring is closed
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

// ============================================================================
// WINDING ORDER FIX
// ============================================================================

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

// ============================================================================
// STATION METADATA INTEGRATION
// ============================================================================

interface Station {
    name: string;
    line: string;
    lon: number;
    lat: number;
}

async function fetchStationsForPrefecture(prefCode: string): Promise<Station[]> {
    try {
        const url = `https://express.heartrails.com/api/json?method=getStations&prefecture=${getPrefectureName(prefCode)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.response && data.response.station) {
            return data.response.station.map((s: any) => ({
                name: s.name,
                line: s.line,
                lon: parseFloat(s.x),
                lat: parseFloat(s.y)
            }));
        }
        return [];
    } catch (error) {
        console.error(`  ⚠️  Failed to fetch stations for ${prefCode}:`, error);
        return [];
    }
}

function getPrefectureName(code: string): string {
    const names: { [key: string]: string } = {
        '01': '北海道', '02': '青森県', '03': '岩手県', '04': '宮城県', '05': '秋田県',
        '06': '山形県', '07': '福島県', '08': '茨城県', '09': '栃木県', '10': '群馬県',
        '11': '埼玉県', '12': '千葉県', '13': '東京都', '14': '神奈川県', '15': '新潟県',
        '16': '富山県', '17': '石川県', '18': '福井県', '19': '山梨県', '20': '長野県',
        '21': '岐阜県', '22': '静岡県', '23': '愛知県', '24': '三重県', '25': '滋賀県',
        '26': '京都府', '27': '大阪府', '28': '兵庫県', '29': '奈良県', '30': '和歌山県',
        '31': '鳥取県', '32': '島根県', '33': '岡山県', '34': '広島県', '35': '山口県',
        '36': '徳島県', '37': '香川県', '38': '愛媛県', '39': '高知県', '40': '福岡県',
        '41': '佐賀県', '42': '長崎県', '43': '熊本県', '44': '大分県', '45': '宮崎県',
        '46': '鹿児島県', '47': '沖縄県'
    };
    return names[code] || '';
}

function integrateStationMetadata(geoData: any, stations: Station[]): any {
    geoData.features.forEach((feature: any) => {
        const stationsInArea: Station[] = [];
        const uniqueLines = new Set<string>();

        stations.forEach(station => {
            // const point = { type: 'Point', coordinates: [station.lon, station.lat] };
            if (geoContains(feature, [station.lon, station.lat])) {
                stationsInArea.push(station);
                uniqueLines.add(station.line);
            }
        });

        // Enhanced metadata
        feature.properties.stationCount = stationsInArea.length;
        feature.properties.railwayLineCount = uniqueLines.size;
        feature.properties.hasStation = stationsInArea.length > 0;

        // Calculate density tier (0-4) for choropleth
        const density = stationsInArea.length;
        if (density === 0) feature.properties.densityTier = 0;
        else if (density <= 2) feature.properties.densityTier = 1;
        else if (density <= 5) feature.properties.densityTier = 2;
        else if (density <= 10) feature.properties.densityTier = 3;
        else feature.properties.densityTier = 4;
    });

    return geoData;
}

// ============================================================================
// MAIN PROCESSING FUNCTION
// ============================================================================

async function processGeoJSON(filePath: string, tolerance: number = 0.0008) {
    const prefCode = path.basename(filePath, '.json');
    console.log(`\n📍 Processing: ${prefCode} - ${getPrefectureName(prefCode)}`);

    const startTime = Date.now();

    // Load original data
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const originalSize = JSON.stringify(data).length;
    const originalCoordCount = countCoordinates(data);

    let simplifiedCount = 0;
    let windingFixedCount = 0;

    // Step 1: Fix winding order and simplify
    console.log('  🔧 Simplifying geometry...');
    data.features = data.features.map((feature: any) => {
        // Check and fix winding order
        const area = geoArea(feature);
        if (area > 2 * Math.PI) {
            feature.geometry = fixWindingOrder(feature.geometry);
            windingFixedCount++;
        }

        // Simplify geometry
        const originalCoords = JSON.stringify(feature.geometry.coordinates).length;
        feature.geometry = simplifyGeometry(feature.geometry, tolerance);
        const newCoords = JSON.stringify(feature.geometry.coordinates).length;

        if (newCoords < originalCoords) simplifiedCount++;

        return feature;
    });

    // Step 2: Fetch and integrate station metadata
    console.log('  🚉 Fetching station data...');
    const stations = await fetchStationsForPrefecture(prefCode);
    integrateStationMetadata(data, stations);

    const stationAreas = data.features.filter((f: any) => f.properties.hasStation).length;
    const totalStations = data.features.reduce((sum: number, f: any) => sum + (f.properties.stationCount || 0), 0);

    // Save processed file
    const newSize = JSON.stringify(data).length;
    const newCoordCount = countCoordinates(data);
    const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);
    const coordReduction = ((originalCoordCount - newCoordCount) / originalCoordCount * 100).toFixed(1);

    fs.writeFileSync(filePath, JSON.stringify(data));

    const processingTime = Date.now() - startTime;

    console.log(`  ✅ Complete in ${processingTime}ms`);
    console.log(`  📊 Simplified: ${simplifiedCount}/${data.features.length} features`);
    console.log(`  🔄 Winding fixes: ${windingFixedCount} features`);
    console.log(`  📏 Coordinates: ${originalCoordCount} → ${newCoordCount} (${coordReduction}% reduction)`);
    console.log(`  💾 Size: ${(originalSize / 1024).toFixed(1)}KB → ${(newSize / 1024).toFixed(1)}KB (${reduction}% reduction)`);
    console.log(`  🚉 Stations: ${totalStations} stations in ${stationAreas} municipalities`);

    return {
        prefCode,
        prefName: getPrefectureName(prefCode),
        features: data.features.length,
        simplified: simplifiedCount,
        windingFixed: windingFixedCount,
        originalSize,
        newSize,
        reduction: parseFloat(reduction),
        originalCoordCount,
        newCoordCount,
        coordReduction: parseFloat(coordReduction),
        stationCount: totalStations,
        stationAreas,
        processingTime
    };
}

function countCoordinates(geoData: any): number {
    let count = 0;
    const countInCoords = (coords: any): void => {
        if (Array.isArray(coords[0])) {
            coords.forEach(countInCoords);
        } else {
            count++;
        }
    };
    geoData.features.forEach((f: any) => countInCoords(f.geometry.coordinates));
    return count;
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

async function processAllPrefectures() {
    const dataDir = path.join(process.cwd(), 'public/data');
    const files = fs.readdirSync(dataDir)
        .filter(f => f.match(/^\d{2}\.json$/))
        .sort()
        .map(f => path.join(dataDir, f));

    console.log('\n🚀 Starting Enhanced GeoJSON Processing');
    console.log('═'.repeat(80));
    console.log(`📁 Processing ${files.length} prefecture files`);
    console.log('═'.repeat(80));

    const results = [];
    for (const file of files) {
        const result = await processGeoJSON(file);
        results.push(result);

        // Rate limiting for API calls
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Generate summary report
    console.log('\n\n📊 PROCESSING SUMMARY');
    console.log('═'.repeat(80));

    const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalNew = results.reduce((sum, r) => sum + r.newSize, 0);
    const avgReduction = results.reduce((sum, r) => sum + r.reduction, 0) / results.length;
    const totalCoordReduction = results.reduce((sum, r) => sum + r.coordReduction, 0) / results.length;
    const totalStations = results.reduce((sum, r) => sum + r.stationCount, 0);
    const totalWindingFixed = results.reduce((sum, r) => sum + r.windingFixed, 0);
    const avgProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;

    console.log(`✅ Files Processed: ${results.length}/47`);
    console.log(`💾 Total Size: ${(totalOriginal / 1024 / 1024).toFixed(2)}MB → ${(totalNew / 1024 / 1024).toFixed(2)}MB`);
    console.log(`📉 Average Reduction: ${avgReduction.toFixed(1)}% (file size), ${totalCoordReduction.toFixed(1)}% (coordinates)`);
    console.log(`🔄 Winding Order Fixes: ${totalWindingFixed} features`);
    console.log(`🚉 Total Stations Integrated: ${totalStations}`);
    console.log(`⏱️  Average Processing Time: ${avgProcessingTime.toFixed(0)}ms per prefecture`);
    console.log('═'.repeat(80));

    // Save detailed report
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            filesProcessed: results.length,
            totalOriginalSize: totalOriginal,
            totalNewSize: totalNew,
            totalReduction: totalOriginal - totalNew,
            averageReduction: avgReduction,
            averageCoordReduction: totalCoordReduction,
            windingOrderFixes: totalWindingFixed,
            totalStations,
            averageProcessingTime: avgProcessingTime
        },
        details: results
    };

    const reportPath = path.join(process.cwd(), 'data_processing_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📄 Detailed report saved: ${reportPath}`);
    console.log('\n✨ Phase 1 Complete!\n');
}

// Execute
processAllPrefectures().catch(console.error);
