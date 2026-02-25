const fs = require('fs');
const path = require('path');
const dir = path.join(process.cwd(), 'scripts');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

files.forEach(f => {
    const filePath = path.join(dir, f);
    let content = fs.readFileSync(filePath, 'utf-8');
    if (content.match(/catch\s*\(\s*[a-zA-Z0-9_]+\s*\)/g)) {
        // Also handling catch(err) or catch(error)
        content = content.replace(/catch\s*\(\s*([a-zA-Z0-9_]+)\s*\)/g, 'catch ($1: any)');
        fs.writeFileSync(filePath, content);
        console.log('Fixed', f);
    }
});

export {};
