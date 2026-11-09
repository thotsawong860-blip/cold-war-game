const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));

const rooms = new Map();
const questions = [
 {q:"สงครามเย็นเป็นความขัดแย้งหลักระหว่างสองขั้วอำนาจใด?",a:["สหรัฐอเมริกาและสหภาพโซเวียต","จีนและญี่ปุ่น","อังกฤษและฝรั่งเศส"],c:0,why:"สหรัฐฯ และสหภาพโซเวียตเป็นมหาอำนาจหลักของสองขั้ว"},
 {q:"องค์การ NATO ก่อตั้งขึ้นในปีใด?",a:["1945","1949","1961"],c:1,why:"NATO ก่อตั้งในปี 1949"},
 {q:"กำแพงเบอร์ลินเริ่มสร้างในปีใด?",a:["1955","1961","1989"],c:1,why:"กำแพงเบอร์ลินเริ่มสร้างในปี 1961"},
 {q:"แผนมาร์แชลมีจุดประสงค์สำคัญอะไร?",a:["ฟื้นฟูเศรษฐกิจยุโรป","สำรวจอวกาศ","ตั้งองค์การสหประชาชาติ"],c:0,why:"เป็นโครงการช่วยฟื้นฟูยุโรปหลังสงครามโลกครั้งที่สอง"},
 {q:"วิกฤตการณ์ขีปนาวุธคิวบาเกิดขึ้นในปีใด?",a:["1950","1962","1975"],c:1,why:"เกิดขึ้นในปี 1962 และเป็นช่วงตึงเครียดอย่างมาก"},
 {q:"การแข่งขันด้านอวกาศ เหตุการณ์ใดเกิดขึ้นก่อน?",a:["มนุษย์เหยียบดวงจันทร์","สปุตนิก 1 ถูกส่งขึ้นสู่อวกาศ","สถานีอวกาศนานาชาติ"],c:1,why:"สปุตนิก 1 ถูกส่งขึ้นสู่อวกาศในปี 1957"},
 {q:"ประเทศใดเป็นผู้นำของกลุ่ม Warsaw Pact?",a:["สหภาพโซเวียต","สหรัฐอเมริกา","อิตาลี"],c:0,why:"สหภาพโซเวียตเป็นผู้นำกลุ่ม Warsaw Pact"},
 {q:"สงครามเกาหลีเริ่มต้นในปีใด?",a:["1945","1950","1965"],c:1,why:"สงครามเกาหลีเริ่มในปี 1950"},
 {q:"คำว่า 'ม่านเหล็ก' ใช้อธิบายอะไร?",a:["เส้นแบ่งทางการเมืองระหว่างยุโรปตะวันออกและตะวันตก","กำแพงเมืองจีน","แนวป้องกันในมหาสมุทร"],c:0,why:"เป็นคำเปรียบเทียบถึงการแบ่งแยกยุโรปในยุคสงครามเย็น"},
 {q:"เหตุการณ์ใดเป็นสัญลักษณ์สำคัญของการสิ้นสุดสงครามเย็นในยุโรป?",a:["การสร้างกำแพงเบอร์ลิน","การล่มสลายของกำแพงเบอร์ลิน","การก่อตั้ง NATO"],c:1,why:"กำแพงเบอร์ลินเปิดพรมแดนในปี 1989"}
];
const colors=["#ff5d8f","#4d96ff","#7b61ff","#00b894","#ff9f43","#00bcd4","#e056fd","#6ab04c","#f9ca24","#eb4d4b"];
function cleanName(n){return String(n||"ผู้เล่น").trim().slice(0,18)||"ผู้เล่น"}
function pub(room){return {code:room.code,players:room.players.map(p=>({id:p.id,name:p.name,color:p.color,score:p.score,position:p.position})),host:room.host,started:room.started,round:room.round,maxRounds:room.maxRounds,current:room.current,log:room.log,question:room.question?{q:room.question.q,a:room.question.a}:null,awaiting:room.awaiting};}
function send(room){io.to(room.code).emit("state",pub(room));}
function nextTurn(room){room.turnIndex=(room.turnIndex+1)%room.players.length;if(room.turnIndex===0){room.round++;}if(room.round>room.maxRounds){room.started=false;room.finished=true;room.log.unshift("🏁 จบเกมแล้ว! ผู้ที่มีอิทธิพลสูงสุดเป็นผู้ชนะ");}room.current=room.players[room.turnIndex]?.id||null;}
function addLog(room,msg){room.log.unshift(msg);room.log=room.log.slice(0,8);}
io.on("connection",socket=>{
 socket.on("createRoom",({name},cb)=>{
  let code; do{code=Math.random().toString(36).slice(2,6).toUpperCase()}while(rooms.has(code));
  const room={code,players:[{id:socket.id,name:cleanName(name),color:colors[0],score:0,position:0}],host:socket.id,started:false,finished:false,round:1,maxRounds:4,turnIndex:0,current:null,log:["สร้างห้องแล้ว! ส่งรหัสให้เพื่อนเข้าร่วมได้"],question:null,awaiting:null};
  rooms.set(code,room);socket.join(code);cb({ok:true,code});send(room);
 });
 socket.on("joinRoom",({code,name},cb)=>{
  const room=rooms.get(String(code||"").toUpperCase());
  if(!room)return cb({ok:false,error:"ไม่พบห้องนี้"});
  if(room.started)return cb({ok:false,error:"เกมเริ่มไปแล้ว"});
  if(room.players.length>=10)return cb({ok:false,error:"ห้องเต็มแล้ว (สูงสุด 10 คน)"});
  if(room.players.some(p=>p.id===socket.id))return cb({ok:true,code:room.code});
  room.players.push({id:socket.id,name:cleanName(name),color:colors[room.players.length%colors.length],score:0,position:0});
  socket.join(room.code);addLog(room,`👋 ${cleanName(name)} เข้าร่วมห้อง`);cb({ok:true,code:room.code});send(room);
 });
 socket.on("startGame",()=>{
  const room=[...rooms.values()].find(r=>r.host===socket.id);if(!room||room.started||room.players.length<4)return;
  room.started=true;room.finished=false;room.round=1;room.turnIndex=0;room.current=room.players[0].id;
  addLog(room,"🚩 เริ่มเกม! เดินทางผ่านเหตุการณ์สำคัญในยุคสงครามเย็น");send(room);
 });
 socket.on("roll",()=>{
  const room=[...rooms.values()].find(r=>r.players.some(p=>p.id===socket.id));
  if(!room||!room.started||room.current!==socket.id||room.awaiting)return;
  const p=room.players.find(x=>x.id===socket.id),roll=1+Math.floor(Math.random()*6);
  p.position=Math.min(24,p.position+roll);
  addLog(room,`🎲 ${p.name} ทอยได้ ${roll} เดินไปช่อง ${p.position}`);
  const tile=p.position%6;
  if(tile===2||tile===5||tile===0){
   const q=questions[Math.floor(Math.random()*questions.length)];
   room.question={...q,playerId:p.id};room.awaiting=p.id;
  }else if(tile===1){p.score+=2;addLog(room,"✨ ช่องความร่วมมือระหว่างประเทศ: ได้อิทธิพล +2");nextTurn(room);}
  else if(tile===3){p.score=Math.max(0,p.score-1);addLog(room,"⚡ ช่องความตึงเครียด: เสียอิทธิพล 1");nextTurn(room);}
  else {p.score+=1;addLog(room,"📡 ช่องข่าวสาร: ได้อิทธิพล +1");nextTurn(room);}
  if(p.position>=24){p.score+=3;addLog(room,`🏆 ${p.name} ถึงเส้นชัย ได้โบนัส +3`);nextTurn(room);}
  send(room);
 });
 socket.on("answer",({choice})=>{
  const room=[...rooms.values()].find(r=>r.awaiting===socket.id);if(!room||!room.question)return;
  const p=room.players.find(x=>x.id===socket.id),q=room.question;
  if(Number(choice)===q.c){p.score+=3;addLog(room,`✅ ${p.name} ตอบถูก! +3 อิทธิพล`);}
  else{addLog(room,`❌ ${p.name} ตอบผิด — ${q.why}`);}
  room.question=null;room.awaiting=null;nextTurn(room);send(room);
 });
 socket.on("disconnect",()=>{
  for(const [code,room] of rooms){
   const i=room.players.findIndex(p=>p.id===socket.id);if(i<0)continue;
   const [gone]=room.players.splice(i,1);addLog(room,`${gone.name} ออกจากห้อง`);
   if(room.players.length===0){rooms.delete(code);continue;}
   if(room.host===socket.id)room.host=room.players[0].id;
   if(room.current===socket.id){room.turnIndex=room.turnIndex%room.players.length;room.current=room.players[room.turnIndex].id;room.awaiting=null;room.question=null;}
   if(room.players.length<4&&room.started){room.started=false;addLog(room,"เกมหยุดชั่วคราว: ต้องมีผู้เล่นอย่างน้อย 4 คน");}
   send(room);
  }
 });
});
const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log("Cold War Board Game running on "+PORT));
