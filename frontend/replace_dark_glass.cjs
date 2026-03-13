const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/hardy/OneDrive/Escritorio/WEB GRIND PROJECT/grindproject/frontend/app/routes/admin';

const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') && f !== '_index.tsx' && f !== 'layout.tsx');

let changedFiles = 0;

for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const orig = content;

    // Containers
    content = content.replace(/bg-white rounded-(xl|2xl|3xl) shadow-(sm|md|lg|xl) border border-gray-200/g, 'bg-white/[0.03] backdrop-blur-2xl rounded-$1 shadow-2xl border border-white/[0.08]');
    content = content.replace(/bg-white log-container rounded-(xl|2xl|3xl) shadow-(sm|md|lg|xl) border border-gray-200/g, 'bg-white/[0.03] backdrop-blur-2xl log-container rounded-$1 shadow-2xl border border-white/[0.08]');
    content = content.replace(/bg-white rounded-(xl|2xl|3xl) border border-gray-200/g, 'bg-white/[0.03] backdrop-blur-2xl rounded-$1 border border-white/[0.08] shadow-2xl');
    content = content.replace(/bg-white p-([a-z0-9-]+) rounded-(xl|2xl|3xl) shadow-(sm|md|lg|xl) border border-gray-200/g, 'bg-white/[0.03] backdrop-blur-2xl p-$1 rounded-$2 shadow-2xl border border-white/[0.08]');
    content = content.replace(/bg-white p-([a-z0-9-]+) rounded-(xl|2xl|3xl) border border-gray-200/g, 'bg-white/[0.03] backdrop-blur-2xl p-$1 rounded-$2 shadow-2xl border border-white/[0.08]');
    content = content.replace(/bg-white rounded-t-3xl/g, 'bg-white/[0.03] backdrop-blur-2xl rounded-t-3xl border-t border-white/[0.08]');
    content = content.replace(/bg-white border-b border-gray-200/g, 'bg-white/[0.03] backdrop-blur-2xl border-b border-white/[0.08]');
    content = content.replace(/bg-white shadow-sm ring-1 ring-gray-900\/5/g, 'bg-white/[0.03] backdrop-blur-2xl shadow-2xl ring-1 ring-white/[0.08]');

    // Specific fix for forms / sections that might be using solid background
    content = content.replace(/bg-white p-([a-z0-9-]+) rounded-xl/g, 'bg-white/[0.03] backdrop-blur-2xl p-$1 rounded-xl shadow-2xl border border-white/[0.08]');

    // Specific fix for header backgrounds in cards
    content = content.replace(/bg-white/g, 'bg-white/[0.03] backdrop-blur-2xl'); // Wait, this is too broad

    // We need to restore original content and be more careful
    content = orig;

    // Let's do multiple targeted replacements
    // 1. Full container classes
    const regexes = [
        { from: /bg-white rounded-2xl border border-gray-200/g, to: 'bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl' },
        { from: /bg-white rounded-2xl shadow-sm border border-gray-200/g, to: 'bg-white/[0.03] backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/[0.08]' },
        { from: /bg-white p-(\w+) rounded-2xl shadow-sm border border-gray-200/g, to: 'bg-white/[0.03] backdrop-blur-2xl p-$1 rounded-2xl shadow-2xl border border-white/[0.08]' },
        { from: /bg-white border-b border-gray-200/g, to: 'bg-white/[0.03] backdrop-blur-2xl border-b border-white/[0.08]' },
        { from: /bg-white shadow-lg rounded-2xl/g, to: 'bg-[#0a0a0a]/90 backdrop-blur-3xl shadow-2xl border border-white/[0.08] rounded-2xl' },
        { from: /bg-white shadow-xl rounded-2xl/g, to: 'bg-[#0a0a0a]/90 backdrop-blur-3xl shadow-2xl border border-white/[0.08] rounded-2xl' },
        { from: /bg-white flex flex-col h-full shadow-2xl/g, to: 'bg-[#0a0a0a]/90 backdrop-blur-3xl flex flex-col h-full shadow-2xl border-l border-white/[0.08]' }
    ];

    regexes.forEach(({ from, to }) => {
        content = content.replace(from, to);
    });

    // Text
    content = content.replace(/text-gray-900/g, 'text-white');
    content = content.replace(/text-gray-800/g, 'text-white/90');
    content = content.replace(/text-gray-700/g, 'text-white/70');
    content = content.replace(/text-gray-600/g, 'text-white/60');
    content = content.replace(/text-gray-500/g, 'text-white/50');
    content = content.replace(/text-gray-400/g, 'text-white/40');
    content = content.replace(/text-gray-300/g, 'text-white/30');

    // Backgrounds
    content = content.replace(/bg-gray-50/g, 'bg-white/5');
    content = content.replace(/bg-gray-100/g, 'bg-white/10');
    content = content.replace(/bg-gray-200/g, 'bg-white/20');
    content = content.replace(/hover:bg-gray-50/g, 'hover:bg-white/5');
    content = content.replace(/hover:bg-gray-100/g, 'hover:bg-white/10');

    // Borders
    content = content.replace(/border-gray-100/g, 'border-white/5');
    content = content.replace(/border-gray-200/g, 'border-white/[0.08]');
    content = content.replace(/border-gray-300/g, 'border-white/10');
    content = content.replace(/divide-gray-100/g, 'divide-white/5');
    content = content.replace(/divide-gray-200/g, 'divide-white/[0.08]');

    // Inputs & leftover bg-white that is not backdrop blurred
    content = content.replace(/\bbg-white\b(?!(\/|\]|\[|"|-| )backdrop-blur| flex| p-)/g, 'bg-white/5');
    // also catch rogue trailing space
    content = content.replace(/bg-white /g, 'bg-white/5 ');

    if (content !== orig) {
        fs.writeFileSync(filePath, content, 'utf8');
        changedFiles++;
        console.log('Updated ' + file);
    }
}

console.log('Updated ' + changedFiles + ' files successfully.');
