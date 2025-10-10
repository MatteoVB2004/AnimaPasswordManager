const fs = require('fs');
const sharp = require('sharp');

(async () => {
  try {
    const src = 'Images/fe48a763-a358-45a5-81bd-77c0a70330ee.webp';
    if (!fs.existsSync(src)) {
      console.error('Source image not found:', src);
      process.exit(1);
    }
    await sharp(src).resize(192, 192).png().toFile('Images/icon-192.png');
    await sharp(src).resize(512, 512).png().toFile('Images/icon-512.png');
    console.log('Generated Images/icon-192.png and Images/icon-512.png');
  } catch (err) {
    console.error('Error generating icons:', err);
    process.exit(1);
  }
})();
