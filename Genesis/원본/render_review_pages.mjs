import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const require=createRequire(path.join(os.tmpdir(),'topicbook','package.json'));
const mupdf=await import(pathToFileURL(require.resolve('mupdf')).href);
for(const [file,pages] of [['Theme/18_교회는_어떻게_고르죠.pdf',[5,51]],['Theme/08_사탄_정확히_알기.pdf',[26]]]){
 const doc=mupdf.Document.openDocument(fs.readFileSync(file),'application/pdf');
 for(const n of pages){const p=doc.loadPage(n-1),pix=p.toPixmap(mupdf.Matrix.scale(2,2),mupdf.ColorSpace.DeviceRGB,false,true);const dest=path.join(os.tmpdir(),`genesis-review-${path.basename(file).slice(0,2)}-${n}.png`);fs.writeFileSync(dest,pix.asPNG());console.log(dest);pix.destroy();p.destroy();}doc.destroy();
}
