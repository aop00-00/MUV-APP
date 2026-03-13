const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'app/routes/admin');

const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') && f !== '_index.tsx' && f !== 'layout.tsx');

let changedFiles = 0;

for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const orig = content;

    // Containers
    content = content.replace(/bg-white rounded-(xl|2xl|3xl) shadow-(sm|md|lg|xl) border border-gray-200/g, 'bg-white/[0.03] backdrop-blur-2xl rounded-$1 shadow-2xl border border-white/[0.08]');
    content = content.replace(/bg-white rounded-(xl|2xl|3xl) border border-gray-200/g, 'bg-white/[0.03] backdrop-blur-2xl rounded-$1 border border-white/[0.08] shadow-2xl');
    content = content.replace(/bg-white p-([a-z0-9-]+) rounded-(xl|2xl|3xl) shadow-(sm|md|lg|xl) border border-gray-200/g, 'bg-white/[0.03] backdrop-blur-2xl p-$1 rounded-$2 shadow-2xl border border-white/[0.08]');
    content = content.replace(/bg-white p-([a-z0-9-]+) rounded-(xl|2xl|3xl) border border-gray-200/g, 'bg-white/[0.03] backdrop-blur-2xl p-$1 rounded-$2 shadow-2xl border border-white/[0.08]');
    content = content.replace(/bg-white rounded-t-3xl/g, 'bg-white/[0.03] backdrop-blur-2xl rounded-t-3xl border-t border-white/[0.08]');
    content = content.replace(/bg-white border-b border-gray-200/g, 'bg-white/[0.03] backdrop-blur-2xl border-b border-white/[0.08]');
    content = content.replace(/bg-white shadow-sm ring-1 ring-gray-900\/5/g, 'bg-white/[0.03] backdrop-blur-2xl shadow-2xl ring-1 ring-white/[0.08]');

    // Specific fix for forms / sections that might be using solid background
    content = content.replace(/bg-white p-([a-z0-9-]+) rounded-xl/g, 'bg-white/[0.03] backdrop-blur-2xl p-$1 rounded-xl shadow-2xl border border-white/[0.08]');

    // Input fields, etc. that might just have bg-white
    // Mostly we want to be careful with global bg-white. Let's do a regex with word bounds
    // Replace simple bg-white to bg-white/5, excluding the ones we already replaced to bg-white/[0.03] or bg-white/10
    content = content.replace(/\bbg-white\b(?!(\/|\]|\[|"|-| )backdrop-blur| flex| p-)/g, 'bg-white/5');
    content = content.replace(/bg-white /g, 'bg-white/5 ');

    // Specific fix for any remaining bg-white/5/[0.03] double replacements
    content = content.replace(/bg-white\/5\/\[0\.03\]/g, 'bg-white/[0.03]');
    content = content.replace(/bg-white\/5\/5/g, 'bg-white/5');

    // Replace text colors
    content = content.replace(/text-gray-900/g, 'text-white');
    content = content.replace(/text-gray-800/g, 'text-white/90');
    content = content.replace(/text-gray-700/g, 'text-white/70');
    content = content.replace(/text-gray-600/g, 'text-white/60');
    content = content.replace(/text-gray-500/g, 'text-white/50');
    content = content.replace(/text-gray-400/g, 'text-white/40');
    content = content.replace(/text-gray-300/g, 'text-white/30');

    // Borders
    content = content.replace(/border-gray-200/g, 'border-white/[0.08]');
    content = content.replace(/border-gray-100/g, 'border-white/5');
    content = content.replace(/border-gray-300/g, 'border-white/10');
    content = content.replace(/border-gray-800/g, 'border-white/20');
    content = content.replace(/divide-gray-100/g, 'divide-white/5');
    content = content.replace(/divide-gray-200/g, 'divide-white/[0.08]');
    content = content.replace(/divide-gray-50/g, 'divide-white/[0.02]');

    // Backgrounds
    content = content.replace(/bg-gray-50/g, 'bg-white/5');
    content = content.replace(/bg-gray-100/g, 'bg-white/10');
    content = content.replace(/bg-gray-200/g, 'bg-white/20');
    content = content.replace(/hover:bg-gray-50/g, 'hover:bg-white/5');
    content = content.replace(/hover:bg-gray-100/g, 'hover:bg-white/10');
    content = content.replace(/hover:bg-gray-200/g, 'hover:bg-white/20');

    // Specific slideover fixes (often have bg-white as their base)
    content = content.replace(/bg-white\/5 flex flex-col h-full shadow-2xl/g, 'bg-[#0a0a0a]/90 backdrop-blur-3xl flex flex-col h-full shadow-2xl border-l border-white/[0.08]');
    content = content.replace(/bg-white\/5 rounded-2xl shadow-xl border border-white\/5/g, 'bg-[#0a0a0a]/90 backdrop-blur-3xl rounded-2xl shadow-2xl border border-white/[0.08]');

    // Fix modal overlays if any (usually bg-gray-900/50 -> bg-black/60)
    content = content.replace(/bg-gray-900\/50/g, 'bg-black/80 backdrop-blur-sm');

    // Fix texts inside inputs (usually placeholders or text itself)
    content = content.replace(/placeholder-gray-400/g, 'placeholder-white/30');
    content = content.replace(/placeholder-gray-500/g, 'placeholder-white/40');

    // Tab active states etc
    content = content.replace(/bg-white\/5 shadow-sm rounded-xl/g, 'bg-white/10 shadow-sm rounded-xl');
    content = content.replace(/ring-gray-200/g, 'ring-white/[0.08]');
    content = content.replace(/ring-gray-100/g, 'ring-white/5');

    if (content !== orig) {
        fs.writeFileSync(filePath, content, 'utf8');
        changedFiles++;
        console.log(`Updated ${file}`);
    }
}

console.log(`Updated ${changedFiles} files successfully.`);
