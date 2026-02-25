import zlib from 'zlib';

export class PngDecoder {
    width: number = 0;
    height: number = 0;
    data: Buffer | null = null;

    private colorType: number = 0;
    private palette: Buffer | null = null;
    // private hasAlpha: boolean = false; 

    static parse(buffer: Buffer): PngDecoder {
        const decoder = new PngDecoder();
        decoder.decode(buffer);
        return decoder;
    }

    getPixel(x: number, y: number): { r: number, g: number, b: number, a: number } {
        if (!this.data || x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return { r: 0, g: 0, b: 0, a: 0 };
        }
        const idx = (y * this.width + x) * 4;
        return {
            r: this.data[idx],
            g: this.data[idx + 1],
            b: this.data[idx + 2],
            a: this.data[idx + 3]
        };
    }

    private decode(buffer: Buffer) {
        if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
            throw new Error('Invalid PNG Signature');
        }

        let pos = 8;
        let idatChunks: Buffer[] = [];

        while (pos < buffer.length) {
            const len = buffer.readUInt32BE(pos);
            const type = buffer.toString('ascii', pos + 4, pos + 8);
            const chunkData = buffer.subarray(pos + 8, pos + 8 + len);

            if (type === 'IHDR') {
                this.width = chunkData.readUInt32BE(0);
                this.height = chunkData.readUInt32BE(4);
                const depth = chunkData[8];
                this.colorType = chunkData[9];
                const interlace = chunkData[12];

                if (depth !== 8) throw new Error(`Unsupported bit depth: ${depth}`);
                if (interlace !== 0) throw new Error('Interlaced PNG not supported');
            } else if (type === 'PLTE') {
                this.palette = chunkData;
            } else if (type === 'IDAT') {
                idatChunks.push(chunkData);
            } else if (type === 'IEND') {
                break;
            }
            pos += 8 + len + 4; // Chunk + CRC
        }

        if (idatChunks.length === 0) throw new Error("No IDAT chunks");
        const compressed = Buffer.concat(idatChunks);
        const inflated = zlib.inflateSync(compressed);

        this.processScanlines(inflated);
    }

    private processScanlines(inflated: Buffer) {
        let bpp = 0;
        if (this.colorType === 2) bpp = 3; // RGB
        else if (this.colorType === 6) bpp = 4; // RGBA
        else if (this.colorType === 3) bpp = 1; // Indexed
        else throw new Error(`Unsupported color type: ${this.colorType}`);

        const rowSize = 1 + this.width * bpp;
        const result = Buffer.alloc(this.width * this.height * 4); // Output RGBA

        let prevRow = Buffer.alloc(this.width * bpp, 0);
        let offset = 0;

        for (let y = 0; y < this.height; y++) {
            if (offset >= inflated.length) break;

            const filterType = inflated[offset];
            const scanline = inflated.subarray(offset + 1, offset + 1 + this.width * bpp);
            const currentRow = Buffer.alloc(this.width * bpp);

            for (let i = 0; i < this.width * bpp; i++) {
                let byte = scanline[i];
                let prevByte = i >= bpp ? currentRow[i - bpp] : 0;
                let upByte = prevRow[i];
                let upLeftByte = i >= bpp ? prevRow[i - bpp] : 0;

                let decoded = byte;
                if (filterType === 1) { // Sub
                    decoded = (byte + prevByte) & 0xFF;
                } else if (filterType === 2) { // Up
                    decoded = (byte + upByte) & 0xFF;
                } else if (filterType === 3) { // Average
                    decoded = (byte + Math.floor((prevByte + upByte) / 2)) & 0xFF;
                } else if (filterType === 4) { // Paeth
                    const p = prevByte + upByte - upLeftByte;
                    const pa = Math.abs(p - prevByte);
                    const pb = Math.abs(p - upByte);
                    const pc = Math.abs(p - upLeftByte);
                    let nearest = prevByte;
                    if (pb <= pa && pb <= pc) nearest = upByte;
                    else if (pc <= pa && pc <= pb) nearest = upLeftByte;
                    decoded = (byte + nearest) & 0xFF;
                }
                currentRow[i] = decoded;
            }

            // Write to result (Convert to RGBA)
            for (let x = 0; x < this.width; x++) {
                const resIdx = (y * this.width + x) * 4;
                if (this.colorType === 6) {
                    result[resIdx] = currentRow[x * 4];
                    result[resIdx + 1] = currentRow[x * 4 + 1];
                    result[resIdx + 2] = currentRow[x * 4 + 2];
                    result[resIdx + 3] = currentRow[x * 4 + 3];
                } else if (this.colorType === 2) {
                    result[resIdx] = currentRow[x * 3];
                    result[resIdx + 1] = currentRow[x * 3 + 1];
                    result[resIdx + 2] = currentRow[x * 3 + 2];
                    result[resIdx + 3] = 255;
                } else if (this.colorType === 3) {
                    const palIdx = currentRow[x];
                    if (this.palette) {
                        // Palette is RGB triples
                        const pStart = palIdx * 3;
                        if (pStart + 2 < this.palette.length) {
                            result[resIdx] = this.palette[pStart];
                            result[resIdx + 1] = this.palette[pStart + 1];
                            result[resIdx + 2] = this.palette[pStart + 2];
                            result[resIdx + 3] = 255;
                        }
                    }
                }
            }

            prevRow = currentRow;
            offset += rowSize;
        }

        this.data = result;
    }
}
