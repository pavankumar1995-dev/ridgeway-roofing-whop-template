import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import app from '../dist/server/index.js';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'};
const root=resolve('dist/client');
const ASSETS={async fetch(req){const p=resolve(root,'.'+new URL(req.url).pathname);if(!p.startsWith(root+'/')&&p!==root)return new Response('Forbidden',{status:403});try{return new Response(await readFile(p),{headers:{'content-type':types[extname(p)]||'application/octet-stream'}})}catch{return new Response('Not found',{status:404})}}};
createServer(async(req,res)=>{try{let b=[];for await(const chunk of req)b.push(chunk);const response=await app.fetch(new Request('http://localhost:4173'+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(b)}:{})}),{ASSETS});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch{res.writeHead(500);res.end('Server error')}}).listen(4173,'127.0.0.1',()=>console.log('Local test server http://localhost:4173'));
