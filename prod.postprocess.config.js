import fs from'fs';
import LZString from 'lz-string';

const excalidraw_pkg =  fs.readFileSync("./node_modules/@zsviczian/excalidraw/dist/excalidraw.production.min.js", "utf8");
const react_pkg = fs.readFileSync("./node_modules/react/umd/react.production.min.js", "utf8");
const reactdom_pkg = fs.readFileSync("./node_modules/react-dom/umd/react-dom.production.min.js", "utf8");
const lzstring_pkg = fs.readFileSync("./node_modules/lz-string/libs/lz-string.min.js", "utf8");
const mainjs = fs.readFileSync("main.js", "utf8")

const packageString = lzstring_pkg+'const EXCALIDRAW_PACKAGES="' + LZString.compressToBase64(react_pkg + reactdom_pkg + excalidraw_pkg) +'";var ExcalidrawPackageLoader=(d=document)=>{if(!d.getElementById("excalidraw-script")){const script=d.createElement("script");script.type="text/javascript";script.id="excalidraw-script";script.text=LZString.decompressFromBase64(EXCALIDRAW_PACKAGES);d.body.appendChild(script);}};ExcalidrawPackageLoader();';

fs.writeFileSync(
  "main2.js",
  mainjs
    .replace('(require("react"))','')
    .replace('"use strict";','"use strict";' + packageString),
  {
    encoding: "utf8",
    flag: "w",
    mode: 0o666
  }
);


export default ({
  input: 'foo',
  plugins: [],
  output: [{
    file: 'foo.js',
    format: 'es'
  }]
});