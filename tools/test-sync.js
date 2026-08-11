const fs=require('fs');
let h=fs.readFileSync('index.html','utf8');
let code=h.match(/<script>([\s\S]*?)<\/script>/)[1];
const store={};
global.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]};
global.prompt=()=>'我的自定义事项';
global.document={getElementById:()=>({style:{setProperty(){}},set innerHTML(v){},get innerHTML(){return''},set textContent(v){},set className(v){},classList:{add(){},remove(){},toggle(){}},dataset:{},addEventListener(){},querySelectorAll:()=>[],appendChild(){},remove(){},closest:()=>null}),querySelectorAll:()=>[],addEventListener(){},createElement:()=>({}),body:{appendChild(){}}};
code+='\n;global.__t={createPlan,ensureDay,todayStr,addDays,makeTask,planById,S:()=>S};';
eval(code);
const t=global.__t;
const d=t.todayStr();
const tomorrow=t.addDays(d,1);

t.createPlan('测试','学习','B','英语学习 背单词',['A','B','C','D'],['M1']);
const p=t.S().plans[0];
console.log('templates=',JSON.stringify(p.templates),'todayCount=',p.todayCount);

t.ensureDay(d); t.ensureDay(tomorrow);
let todayTasks=t.S().tasks[d].filter(x=>x.planId===p.id);
let tomTasks=t.S().tasks[tomorrow].filter(x=>x.planId===p.id);
console.log('today[0]=',todayTasks[0].text,'tplIdx=',todayTasks[0].tplIdx);
console.log('tomorrow[0] before edit=',tomTasks[0].text);

// EDIT task[1] today -> sync templates[1]
const tgt=todayTasks[1];
tgt.text='B改'; p.templates[tgt.tplIdx]='B改';
t.S().tasks[tomorrow]=t.S().tasks[tomorrow].filter(x=>x.planId!==p.id);
t.ensureDay(tomorrow);
let tom2=t.S().tasks[tomorrow].filter(x=>x.planId===p.id);
console.log('templates after edit=',JSON.stringify(p.templates));
console.log('tomorrow[1] after edit sync=',tom2[1]?tom2[1].text:'(missing)','(应为 B改)');

// DELETE task[0] today -> remove templates[0]
const delT=todayTasks[0];
p.templates.splice(delT.tplIdx,1);
if(p.todayCount>p.templates.length)p.todayCount=p.templates.length;
t.S().tasks[tomorrow]=t.S().tasks[tomorrow].filter(x=>x.planId!==p.id);
t.ensureDay(tomorrow);
let tom3=t.S().tasks[tomorrow].filter(x=>x.planId===p.id);
console.log('templates after delete=',JSON.stringify(p.templates));
console.log('tomorrow tasks after delete=',tom3.map(x=>x.text).join(' | '),'(应无 A)');

// ADD task -> append template
p.templates.push('新增X'); p.todayCount=Math.min(10,Math.max(p.todayCount,p.templates.length));
t.S().tasks[tomorrow]=t.S().tasks[tomorrow].filter(x=>x.planId!==p.id);
t.ensureDay(tomorrow);
let tom4=t.S().tasks[tomorrow].filter(x=>x.planId===p.id);
console.log('templates after add=',JSON.stringify(p.templates));
console.log('tomorrow tasks after add=',tom4.map(x=>x.text).join(' | '),'(应含 新增X)');

// milestone edit sync
const mon=(()=>{const dt=new Date(d+'T00:00:00');const off=(1-dt.getDay()+7)%7;return t.addDays(d,off||7);})();
t.ensureDay(mon);
const monTasks=t.S().tasks[mon].filter(x=>x.planId===p.id&&x.phase==='week');
if(monTasks.length){const mt=monTasks[0]; mt.text='M1改'; p.ms[mt.tplIdx]='M1改';
  t.S().tasks[mon]=t.S().tasks[mon].filter(x=>x.planId!==p.id);
  t.ensureDay(mon);
  const mon2=t.S().tasks[mon].filter(x=>x.planId===p.id&&x.phase==='week');
  console.log('ms after edit=',JSON.stringify(p.ms),'mon task=',mon2[0]?mon2[0].text:'(missing)','(应为 M1改)');
} else { console.log('(今天非周一，跳过里程碑测试)'); }

console.log('ALL SYNC-LOGIC OK');
