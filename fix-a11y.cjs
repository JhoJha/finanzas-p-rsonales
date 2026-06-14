const fs = require('fs');
const path = require('path');

const files = [
    'src/routes/registro/+page.svelte',
    'src/routes/recurrentes/+page.svelte',
    'src/routes/presupuestos/+page.svelte',
    'src/routes/deudas/+page.svelte',
    'src/routes/ahorro/+page.svelte'
];

let idCounter = 1;

files.forEach(file => {
    let content = fs.readFileSync(path.join(__dirname, file), 'utf8');
    
    // Replace <label ...> Text </label> \s* <input/select ...>
    // with <label for="a11y-X" ...> Text </label> \s* <input/select id="a11y-X" ...>
    
    const regex = /(<label\b[^>]*)(>[\s\S]*?<\/label>)\s*(<input|<select)\b([^>]*>)/g;
    
    content = content.replace(regex, (match, p1, p2, p3, p4) => {
        // If already has 'for', skip
        if (p1.includes('for=')) return match;
        
        const id = `a11y-${idCounter++}`;
        return `${p1} for="${id}"${p2}\n\t\t\t\t${p3} id="${id}"${p4}`;
    });
    
    fs.writeFileSync(path.join(__dirname, file), content, 'utf8');
});

console.log("Fixed labels!");
