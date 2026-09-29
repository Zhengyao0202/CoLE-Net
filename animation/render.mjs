import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(here);
const args=process.argv.slice(2);
const value=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const width=Number(value('--width','1600')),height=Math.round(width*9/16),fps=Number(value('--fps','24'));
const outDir=path.resolve(value('--out-dir',path.join(here,'output')));
fs.mkdirSync(outDir,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.txt':'text/plain'};
const server=http.createServer((req,res)=>{
 const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const filename=path.resolve(root,'.'+relative);
 if(!filename.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(filename,(err,data)=>{if(err){res.writeHead(404);res.end(filename);return;}res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
});
await new Promise(resolve=>server.listen(Number(value('--port','0')),'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/animation/index.html`;
if(args.includes('--preview')){console.log(url);process.on('SIGINT',()=>server.close(()=>process.exit(0)));}
else {
 let browser;let encoder;
 try {
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
  await page.goto(url+'?render=1',{waitUntil:'networkidle',timeout:120000});
  await page.waitForFunction(()=>window.filmReady,{},{timeout:120000});
  const duration=await page.evaluate(()=>window.filmDuration);
  const backend=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'WebGL2';});
  console.log(JSON.stringify({duration,width,height,fps,backend}));
  async function capture(t,format='jpeg') {
   const info=await page.evaluate(t=>{const result=window.renderAt(t);return new Promise(resolve=>requestAnimationFrame(()=>resolve(result)));},t);
   const bytes=await page.screenshot({type:format,...(format==='jpeg'?{quality:96}:{}),animations:'allow'});
   return {bytes,info};
  }
  const times=[1,5.5,10.5,14,17.5,22.5,27,29,31.5,35.5,42.5];
  const stills=[];
  for(const t of times){const {bytes,info}=await capture(t,'png');const file=`frame-${String(t).replace('.','_')}.png`;fs.writeFileSync(path.join(outDir,file),bytes);stills.push({time:t,file,...info});}
  if(errors.length)throw new Error(errors.join('\n'));
  fs.writeFileSync(path.join(outDir,'stills.json'),JSON.stringify({backend,width,height,stills},null,2)+'\n');
  console.log(`Saved ${stills.length} storyboard frames`);
  if(!args.includes('--stills')){
   const output=path.resolve(value('--output',path.join(outDir,'overview.mp4')));
   fs.mkdirSync(path.dirname(output),{recursive:true});
   encoder=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart','-threads','4',output],{stdio:['pipe','inherit','inherit']});
   const completion=once(encoder,'close');
   const start=Date.now(),frames=Math.round(duration*fps);
   for(let frame=0;frame<frames;frame++){
    const {bytes}=await capture(frame/fps);
    if(!encoder.stdin.write(bytes))await once(encoder.stdin,'drain');
    if(frame%(fps*2)===0)console.log(`Frame ${frame}/${frames} · ${(Date.now()-start)/1000}s elapsed`);
   }
   encoder.stdin.end();const [code]=await completion;if(code!==0)throw new Error('FFmpeg exited '+code);
   const {bytes}=await capture(31.5,'jpeg');fs.writeFileSync(path.join(outDir,'video-poster.jpg'),bytes);
   const hashes=Object.fromEntries(['scene.js','film.css','index.html','render.mjs','package.json','package-lock.json','assets/head.glb','assets/brain.glb'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(here,f))).digest('hex')]));
   if(errors.length)throw new Error(errors.join('\n'));
   const evidenceHashes=Object.fromEntries(['evidence.json','case-2-mri.webp','case-2-local.webp'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'docs/assets',f))).digest('hex')]));
   const report={status:'PASS',evidence_hashes:evidenceHashes,duration,width,height,fps,frames,backend,wall_seconds:(Date.now()-start)/1000,output,path_sha256:crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex'),source_hashes:hashes,errors};
   fs.writeFileSync(path.join(outDir,'RENDER.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
  }
 } finally {if(encoder&&!encoder.killed)encoder.kill();if(browser)await browser.close();server.close();}
}
