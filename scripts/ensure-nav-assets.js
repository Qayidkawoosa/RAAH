const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'node_modules', '@react-navigation', 'elements', 'lib', 'module', 'assets');
const backupDir = path.join(__dirname, 'nav-assets');

try {
  if (fs.existsSync(backupDir)) {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const files = fs.readdirSync(backupDir);
    for (const file of files) {
      const srcFile = path.join(backupDir, file);
      const destFile = path.join(targetDir, file);
      if (!fs.existsSync(destFile)) {
        fs.copyFileSync(srcFile, destFile);
      }
    }
    console.log('[ensure-nav-assets] Navigation icons verified.');
  }
} catch (err) {
  console.warn('[ensure-nav-assets] Warning:', err.message);
}
