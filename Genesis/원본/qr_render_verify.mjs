import {pathToFileURL} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(path.join(os.tmpdir(),'topicbook','package.json'));
const QRCode=require('qrcode');
const jsQR=require('jsqr');
const mupdf=await import(pathToFileURL(require.resolve('mupdf')).href);
const [mode,root]=process.argv.slice(2);
const temp=path.join(os.tmpdir(),'genesis-sample-20261010');fs.mkdirSync(temp,{recursive:true});
const data=JSON.parse(fs.readFileSync(path.join(root,'Genesis','원본','sample.json'),'utf8'));
const entries=data.sections.flatMap(s=>s.comments.flatMap(c=>c.evidence.map((e,i)=>({...e,id:c.id+'-'+i}))));
if(mode==='qr'){
  for(const e of entries.filter(e=>e.url)) await QRCode.toFile(path.join(temp,e.id+'.png'),e.url,{width:240,margin:4,errorCorrectionLevel:'M'});
  console.log(JSON.stringify({qr_created:entries.filter(e=>e.url).length}));
}else{
  const doc=mupdf.Document.openDocument(fs.readFileSync(path.join(root,'Genesis','창세기_1장_해설_근거링크_샘플.pdf')),'application/pdf');
  let qr=0,links=0,internal=0;const errors=[],actual=[];
  for(let i=0;i<doc.countPages();i++){
    const page=doc.loadPage(i),all=page.getLinks();
    for(const l of all.filter(l=>!l.isExternal())){
      internal++;
      try{const dest=doc.resolveLinkDestination(l.getURI());if(dest.page<0||dest.page>=doc.countPages())errors.push(`page ${i+1} invalid TOC destination`);}catch(err){errors.push(`page ${i+1} broken internal link: ${err.message}`);}
    }
    const video=all.filter(l=>l.isExternal()&&l.getURI().includes('youtu'));links+=video.length;
    const qrs=video.filter(l=>{const b=l.getBounds();return b[2]-b[0]>40 && b[2]-b[0]<45 && b[3]-b[1]>40});
    const s=300/72;
    const scan=qrs.length?page.toPixmap(mupdf.Matrix.scale(s,s),mupdf.ColorSpace.DeviceRGB,false,true):null;
    for(const l of qrs){
      const b=l.getBounds(),px=scan.getPixels(),W=scan.getWidth(),H=scan.getHeight(),n=scan.getNumberOfComponents();
      const x0=Math.max(0,Math.floor((b[0]-3)*s)),y0=Math.max(0,Math.floor((b[1]-3)*s)),x1=Math.min(W,Math.ceil((b[2]+3)*s)),y1=Math.min(H,Math.ceil((b[3]+3)*s));
      const w=x1-x0,h=y1-y0,rgba=new Uint8ClampedArray(w*h*4);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const src=((y+y0)*W+x+x0)*n,dst=(y*w+x)*4;rgba[dst]=px[src];rgba[dst+1]=px[src+1];rgba[dst+2]=px[src+2];rgba[dst+3]=255;}
      const decoded=jsQR(rgba,w,h);
      if(decoded?.data===l.getURI()){qr++;actual.push(l.getURI());}else errors.push(`page ${i+1} QR mismatch: ${decoded?.data}`);
    }
    scan?.destroy();
    const pm=page.toPixmap(mupdf.Matrix.scale(1.5,1.5),mupdf.ColorSpace.DeviceRGB,false,true);
    fs.writeFileSync(path.join(temp,`page-${i+1}.png`),pm.asPNG());pm.destroy();page.destroy();
  }
  const expected=entries.filter(e=>e.url).map(e=>e.url).sort();
  if(JSON.stringify(actual.sort())!==JSON.stringify(expected))errors.push('PDF QR URL multiset mismatch');
  const result={pages:doc.countPages(),youtube_annotations:links,qr_decoded:qr,expected_qr:expected.length,internal_links:internal,errors};
  fs.writeFileSync(path.join(root,'Genesis','원본','pdf-check.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));if(errors.length)process.exitCode=1;
}
