// Whole-corpus source review inventory. PDF originals are opened read-only.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const require=createRequire(path.join(os.tmpdir(),'topicbook','package.json'));
const mupdf=await import(pathToFileURL(require.resolve('mupdf')).href);
const root=process.argv[2],dest=path.join(root,'Genesis','자료검토');fs.mkdirSync(dest,{recursive:true});
const corpus=[],errors=[];
for(const folder of ['Theme','Milk'])for(const name of fs.readdirSync(path.join(root,folder)).filter(n=>n.endsWith('.pdf')).sort()){
 const file=folder+'/'+name,buf=fs.readFileSync(path.join(root,file)),doc=mupdf.Document.openDocument(buf,'application/pdf');const pages=[];
 for(let i=0;i<doc.countPages();i++){
  const page=doc.loadPage(i),st=page.toStructuredText();
  const text=st.asText(),links=page.getLinks().filter(l=>l.isExternal()&&/youtu(?:be\.com|\.be)/.test(l.getURI())).map(l=>({url:l.getURI(),rect:l.getBounds()}));
  pages.push({page:i+1,text,links});if(text.trim().length<20)errors.push({file,page:i+1,issue:'very_little_extracted_text'});
  st.destroy();page.destroy();
 }
 corpus.push({file,sha256:crypto.createHash('sha256').update(buf).digest('hex'),pages:pages.length,text_characters:pages.reduce((n,p)=>n+p.text.length,0),video_annotations:pages.reduce((n,p)=>n+p.links.length,0),video_segments:[...new Set(pages.flatMap(p=>p.links.map(l=>l.url)))],content:pages});doc.destroy();
 console.log(file+' | pages '+pages.length+' | video '+corpus.at(-1).video_annotations);
}
fs.writeFileSync(path.join(dest,'전체_PDF_본문색인.json'),JSON.stringify({date:'2026-10-10',scope:['Theme','Milk'],books:corpus,extraction_issues:errors},null,2));
console.log(JSON.stringify({books:corpus.length,pages:corpus.reduce((n,b)=>n+b.pages,0),issues:errors}));
