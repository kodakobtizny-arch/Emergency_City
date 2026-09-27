import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

const app=express();
const http=createServer(app); const wss=new WebSocketServer({server:http});
app.use(express.static('public'));
const players=new Map();
function broadcast(){const data=JSON.stringify({type:'state',players:[...players.values()]}); for(const p of wss.clients) if(p.readyState===1)p.send(data)}
wss.on('connection',ws=>{const id=randomUUID();const p={id,name:'Player '+id.slice(0,4),x:0,z:0,rot:0,job:'Civilian',cash:500,car:true};players.set(id,p);ws.send(JSON.stringify({type:'welcome',id,self:p}));broadcast();
ws.on('message',raw=>{try{const m=JSON.parse(raw);const p=players.get(id);if(!p)return;if(m.type==='update'){p.x=Math.max(-240,Math.min(240,Number(m.x)||0));p.z=Math.max(-240,Math.min(240,Number(m.z)||0));p.rot=Number(m.rot)||0}if(m.type==='job'&&['Civilian','Police','Medic','Firefighter'].includes(m.job)){p.job=m.job}if(m.type==='reward'){p.cash+=Math.max(0,Math.min(1000,Number(m.amount)||0))}broadcast()}catch{}});
ws.on('close',()=>{players.delete(id);broadcast()})});
app.get('/health',(_,res)=>res.json({ok:true,players:players.size}));
http.listen(process.env.PORT||3000,()=>console.log('Emergency City RP running on http://localhost:'+(process.env.PORT||3000)));
