const sharp = require('sharp');
const path = require('path');

const srcLogo = path.join(__dirname, 'client', 'public', 'logo.png');

async function processIcon(size, outputPath) {
    await sharp(srcLogo)
        .trim() // removes transparent edges to get the exact logo bounds
        .resize({
            width: Math.floor(size * 0.9), // 90% of the box to make it very large
            height: Math.floor(size * 0.9),
            fit: 'contain',
            background: { r: 10, g: 10, b: 10, alpha: 0 }
        })
        .extend({
            top: Math.floor(size * 0.05),
            bottom: Math.ceil(size * 0.05),
            left: Math.floor(size * 0.05),
            right: Math.ceil(size * 0.05),
            background: { r: 10, g: 10, b: 10, alpha: 1 } // #0a0a0a
        })
        .flatten({ background: '#0a0a0a' }) // Ensure no transparency
        .png()
        .toFile(outputPath);
    console.log(`Saved ${outputPath}`);
}

async function main() {
    await processIcon(192, path.join(__dirname, 'client', 'public', 'pwa-192x192.png'));
    await processIcon(512, path.join(__dirname, 'client', 'public', 'pwa-512x512.png'));
}

main().catch(console.error);
