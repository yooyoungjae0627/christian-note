import {pathToFileURL} from 'node:url';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {createRequire} from 'node:module';
const require=createRequire(path.join(os.tmpdir(),'topicbook','package.json'));
const mupdf=await import(pathToFileURL(require.resolve('mupdf')).href);
const root=process.argv[2],out={};
fs.mkdirSync(path.join(os.tmpdir(),'genesis-sample-20261010'),{recursive:true});
const neededMilk= /밀크(?:2|3|4|5|7|8|9-2|10)강\.pdf$/;
const neededTheme=/^(?:01|08|11|13|14|16|26|28|32)_/;
for(const folder of ['Milk','Theme'])for(const name of fs.readdirSync(path.join(root,folder)).filter(n=>n.endsWith('.pdf'))){
 if(!(folder==='Milk'?neededMilk:neededTheme).test(name))continue;
 const file=folder+'/'+name,doc=mupdf.Document.openDocument(fs.readFileSync(path.join(root,file)),'application/pdf');const pages=[];
 for(let i=0;i<doc.countPages();i++){
  const p=doc.loadPage(i),st=p.toStructuredText();
  pages.push({page:i+1,text:st.asText(),links:p.getLinks().filter(l=>l.isExternal()&&l.getURI().includes('youtu')).map(l=>({url:l.getURI(),rect:l.getBounds()}))});
  st.destroy();p.destroy();
 }
 doc.destroy();out[file]=pages;
}
fs.writeFileSync(path.join(os.tmpdir(),'genesis-sample-20261010','source-index.json'),JSON.stringify(out));console.log('Indexed PDFs',Object.keys(out).length);
