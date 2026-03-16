const fs = require('fs');
const iconv = require('iconv-lite');
const path = require('path');

const csvPath = path.join(__dirname, '../data_raw/honpyo_2024.csv');
const stream = fs.createReadStream(csvPath);
let buffer = Buffer.alloc(0);

stream.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length > 2000) {
        stream.destroy();
        const text = iconv.decode(buffer, 'Shift_JIS');
        console.log(text.substring(0, 1000));
    }
});
