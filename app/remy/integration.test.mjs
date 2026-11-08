import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createActions } from './actions.js';
import { createVision } from './vision.js';
import { createElevenLabsRemy, prefetchBrain } from './elevenlabs.js';
const tools = JSON.parse(await readFile(new URL('../../remy-brain/actions.json', import.meta.url), 'utf8')).tools;
const core = await readFile(new URL('../../remy-brain/instructions.md', import.meta.url), 'utf8');
const recipe = { id: 'example', title: 'Toast', steps: [{instruction:'Wait',timer:{label:'Toast',minutes:2,check_at:1}}, {instruction:'Move tray into oven'}] };
const brain = { instructions: core, tools, recipe: null, max_minutes:10 };
const tick = () => new Promise(resolve => setImmediate(resolve));
function actionFixture(options={}, initialRecipe=recipe) {
  const events = [];
  const actions = createActions({emit:(type,data)=>events.push({type,data}), alive:()=>true, request:async()=>({ok:true,recipe}), ...options});
  actions.configure({...brain,recipe:initialRecipe});
  return {actions,events};
}
test('agent prompt keeps one voice and receives core rules once from the server', async()=> {
  const prompt=await readFile(new URL('./agent-prompt.md',import.meta.url),'utf8');
  assert.ok(prompt.includes('{{session_brain}}')); assert.ok(prompt.includes('remy_action'));
  assert.ok(prompt.includes('single selected voice'));
  assert.ok(!prompt.includes('<Savage>'));
  // every action Remy can call is named in the dashboard prompt
  for (const t of JSON.parse(await readFile(new URL('../../remy-brain/actions.json', import.meta.url), 'utf8')).tools) assert.ok(prompt.includes(t.name), t.name);
  // the core rules must not be repeated in the dashboard prompt (they'd be paid for twice on every reply)
  assert.ok(!prompt.includes(core.split('\n').find(l=>l.startsWith('# ')))); assert.ok(!prompt.includes('## Order of priorities'));
});
test('timer tool becomes countdown; duplicate call does not reset it; end retains next step',async()=> {
  const {actions,events}=actionFixture();
  const args={id:'toast',label:'Toast',minutes:2,check_at_minutes:1};
  assert.equal((await actions.call('start_timer',args)).ok,true);
  assert.equal((await actions.call('start_timer',args)).already_running,true);
  assert.deepEqual(events.filter(e=>e.type==='timer_start').map(e=>e.data),[{id:'toast',label:'Toast',seconds:120,check_at:60}]);
  const end=actions.timerEvent('timer_done',{id:'toast',label:'Toast'});
  assert.equal(end.next_instruction,'Move tray into oven');
  assert.equal(end.timer.done,true);
});
test('explicit spoken reminder works without a recipe; guessed and invalid timers fail',async()=>{
  const {actions,events}=actionFixture({},null);
  assert.equal((await actions.call('start_timer',{id:'x',label:'X',minutes:5})).ok,false);
  actions.hear('Set a five-minute timer');
  assert.equal((await actions.call('start_timer',{id:'x',label:'Oven reminder',minutes:5})).ok,true);
  assert.equal((await actions.call('start_timer',{id:'bad',label:'X',minutes:-1})).ok,false);
  assert.equal((await actions.call('start_timer',{id:'bad',label:'X',minutes:5,check_at_minutes:6})).ok,false);
  assert.equal((await actions.call('start_timer',{id:'bad',label:'X',minutes:'5'})).ok,false);
  assert.equal(events.filter(e=>e.type==='timer_start').length,1);
});
test('ambiguous spoken durations never silently become a shorter timer',async()=>{
  const {actions}=actionFixture({},null);
  for (const phrase of ['twenty five minutes','one minute thirty seconds','half a minute','one and a half minutes']) {
    actions.hear('Set a timer for '+phrase);
    for (const minutes of [1,5,30]) assert.equal((await actions.call('start_timer',{id:'x',label:'Test',minutes})).ok,false);
  }
  actions.hear('Set a timer for 25 minutes');
  assert.equal((await actions.call('start_timer',{id:'x',label:'Test',minutes:25})).ok,true);
});
test('checked server recipe is used and out-of-range steps are rejected',async()=>{
  const {actions,events}=actionFixture();
  const result=await actions.call('create_recipe',{title:'Original',ingredients:['bread'],steps:[{instruction:'Wait',looks_right:[],looks_wrong:[],done_when:'Timer'}]});
  assert.equal(result.recipe.title,'Toast');
  assert.equal(events.at(-1).data.recipe.title,'Toast');
  assert.equal((await actions.call('update_step',{current_step:99,step_complete:true})).ok,false);
});
test('invalid and unknown tool calls cannot create screen events',async()=>{
  const {actions,events}=actionFixture(); const count=events.length;
  for (const [name,args] of [['roast',{text:'x',level:9}],['roast',{text:'A'.repeat(181),level:1}],['safety_alert',{text:9}],['delete_everything',{}]]) assert.equal((await actions.call(name,args)).ok,false);
  assert.equal(events.length,count);
});
function visionFixture(response, { mode = 'honest', activeRecipe = recipe } = {}) {
  let clock=1000; const tasks=[],events=[],context=[],speech=[],requests=[];
  const vision=createVision({video:{videoWidth:1280,videoHeight:720,readyState:2},canvas:{getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,abc'},
    request:async(...args)=>{requests.push(args);return response(...args);},actions:{currentStep:()=>activeRecipe.steps[0],snapshot:()=>({recipe:activeRecipe})},
    context:t=>context.push(t),speak:(t,u)=>speech.push({t,u}),emit:(type,data)=>events.push({type,data}),alive:()=>true,getMode:()=>mode,
    now:()=>clock,schedule:fn=>{tasks.push(fn);return fn;},cancel:()=>{}});
  return {vision,tasks,events,context,speech,requests,setTime:t=>clock=t};
}
test('camera sends the current recipe step as an object accepted by the vision API',async()=>{
  const f=visionFixture(async()=>({summary:'pan',issues:[],safety:''}));
  f.vision.start(); await tick();
  assert.equal(f.requests[0][0],'/api/vision/look');
  assert.deepEqual(f.requests[0][1].step,recipe.steps[0]);
  assert.equal(typeof f.requests[0][1].step,'object');
  f.vision.stop();
});
test('camera safety is immediate, and repeated frames do not repeat ordinary warnings',async()=>{
  const f=visionFixture(async()=>({summary:'pan',issues:[{type:'burning',confidence:0.9,detail:'black edges'}],safety:''}));
  f.vision.start(); await tick(); await f.tasks.shift()();
  // an unchanged second frame is not re-sent to Remy (saves voice tokens)
  assert.equal(f.speech.length,1); assert.equal(f.context.length,1); f.vision.stop();
  const urgent=visionFixture(async()=>({safety:'Smoke from oil',issues:[]}));
  urgent.vision.start(); await tick();
  assert.equal(urgent.events[0].type,'alert'); assert.equal(urgent.speech[0].u,true); urgent.vision.stop();
});
test('Savage jabs at an ordinary visible salad without calling it a mistake; lessons stay quiet',async()=>{
  const picture=async()=>({summary:'A salad on a board',observations:['lettuce and tomato visible'],can_see_cooking:true,issues:[],safety:''});
  const cook=visionFixture(picture,{mode:'savage'});
  cook.vision.start(); await tick(); await cook.tasks.shift()();
  assert.equal(cook.speech.length,1); assert.match(cook.speech[0].t,/SAVAGE SCENE/);
  assert.equal(cook.events.filter(e=>e.type==='roast').length,0);
  cook.vision.stop();
  const lesson=visionFixture(picture,{mode:'savage',activeRecipe:{...recipe,lesson:true}});
  lesson.vision.start(); await tick(); assert.equal(lesson.speech.length,0); lesson.vision.stop();
});
test('late camera response is discarded after stop, and stale analysis does not drive action',async()=>{
  let finish; const f=visionFixture(()=>new Promise(r=>finish=r));
  f.vision.start(); f.vision.stop(); finish({safety:'old danger'}); await tick(); assert.equal(f.speech.length,0);
  const stale=visionFixture(async()=>{stale.setTime(7000);return {safety:'old danger'};});
  stale.vision.start(); await tick(); assert.equal(stale.speech.length,0); assert.match(stale.context[0],/STALE/); stale.vision.stop();
});
function voiceFixture(start, stream) {
  let options, closed=0, clock=10000; const events=[],sent=[],context=[],tasks=[];
  const page=new EventTarget(); page.hidden=false;
  const session={endSession:async()=>{closed++;},sendContextualUpdate:t=>context.push(t),sendUserMessage:t=>sent.push(t)};
  const remy=createElevenLabsRemy({page,stream,now:()=>clock, schedule:(fn,ms)=>{const t={fn,ms};tasks.push(t);return t;},cancel:t=>{if(t)t.cancelled=true;},
    fetcher:async()=>({ok:true,json:async()=>brain}),loadSDK:async()=>({Conversation:{startSession:async o=>{options=o;return start?start(session,o):session;}}})});
  for(const type of ['status','timer_start','tip']) remy.on(type,data=>events.push({type,data}));
  return {remy,page,events,sent,context,tasks,get options(){return options;},get closed(){return closed;},setTime:t=>clock=t};
}
test('runtime full brain and client tool are delivered; timer expiry triggers spoken instruction',async()=>{
  const f=voiceFixture(); await f.remy.start();
  assert.ok(f.options.dynamicVariables.session_brain.startsWith(core));
  f.options.onMessage({source:'user',message:'Set a five minute timer'});
  const result=JSON.parse(await f.options.clientTools.remy_action({action:'start_timer',arguments_json:JSON.stringify({id:'oven',label:'Oven reminder',minutes:5})}));
  assert.equal(result.ok,true); assert.equal(f.events.find(e=>e.type==='timer_start').data.seconds,300);
  f.setTime(15000); f.remy.send('timer_done',{id:'oven',label:'Oven reminder'});
  assert.match(f.sent[0],/TIMER DONE/); assert.match(f.sent[0],/not proof/); await f.remy.stop();
});
test('Stop during connection closes the late session and rejects stale tools',async()=>{
  let finish; const f=voiceFixture(session=>new Promise(r=>finish=()=>r(session)));
  const starting=f.remy.start(); await tick(); await f.remy.stop(); finish(); await starting;
  assert.equal(f.closed,1); assert.equal(f.context.length,0);
  assert.equal(JSON.parse(await f.options.clientTools.remy_action({action:'safety_alert',arguments_json:'{"text":"old"}'})).ok,false);
});
test('duplicate Start does not open two sessions and hidden page releases the call',async()=>{
  let calls=0; const f=voiceFixture(session=>{calls++;return session;});
  await Promise.all([f.remy.start(),f.remy.start()]); assert.equal(calls,1);
  f.page.hidden=true; f.page.dispatchEvent(new Event('visibilitychange')); await tick(); assert.equal(f.closed,1);
  f.page.hidden=false; f.page.dispatchEvent(new Event('visibilitychange')); await tick(); assert.equal(calls,2); await f.remy.stop();
});
test('network drop reconnects with timer state and old callbacks cannot revive it',async()=>{
  const f=voiceFixture(); await f.remy.start(); const old=f.options;
  old.onDisconnect(); await tick();
  const retry=f.tasks.find(t=>t.ms===1500&&!t.cancelled); assert.ok(retry); await retry.fn();
  assert.notEqual(f.options,old); await f.remy.stop(); const count=f.events.length;
  old.onModeChange({mode:'speaking'}); assert.equal(f.events.length,count);
});
test('ten-minute cap ends voice without clearing the screen timers',async()=>{
  const f=voiceFixture(); await f.remy.start(); await f.tasks.find(t=>t.ms===600000).fn();
  assert.equal(f.closed,1); assert.equal(f.events.at(-1).data.status,'error');
  assert.match(f.events.at(-1).data.message,/Timers remain/);
});

test('timer from a later recipe step or a pasta shape starts without moving the step first',async()=>{
  const events=[]; const actions=createActions({emit:(type,data)=>events.push({type,data}),request:async()=>({}),alive:()=>true});
  const pasta={id:'boiled-pasta',title:'Pasta',steps:[{instruction:'Which shape?'},{instruction:'Boil water'},
    {instruction:'Pasta in',timer_by_shape:{penne:{label:'Penne',minutes:11,check_at:10},spaghetti:{label:'Spaghetti',minutes:10,check_at:9}}},{instruction:'Taste'}]};
  actions.configure({tools:[{name:'start_timer',parameters:{type:'object',required:['id','label','minutes'],properties:{id:{type:'string'},label:{type:'string'},minutes:{type:'number'},check_at_minutes:{type:'number'}}}}],recipe:pasta});
  assert.equal((await actions.call('start_timer',{id:'pasta',label:'Penne',minutes:11,check_at_minutes:10})).ok,true);
  assert.equal(actions.snapshot().current_step,2);
  assert.equal((await actions.call('start_timer',{id:'other',label:'Guess',minutes:7})).ok,false);
  assert.deepEqual(events.filter(e=>e.type==='timer_start').map(e=>e.data.seconds),[660]);
});

test('saying the pasta is in starts the timer for the shape the cook named',async()=>{
  const events=[]; const actions=createActions({emit:(type,data)=>events.push({type,data}),request:async()=>({}),alive:()=>true});
  const pasta={id:'boiled-pasta',title:'Pasta',steps:[{instruction:'Which shape?'},{instruction:'Boil water'},
    {instruction:'Pasta in',timer_by_shape:{penne:{label:'Penne',minutes:11,check_at:10},spaghetti:{label:'Spaghetti',minutes:10,check_at:9}}},{instruction:'Taste'}]};
  actions.configure({tools:[{name:'start_timer',parameters:{type:'object',required:['id','label','minutes'],properties:{id:{type:'string'},label:{type:'string'},minutes:{type:'number'},check_at_minutes:{type:'number'}}}}],recipe:pasta});
  assert.equal(actions.hear("The water's boiling"), null);
  assert.equal(actions.hear("Pasta's in"), null); // shape not known yet: Remy asks
  actions.hear('I am using penne');
  const started=actions.hear("OK, I've put the pasta in");
  assert.equal(started.label,'Penne'); assert.equal(started.seconds,660); assert.equal(started.check_at,600);
  assert.equal(actions.hear("it's in"), null); // no duplicate
  // Remy then also calls start_timer with his own id: not a second countdown
  assert.equal((await actions.call('start_timer',{id:'pasta',label:'Penne',minutes:11,check_at_minutes:10})).already_running,true);
  assert.equal(events.filter(e=>e.type==='timer_start').length,1);
});
test('saying it is in starts a plain recipe step timer (rigatoni)',async()=>{
  const events=[]; const actions=createActions({emit:(type,data)=>events.push({type,data}),request:async()=>({}),alive:()=>true});
  actions.configure({tools:[],recipe:{id:'r',title:'R',steps:[{instruction:'Boil'},{instruction:'Rigatoni in',timer:{label:'Rigatoni',minutes:11,check_at:10}}]}});
  assert.equal(actions.hear("Rigatoni's going in now, it's in the pot").seconds,660);
});

test('salt in the water does not start the pasta timer',async()=>{
  const events=[]; const actions=createActions({emit:(type,data)=>events.push({type,data}),request:async()=>({}),alive:()=>true});
  actions.configure({tools:[],recipe:{id:'r',title:'R',steps:[{instruction:'Boil and salt'},{instruction:'Rigatoni in',timer:{label:'Rigatoni',minutes:11,check_at:10}}]}});
  assert.equal(actions.hear("Salt's in the water"), null);
  assert.equal(actions.hear("Pasta's in").label, 'Rigatoni');
  assert.equal(events.filter(e=>e.type==='timer_start').length,1);
});

test('timer announcements say what the timer is for',async()=>{
  const actions=createActions({emit:()=>{},request:async()=>({}),alive:()=>true});
  actions.configure({tools:[{name:'start_timer',parameters:{type:'object',required:['id','label','minutes'],properties:{id:{type:'string'},label:{type:'string'},minutes:{type:'number'},check_at_minutes:{type:'number'}}}}],
    recipe:{id:'rigatoni',title:'Rigatoni',steps:[{instruction:'Boil'},{instruction:'In',timer:{label:'Rigatoni',minutes:11,check_at:10,from:'pasta_dried_minutes_al_dente/rigatoni/default'}},{instruction:'Garlic',timer:{label:'Garlic',minutes:1.5,from:'veg_minutes/garlic'}}]}});
  assert.equal(actions.hear("Pasta's in").announce,'11-minute timer for the rigatoni pasta.');
  assert.match((await actions.call('start_timer',{id:'garlic',label:'Garlic',minutes:1.5})).message,/1\.5-minute timer for the garlic\./);
});

test('iPhone mic: an exact-device "Invalid constraint" error retries with the default mic',async()=>{
  let tries=0;
  const f=voiceFixture((session,o)=>{ tries++; if(o.inputDeviceId){ const e=new Error('Invalid constraint'); e.name='OverconstrainedError'; throw e; } return session; },
    {getAudioTracks:()=>[{getSettings:()=>({deviceId:'abc'}),stop(){}}],getTracks:()=>[],getVideoTracks:()=>[]});
  await f.remy.start();
  assert.equal(tries,2); assert.equal(f.options.inputDeviceId,undefined);
  assert.ok(!f.events.some(e=>e.type==='status'&&e.data.status==='error'));
  await f.remy.stop();
});

test('a dropped WebRTC call reconnects over WebSocket',async()=>{
  const types=[]; const f=voiceFixture((session,o)=>{ types.push(o.connectionType); return session; });
  await f.remy.start();
  f.options.onDisconnect({reason:'error',message:'LiveKit connection state changed to disconnected'});
  await tick(); await tick();
  const retry=f.tasks.find(t=>!t.cancelled && t.ms===1500); assert.ok(retry); await retry.fn(); for(let i=0;i<5;i++) await tick();
  assert.deepEqual(types,['webrtc','websocket']);
  await f.remy.stop();
});

test('camera notes are only re-sent when something changes or 60 s pass',async()=>{
  let res={summary:'pan',issues:[],safety:'',can_see_cooking:true};
  const f=visionFixture(async()=>res);
  f.vision.start(); await tick();
  await f.tasks.shift()(); await f.tasks.shift()();
  assert.equal(f.context.length,1);
  res={...res,issues:[{type:'burning',confidence:0.9,detail:'x'}]}; await f.tasks.shift()();
  assert.equal(f.context.length,2);
  f.setTime(40000); await f.tasks.shift()();
  assert.equal(f.context.length,2);   // 40 s: nothing new, no note
  f.setTime(70000); await f.tasks.shift()();
  assert.equal(f.context.length,3); f.vision.stop();
});

test('saying clear the recipe takes it off the screen; so does the clear_recipe action',async()=>{
  const events=[]; const actions=createActions({emit:(type,data)=>events.push({type,data}),request:async()=>({}),alive:()=>true});
  const r={id:'r',title:'R',steps:[{instruction:'Boil'}]};
  actions.configure({tools:[{name:'clear_recipe',parameters:{type:'object',properties:{},required:[]}}],recipe:r});
  assert.equal(actions.hear("I'm boiling the water"), null);
  assert.equal(actions.hear('Remy, can you clear the recipe please').cleared, true);
  assert.equal(actions.snapshot().recipe, null);
  actions.configure({tools:[{name:'clear_recipe',parameters:{type:'object',properties:{},required:[]}}],recipe:r});
  assert.equal((await actions.call('clear_recipe',{})).cleared, true);
  assert.equal(events.filter(e=>e.type==='recipe_clear').length, 2);
});

test('hands-free commands: next/back/repeat, timer cancel/adjust/time left, only after his name',async()=>{
  const events=[]; const actions=createActions({emit:(type,data)=>events.push({type,data}),request:async()=>({}),alive:()=>true});
  const r={id:'r',title:'R',steps:[{instruction:'Boil'},{instruction:'Pasta in',timer:{label:'Rigatoni',minutes:11,check_at:10}},{instruction:'Drain'}]};
  actions.configure({tools:[],recipe:r});
  assert.equal(actions.hear('next step please'), null);                       // no "Remy" -> not a command
  assert.equal(actions.hear('Remy, next step').command,'next step'); assert.equal(actions.snapshot().current_step,1);
  assert.equal(actions.hear('Remy back').command,'previous step'); assert.equal(actions.snapshot().current_step,0);
  assert.equal(actions.hear('Remy, repeat that').command,'repeat step'); assert.equal(events.at(-1).data.text,'Boil');
  actions.hear('Remy, next step'); actions.hear("pasta's in");               // timer starts
  assert.equal(actions.hear('Remy, add a minute to the rigatoni').command,'adjust timer');
  assert.deepEqual(events.find(e=>e.type==='timer_adjust').data,{id:'rigatoni',seconds:60});
  assert.equal(actions.hear('Remy take two minutes off').command,'adjust timer');
  assert.equal(events.filter(e=>e.type==='timer_adjust').at(-1).data.seconds,-120);
  assert.equal(actions.hear('Remy, how long left on the pasta?').command,'time left');
  assert.equal(events.at(-1).data.id,'rigatoni');
  assert.equal(actions.hear('Remy, cancel the rigatoni timer').command,'cancel timer');
  assert.deepEqual(events.at(-1),{type:'timer_cancel',data:{id:'rigatoni'}});
});

test('faster start: a brain prefetched on the start screen is used once; a different attitude fetches again',async()=>{
  const calls=[]; const brain={instructions:core,tools};
  const fetcher=async(url,init)=>{calls.push([url,init?.body&&JSON.parse(init.body).mode]);return {ok:true,json:async()=>brain};};
  await prefetchBrain({mode:'savage',profile:null,fetcher});
  const make=(mode)=>createElevenLabsRemy({mode,page:Object.assign(new EventTarget(),{hidden:false}),fetcher,
    loadSDK:async()=>({Conversation:{startSession:async()=>({endSession:async()=>{},sendContextualUpdate(){},sendUserMessage(){}})}}),
    schedule:(fn,ms)=>({fn,ms}),cancel:()=>{}});
  const a=make('savage'); await a.start(); await a.stop();
  assert.equal(calls.filter(c=>c[0]==='/api/brain').length,1);          // only the prefetch
  const b=make('honest'); await b.start(); await b.stop();
  assert.deepEqual(calls.filter(c=>c[0]==='/api/brain').map(c=>c[1]),['savage','honest']);
});

test('voice timer changes: add/take off/set, with or without "Remy", never guessed', async () => {
  const events = []; const a = createActions({ emit: (type, data) => events.push({ type, data }), request: async () => ({}), alive: () => true });
  a.configure({ tools: [], recipe: { id: 'r', title: 'R', steps: [{ instruction: 'Boil' }, { instruction: 'Pasta in', timer: { label: 'Rigatoni', minutes: 11, check_at: 10 } }] } });
  a.hear('Remy, next step'); a.hear("pasta's in");
  const last = () => events.filter(e => e.type === 'timer_adjust').at(-1)?.data;
  a.hear('add two minutes to the pasta'); assert.equal(last().seconds, 120);
  a.hear('decrease it by a minute'); assert.equal(last().seconds, -60);
  a.hear('two more minutes please'); assert.equal(last().seconds, 120);
  a.hear('knock half a minute off'); assert.equal(last().seconds, -30);
  a.hear('make the pasta timer 8 minutes'); assert.equal(last().to, 480);
  const n = events.length;
  a.hear('take the pasta out in a minute'); a.hear('add the pasta for 10 minutes');
  assert.equal(events.length, n);   // not timer changes
});
