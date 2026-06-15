const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

const toRemoveStart = lines.findIndex((l, i) => i > 1560 && l.trim() === '});');
const toRemoveEnd = lines.findIndex((l, i) => i > toRemoveStart && l.trim() === '};' && lines[i-1].trim() === 'return mappedData;');

if (toRemoveStart !== -1 && toRemoveEnd !== -1) {
    const newLines = [...lines.slice(0, toRemoveStart), ...lines.slice(toRemoveEnd + 1)];
    fs.writeFileSync('src/App.tsx', newLines.join('\n'));
    console.log('Fixed syntax error');
} else {
    console.log('Could not find bounds', toRemoveStart, toRemoveEnd);
}
