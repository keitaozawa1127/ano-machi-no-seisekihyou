
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'public/data');

const calculateBounds = (features: any[]) => {
    let minLat = 90, maxLat = -90;
    let minLon = 180, maxLon = -180;

    const traverse = (coords: any[]) => {
        if (typeof coords[0] === 'number') {
            const lon = coords[0];
            const lat = coords[1];
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        } else {
            coords.forEach(c => traverse(c));
        }
    };

    features.forEach(f => {
        traverse(f.geometry.coordinates);
    });

    return { minLat, maxLat, minLon, maxLon, height: maxLat - minLat, width: maxLon - minLon };
};

const verify = (prefCode: string, name: string, filterFn: (f: any) => boolean) => {
    const file = path.join(dataDir, `${prefCode}.json`);
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const originalCount = data.features.length;
    const originalBounds = calculateBounds(data.features);

    console.log(`\n=== ${name} (${prefCode}) ===`);
    console.log(`Original: ${originalCount} features`);
    console.log(`Bounds: Lat ${originalBounds.minLat.toFixed(2)} - ${originalBounds.maxLat.toFixed(2)} (H: ${originalBounds.height.toFixed(2)})`);

    const filtered = data.features.filter((f: any) => {
        // Simplified Poly check for filter (same as InteractiveMap)
        const coords = f.geometry.type === "MultiPolygon"
            ? f.geometry.coordinates[0][0][0]
            : f.geometry.coordinates[0][0];
        // Note: InteractiveMap uses coords[1] for Lat, coords[0] for Lon.
        return filterFn({ ...f, firstPoint: coords }); // Pass pre-calc for easier testing logic match
    });

    if (filtered.length === 0) {
        console.error(`[FAIL] Filter removed ALL features!`);
        return;
    }

    const newBounds = calculateBounds(filtered);
    console.log(`Filtered: ${filtered.length} features`);
    console.log(`Bounds: Lat ${newBounds.minLat.toFixed(2)} - ${newBounds.maxLat.toFixed(2)} (H: ${newBounds.height.toFixed(2)})`);

    // improvement metric
    const compression = originalBounds.height / newBounds.height;
    console.log(`Zoom Improvement: ${compression.toFixed(1)}x tighter vertical bounds`);

    if (compression > 1.2) {
        console.log(`[PASS] Significant Zoom Detected.`);
    } else {
        console.log(`[WARN] No significant zoom change.`);
    }
};

// Tokyo Filter: Lat > 35.0
verify("13", "Tokyo", (f) => f.firstPoint[1] > 35.0);

// Okinawa Filter: Lon > 127.5 && Lat > 26.0
verify("47", "Okinawa", (f) => f.firstPoint[0] > 127.5 && f.firstPoint[1] > 26.0);
