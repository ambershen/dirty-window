import http from 'node:http'
import dgram from 'node:dgram'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root=fileURLToPath(new URL('../../',import.meta.url)), udp=dgram.createSocket('udp4')
const port=5180, origin=`http://127.0.0.1:${port}`
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.task':'application/octet-stream','.jpg':'image/jpeg'}
let packets=0
const server=http.createServer(async(req,res)=>{
 try {
  if(req.headers.host!==`127.0.0.1:${port}`){res.writeHead(403).end();return}
  const url=new URL(req.url,origin)
  if(url.pathname==='/gesture'&&req.method==='POST'){
   if(req.headers.origin!==origin||req.headers['content-type']!=='application/json'){res.writeHead(403).end();return}
   let text='';for await(const chunk of req){text+=chunk;if(text.length>2048){res.writeHead(413).end();return}}
   const p=JSON.parse(text)
   if(!['point','palm','none','fist'].includes(p.gesture)||![p.x,p.y].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)) {res.writeHead(400).end();return}
   const data=Buffer.from(JSON.stringify({x:p.x,y:p.y,gesture:p.gesture}))
   udp.send(data,9982,'127.0.0.1');packets++;res.writeHead(204).end();return
  }
  if(url.pathname==='/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,packets}));return}
  if(req.method!=='GET'){res.writeHead(405).end();return}
  let base=path.join(root,'dist'),name=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html'
  if(url.pathname.startsWith('/vision/')){base=path.join(root,'node_modules/@mediapipe/tasks-vision/wasm');name=path.basename(url.pathname)}
  if(url.pathname==='/hand_landmarker.task'){base=path.join(root,'touchdesigner/controller');name='hand_landmarker.task'}
  const file=path.resolve(base,name)
  if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return}
  const bytes=await readFile(file);res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(bytes)
 } catch{res.writeHead(400).end('Request unavailable')}
})
server.listen(port,'127.0.0.1',()=>console.log(`${origin}/?mode=td-controller`))
process.on('SIGINT',()=>{udp.send(Buffer.from('{"gesture":"none","x":0.5,"y":0.5}'),9982,'127.0.0.1',()=>{server.close();udp.close()})})
