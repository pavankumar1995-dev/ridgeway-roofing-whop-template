import { chromium } from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173'],{stdio:['ignore','pipe','pipe']});
let logs='';server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
let browser;try{
for(let i=0;i<60;i++){try{if((await fetch('http://localhost:5173')).ok)break}catch{}await new Promise(r=>setTimeout(r,250))}
await mkdir('evidence',{recursive:true});browser=await chromium.launch({headless:true});
for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5173',{waitUntil:'domcontentloaded',timeout:15000});await Promise.race([page.evaluate(()=>document.fonts.ready),new Promise(r=>setTimeout(r,3000))]);await page.screenshot({path:'evidence/'+name+'.png',fullPage:true,timeout:15000});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 await page.getByRole('button',{name:'Place a project deposit',exact:true}).click();await page.screenshot({path:'evidence/'+name+'-checkout.png'});
 const result={name,overflow,errors,depositEvent:await page.evaluate(()=>window.roofingEvents)};console.log(JSON.stringify(result));await writeFile('evidence/'+name+'-result.json',JSON.stringify(result,null,2));await page.close();
}
}finally{await browser?.close();server.kill();await writeFile('evidence/dev.log',logs)}
