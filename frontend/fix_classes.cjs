const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/hardy/OneDrive/Escritorio/WEB GRIND PROJECT/grindproject/frontend/app/routes/admin';

const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') && f !== '_index.tsx' && f !== 'layout.tsx');

let changedFiles = 0;

for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const orig = content;

    content = content.replace(/bg-white\/5\/\[0\.03\]/g, 'bg-white/[0.03]');
    content = content.replace(/bg-white\/5\/5/g, 'bg-white/5');

    if (content !== orig) {
        fs.writeFileSync(filePath, content, 'utf8');
        changedFiles++;
        console.log('Fixed ' + file);
    }
}

console.log('Fixed ' + changedFiles + ' files successfully.');
