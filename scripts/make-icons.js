const fs = require('fs');
const sharp = require('sharp');

(async () => {
  try {
    const src = 'Images/fe48a763-a358-45a5-81bd-77c0a70330ee.webp';
    if (!fs.existsSync(src)) {
      console.error('Source image not found:', src);
      process.exit(1);
    }
    
    // Create circular icons with transparent background
    const sizes = [
      { size: 192, output: 'Images/icon-192.png' },
      { size: 512, output: 'Images/icon-512.png' }
    ];
    
    for (const { size, output } of sizes) {
      // Create a circular mask
      const mask = Buffer.from(
        `<svg width="${size}" height="${size}">
          <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/>
        </svg>`
      );
      
      // Resize image and apply circular mask
      await sharp(src)
        .resize(size, size, { fit: 'cover' })
        .composite([{
          input: mask,
          blend: 'dest-in'
        }])
        .png()
        .toFile(output);
      
      console.log(`Generated ${output} (circular)`);
    }
    
  } catch (err) {
    console.error('Error generating icons:', err);
    process.exit(1);
  }
})();
