import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const mathjaxDir = path.resolve('MathjaxToSVG');
const distDir = path.join(mathjaxDir, 'dist');
const distFile = path.join(distDir, 'index.js');
const hashFile = path.join(distDir, '.build-hash');
const nodeModulesDir = path.join(mathjaxDir, 'node_modules');

// Recursively generates an MD5 hash of all source files in a directory
function hashDirectory(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  const hash = crypto.createHash('md5');
  
  // Sort to ensure consistent hashing across different operating systems
  for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
    // Ignore build outputs, dependencies, and hidden files (like .git, .DS_Store)
    if (file.name === 'node_modules' || file.name === 'dist' || file.name.startsWith('.')) {
      continue;
    }
    
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      hash.update(hashDirectory(fullPath));
    } else {
      hash.update(fs.readFileSync(fullPath));
    }
  }
  return hash.digest('hex');
}

const currentHash = hashDirectory(mathjaxDir);
let previousHash = '';

if (fs.existsSync(hashFile)) {
  previousHash = fs.readFileSync(hashFile, 'utf8');
}

// Rebuild if the output file is missing, or if the source files have changed
if (!fs.existsSync(distFile) || currentHash !== previousHash) {
  console.log('🔄 MathjaxToSVG changes detected (or missing build). Rebuilding...');
  
  // Run npm install if node_modules is missing or if we know things changed
  if (!fs.existsSync(nodeModulesDir) || currentHash !== previousHash) {
    console.log('📦 Installing MathjaxToSVG dependencies...');
    execSync('npm install', { stdio: 'inherit', cwd: mathjaxDir });
  }
  
  console.log('🔨 Building MathjaxToSVG...');
  execSync('npm run build', { stdio: 'inherit', cwd: mathjaxDir });
  
  // Save the new hash for next time
  if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
  }
  fs.writeFileSync(hashFile, currentHash);
  
  console.log('✅ MathjaxToSVG build complete.\n');
} else {
  console.log('⚡ MathjaxToSVG is up to date. Skipping build.\n');
}