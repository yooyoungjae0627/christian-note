import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const require=createRequire(path.join(os.tmpdir(),'topicbook','package.json'));const mupdf=await import(pathToFileURL(require.resolve('mupdf')).href);
const doc=mupdf.Document.openDocument(fs.readFileSync(process.argv[2]),'application/pdf'),page=doc.loadPage(0),pix=page.toPixmap(mupdf.Matrix.scale(2,2),mupdf.ColorSpace.DeviceRGB,false,true);fs.writeFileSync(process.argv[3],pix.asPNG());pix.destroy();page.destroy();doc.destroy();
