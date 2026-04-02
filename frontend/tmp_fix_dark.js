const fs = require('fs');
const path = require('path');

const files = ['schedule.tsx', 'store.tsx', 'packages.tsx'];
const dir = 'c:/Users/hardy/OneDrive/Escritorio/WEB GRIND PROJECT/grindproject/frontend/app/routes/dashboard';

const replacements = [
    [/text-gray-900/g, 'text-white'],
    [/text-slate-900/g, 'text-white'],
    [/text-gray-800/g, 'text-white/90'],
    [/text-slate-800/g, 'text-white/90'],
    [/text-gray-700/g, 'text-white/80'],
    [/text-slate-700/g, 'text-white/80'],
    [/text-gray-600/g, 'text-white/70'],
    [/text-gray-500/g, 'text-white/60'],
    [/text-gray-400/g, 'text-white/50'],
    [/text-gray-300/g, 'text-white/40'],
    [/bg-white/g, 'bg-white/5'],
    [/bg-gray-50/g, 'bg-white/5'],
    [/bg-gray-100/g, 'bg-white/10'],
    [/bg-gray-200/g, 'bg-white/20'],
    [/border-gray-50/g, 'border-white/5'],
    [/border-gray-100/g, 'border-white/10'],
    [/border-gray-200/g, 'border-white/10'],
    [/border-gray-300/g, 'border-white/20'],
    [/border-indigo-100/g, 'border-indigo-500/20'],
    [/from-indigo-50/g, 'from-indigo-500/10'],
    [/"#e5e7eb"/g, '"rgba(255,255,255,0.1)"'],
    [/divide-gray-100/g, 'divide-white/10'],
    [/divide-gray-200/g, 'divide-white/10']
];

files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (!fs.existsSync(fullPath)) return;
    let content = fs.readFileSync(fullPath, 'utf8');
    replacements.forEach(([regex, replacement]) => {
        content = content.replace(regex, replacement);
    });
    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${file}`);
});
