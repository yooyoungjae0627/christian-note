import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const require=createRequire(path.join(os.tmpdir(),'topicbook','package.json'));const mupdf=await import(pathToFileURL(require.resolve('mupdf')).href),QRCode=require('qrcode'),jsQR=require('jsqr');
const temp=path.join(os.tmpdir(),'genesis-chapters-20261010');fs.mkdirSync(temp,{recursive:true});const mode=process.argv[2],chapters=process.argv.slice(3).map(Number);
for(const ch of (chapters.length?chapters:[1,2,3,4,5,6,7,8,9,10])){
 const nn=String(ch).padStart(2,'0');
 const data=JSON.parse(fs.readFileSync(`Genesis/원본/chapter${nn}.json`,'utf8'));
 const entries=data.sections.flatMap(s=>s.comments.flatMap(c=>c.evidence.map((e,i)=>({...e,id:c.id+'-'+i}))));
 if(mode==='qr'){for(const e of entries.filter(e=>e.url))await QRCode.toFile(path.join(temp,e.id+'.png'),e.url,{width:250,margin:4,errorCorrectionLevel:'M'});console.log({chapter:ch,qr:entries.filter(e=>e.url).length});continue;}
 const doc=mupdf.Document.openDocument(fs.readFileSync(`Genesis/창세기_${nn}장_교재.pdf`),'application/pdf');let decoded=0,internal=0;const errors=[],actual=[],pageStats=[];
 for(let i=0;i<doc.countPages();i++){
  const page=doc.loadPage(i),links=page.getLinks();
  for(const l of links.filter(l=>!l.isExternal())){internal++;try{const d=doc.resolveLinkDestination(l.getURI());if(d.page<0||d.page>=doc.countPages())errors.push(`bad internal destination page ${i+1}`);}catch(e){errors.push(e.message);}}
  const qrs=links.filter(l=>l.isExternal()&&l.getURI().includes('youtu')&&Math.abs(l.getBounds()[2]-l.getBounds()[0]-13.6*72/25.4)<1&&Math.abs(l.getBounds()[3]-l.getBounds()[1]-13.6*72/25.4)<1);
  const scan=qrs.length?page.toPixmap(mupdf.Matrix.scale(300/72,300/72),mupdf.ColorSpace.DeviceRGB,false,true):null;
  for(const l of qrs){const b=l.getBounds(),s=300/72,px=scan.getPixels(),W=scan.getWidth(),H=scan.getHeight(),N=scan.getNumberOfComponents();const x0=Math.max(0,Math.floor((b[0]-3)*s)),y0=Math.max(0,Math.floor((b[1]-3)*s)),x1=Math.min(W,Math.ceil((b[2]+3)*s)),y1=Math.min(H,Math.ceil((b[3]+3)*s)),w=x1-x0,h=y1-y0,rgba=new Uint8ClampedArray(w*h*4);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const src=((y+y0)*W+x+x0)*N,dst=(y*w+x)*4;rgba[dst]=px[src];rgba[dst+1]=px[src+1];rgba[dst+2]=px[src+2];rgba[dst+3]=255;}
   const r=jsQR(rgba,w,h);if(r?.data===l.getURI()){decoded++;actual.push(r.data);}else errors.push(`QR page ${i+1}: ${r?.data}`);
  }scan?.destroy();
  const pm=page.toPixmap(mupdf.Matrix.scale(1.4,1.4),mupdf.ColorSpace.DeviceRGB,false,true);fs.writeFileSync(path.join(temp,`ch${ch}-page${i+1}.png`),pm.asPNG());pm.destroy();
  const st=page.toStructuredText();const obj=JSON.parse(st.asJSON());pageStats.push({page:i+1,text:st.asText(),blocks:obj.blocks});st.destroy();page.destroy();
 }
 const expected=entries.filter(e=>e.url).map(e=>e.url).sort();if(JSON.stringify(actual.sort())!==JSON.stringify(expected))errors.push('QR URL multiset differs from evidence');
 const result={chapter:ch,pages:doc.countPages(),qr_expected:expected.length,qr_decoded:decoded,internal_links:internal,errors};fs.writeFileSync(`Genesis/원본/chapter${nn}-pdf-check.json`,JSON.stringify(result,null,2));fs.writeFileSync(path.join(temp,`ch${ch}-pages.json`),JSON.stringify(pageStats));console.log(result);doc.destroy();if(errors.length)process.exitCode=1;
}
