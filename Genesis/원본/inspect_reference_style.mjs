import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(path.join(os.tmpdir(),'topicbook','package.json'));
const m=await import(pathToFileURL(require.resolve('mupdf')).href);
const temp=path.join(os.tmpdir(),'genesis-style-20261010');fs.mkdirSync(temp,{recursive:true});
const doc=m.Document.openDocument(fs.readFileSync('C:/Users/PC/OneDrive/바탕 화면/창세기_1-3장_해설.pdf'),'application/pdf');
for(const n of [1,2,3,5,6,7,12,22,36,55,57,60]){
 const p=doc.loadPage(n-1),pix=p.toPixmap(m.Matrix.scale(2,2),m.ColorSpace.DeviceRGB,false,true);
 fs.writeFileSync(path.join(temp,`reference-${n}.png`),pix.asPNG());pix.destroy();p.destroy();
}doc.destroy();console.log(temp);
