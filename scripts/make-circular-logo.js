const fs = require('fs');
const sharp = require('sharp');

(async () => {
  try {
    const src = 'Images/fe48a763-a358-45a5-81bd-77c0a70330ee.webp';
    const output = 'Images/logo-circular.png';
    const size = 200;
    
    if (!fs.existsSync(src)) {
      console.error('Source image not found:', src);
      process.exit(1);
    }
    
    // Create a circular mask
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/>
      </svg>`
    );
    
    // Resize to square, center, and apply circular mask
    await sharp(src)
      .resize(size, size, { 
        fit: 'cover',
        position: 'center'
      })
      .composite([{
        input: mask,
        blend: 'dest-in'
      }])
      .png()
      .toFile(output);
    
    console.log(`Generated ${output} (perfectly circular)`);
    
  } catch (err) {
    console.error('Error generating circular logo:', err);
    process.exit(1);
  }
})();
