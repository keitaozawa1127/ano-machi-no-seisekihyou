import fs from 'fs';
import path from 'path';
import { geoArea } from 'd3-geo';

/**
 * Douglas-Peucker Algorithm Implementation
 * Simplifies a line by removing points that contribute less than tolerance to the shape
 */
function douglasPeucker(points: number[][], tolerance: number): number[][] {
    if (points.length <= 2) return points;

    // Find the point with maximum distance from line between first and last
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

    // If max distance is greater than tolerance, recursively simplify
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

/**
 * Simplify a single ring (array of coordinates)
 */
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

/**
 * Simplify geometry coordinates
 */
function simplifyGeometry(geometry: any, tolerance: number): any {
    if (!geometry || !geometry.coordinates) return geometry;

    const simplifyCoords = (coords: any, depth: number): any => {
        if (depth === 0) {
            // This is a coordinate pair
            return coords;
        } else if (depth === 1) {
            // This is a ring
            return simplifyRing(coords, tolerance);
        } else {
            // This is nested (MultiPolygon or Polygon with holes)
            return coords.map((c: any) => simplifyCoords(c, depth - 1));
        }
    };

    const newGeometry = { ...geometry };
    
    if (geometry.type === 'Polygon') {
        newGeometry.coordinates = simplifyCoords(geometry.coordinates, 2);
    } else if (geometry.type === 'MultiPolygon') {
        newGeometry.coordinates = simplifyCoords(geometry.coordinates, 3);
    }

    return newGeometry;
}

/**
 * Reverse coordinates for winding order fix
 */
function reverseRing(ring: number[][]): number[][] {
    return [...ring].reverse();
}

function fixWindingOrder(geometry: any): any {
    if (!geometry || !geometry.coordinates) return geometry;

    const fixCoords = (coords: any, depth: number, shouldReverse: boolean): any => {
        if (depth === 0) {
            return coords;
        } else if (depth === 1) {
            return shouldReverse ? reverseRing(coords) : coords;
        } else {
            return coords.map((c: any, idx: number) => {
                // For Polygon: outer ring should be counter-clockwise, holes clockwise
                // For MultiPolygon: each polygon follows same rule
                const reverse = depth === 2 ? (idx === 0 ? shouldReverse : !shouldReverse) : shouldReverse;
                return fixCoords(c, depth - 1, reverse);
            });
        }
    };

    const newGeometry = { ...geometry };
    
    if (geometry.type === 'Polygon') {
        newGeometry.coordinates = fixCoords(geometry.coordinates, 2, true);
    } else if (geometry.type === 'MultiPolygon') {
        newGeometry.coordinates = fixCoords(geometry.coordinates, 3, true);
    }

    return newGeometry;
}

/**
 * Process a single GeoJSON file
 */
async function processGeoJSON(filePath: string, tolerance: number = 0.001) {
    console.log(`Processing: ${path.basename(filePath)}`);
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const originalSize = JSON.stringify(data).length;
    let simplifiedCount = 0;
    let windingFixedCount = 0;

    // Process each feature
    data.features = data.features.map((feature: any) => {
        // Check and fix winding order
        const area = geoArea(feature);
        if (area > 2 * Math.PI) {
            feature.geometry = fixWindingOrder(feature.geometry);
            windingFixedCount++;
        }

        // Simplify geometry
        const originalCoordCount = JSON.stringify(feature.geometry.coordinates).length;
        feature.geometry = simplifyGeometry(feature.geometry, tolerance);
        const newCoordCount = JSON.stringify(feature.geometry.coordinates).length;
        
        if (newCoordCount < originalCoordCount) {
            simplifiedCount++;
        }

        return feature;
    });

    // Save processed file
    const newSize = JSON.stringify(data).length;
    const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);
    
    fs.writeFileSync(filePath, JSON.stringify(data));
    
    console.log(`  ✓ Simplified ${simplifiedCount}/${data.features.length} features`);
    console.log(`  ✓ Fixed winding order for ${windingFixedCount} features`);
    console.log(`  ✓ Size: ${(originalSize / 1024).toFixed(1)}KB → ${(newSize / 1024).toFixed(1)}KB (${reduction}% reduction)`);
    
    return {
        file: path.basename(filePath),
        features: data.features.length,
        simplified: simplifiedCount,
        windingFixed: windingFixedCount,
        originalSize,
        newSize,
        reduction: parseFloat(reduction)
    };
}

/**
 * Process all prefecture GeoJSON files
 */
async function processAllPrefectures() {
    const dataDir = path.join(process.cwd(), 'public/data');
    const files = fs.readdirSync(dataDir)
        .filter(f => f.match(/^\d{2}\.json$/))
        .map(f => path.join(dataDir, f));

    console.log(`\n🔧 Starting GeoJSON Processing for ${files.length} prefectures...\n`);

    const results = [];
    for (const file of files) {
        const result = await processGeoJSON(file);
        results.push(result);
    }

    // Summary
    console.log('\n📊 Processing Summary:');
    console.log('═'.repeat(80));
    
    const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalNew = results.reduce((sum, r) => sum + r.newSize, 0);
    const avgReduction = results.reduce((sum, r) => sum + r.reduction, 0) / results.length;
    const totalWindingFixed = results.reduce((sum, r) => sum + r.windingFixed, 0);
    
    console.log(`Total Files Processed: ${results.length}`);
    console.log(`Total Size Reduction: ${((totalOriginal - totalNew) / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Average Reduction: ${avgReduction.toFixed(1)}%`);
    console.log(`Winding Order Fixes: ${totalWindingFixed} features`);
    console.log('═'.repeat(80));
    
    // Save report
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            filesProcessed: results.length,
            totalOriginalSize: totalOriginal,
            totalNewSize: totalNew,
            totalReduction: totalOriginal - totalNew,
            averageReduction: avgReduction,
            windingOrderFixes: totalWindingFixed
        },
        details: results
    };
    
    fs.writeFileSync(
        path.join(process.cwd(), 'data_processing_report.json'),
        JSON.stringify(report, null, 2)
    );
    
    console.log('\n✅ Processing complete! Report saved to data_processing_report.json\n');
}

processAllPrefectures().catch(console.error);
