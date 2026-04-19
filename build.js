const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const destDir = path.join(__dirname, 'www');

console.log('Starting build process...');

// Create www directory if it doesn't exist
if (!fs.existsSync(destDir)){
    fs.mkdirSync(destDir);
    console.log('Created www directory.');
}

// Extensions of files to copy
const validExtensions = ['.html', '.css', '.js', '.png', '.jpg', '.mp3'];
const ignoredFiles = ['build.js'];

let count = 0;
fs.readdirSync(srcDir).forEach(file => {
    const filePath = path.join(srcDir, file);
    
    // Only process files in the root (no recursive directories needed for this project)
    if (fs.statSync(filePath).isFile()) {
        const ext = path.extname(file).toLowerCase();
        if (validExtensions.includes(ext) && !ignoredFiles.includes(file) && !file.endsWith('.bak')) {
            fs.copyFileSync(filePath, path.join(destDir, file));
            count++;
        }
    }
});

console.log(`Build complete. Copied ${count} files to www directory.`);
