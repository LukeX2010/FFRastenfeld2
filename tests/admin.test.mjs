import test from 'node:test';
import { publicationBudget } from '../server/budget.mjs';
test('budget resets on the tenth in Austrian time, including year rollover',()=>{
  assert.equal(publicationBudget([],new Date('2026-09-27T10:00:00Z')).remaining,10);
  assert.equal(publicationBudget([],new Date('2026-10-09T21:59:59Z')).remaining,10);
  assert.equal(publicationBudget([],new Date('2026-10-09T22:00:00Z')).remaining,15);
  assert.equal(publicationBudget([],new Date('2027-01-09T10:00:00Z')).cycle,'2026-12-10');
  assert.equal(publicationBudget([{cycle:'2026-10-10',commit:'a'},{cycle:'2026-10-10',commit:'a'}],new Date('2026-10-11')).used,1);
});
test('batch publishes all posts in one commit, counts once and retries without another commit',async()=>{
  const {handler,cookie,store}=await fixture();
  const refs=[];
  for(let i=0;i<3;i++) refs.push(await(await handler(req('/drafts',{...draft(),id:crypto.randomUUID(),titel:'Beitrag '+i},cookie))).json());
  assert.equal((await handler(req('/publish-batch',{drafts:refs},cookie))).status,200);
  assert.equal(store.commits.filter(c=>c.repo==='public').length,1);
  assert.equal(store.data.public['wwwroot/data/posts.json'].length,3);
  assert.equal(store.data.private['publication-usage.json'].length,1);
  assert.equal(store.data.private['index.json'].length,0);
  assert.equal((await handler(req('/publish-batch',{drafts:refs},cookie))).status,200);
  assert.equal(store.commits.filter(c=>c.repo==='public').length,1);
  // Retry the originally stored content after a lost response/private-finalization failure.
  for(const d of refs) store.data.private['drafts/'+d.id+'.json']=d;
  assert.equal((await handler(req('/publish-batch',{drafts:refs},cookie))).status,200);
  assert.equal(store.commits.filter(c=>c.repo==='public').length,1);
});
test('incomplete or stale batch publishes nothing; Einsatztyp is required only for publishing',async()=>{
  const {handler,cookie,store}=await fixture();
  const a=await(await handler(req('/drafts',draft(),cookie))).json();
  const b=await(await handler(req('/drafts',{...draft(),id:crypto.randomUUID(),kategorie:'Einsätze'},cookie))).json();
  assert.ok(b.revision);
  assert.equal((await handler(req('/publish-batch',{drafts:[a,b]},cookie))).status,400);
  assert.equal(store.commits.filter(c=>c.repo==='public').length,0);
  assert.equal((await handler(req('/publish-batch',{drafts:[{...a,revision:'stale'}]},cookie))).status,409);
  assert.equal((await handler(req('/publish-batch',{drafts:[a,a]},cookie))).status,400);
  assert.equal(store.commits.filter(c=>c.repo==='public').length,0);
  assert.doesNotThrow(()=>makePublication({...b,einsatzTyp:'T1'},[]));
});
test('repository metadata request has no trailing slash (GitHub rejects it)', async () => {
  const calls = [];
  const store = new GitStore({GITHUB_TOKEN:'test',GITHUB_REPO:'test/site'}, async (url) => {
    calls.push(url);
    if(url.endsWith('/')) return Response.json({}, {status:404});
    if(url.endsWith('/git/ref/heads/main')) return Response.json({object:{sha:'head'}});
    if(url.endsWith('/git/commits/head')) return Response.json({tree:{sha:'tree'}});
    return Response.json({default_branch:'main'});
  });
  assert.equal((await store.snapshot()).tree,'tree');
  assert.equal(calls[0],'https://api.github.com/repos/test/site');
});
import assert from 'node:assert/strict';
import { createHandler, makePublication, postToDraft, hash, passwordHash } from '../server/admin.mjs';
import { GitStore, ApiError } from '../server/github.mjs';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6SAAAAABJRU5ErkJggg==';
const image=(caption,extra={})=>({id:caption,name:caption,dataUrl:png,caption,isTitleImage:false,isInformationOnly:false,...extra});
const draft=()=>({id:'abcde-12345-67890',titel:'Neue Übung',kategorie:'Ausbildung',datum:'2026-09-26',ort:'Rastenfeld',einsatzTyp:'',einsatzZeit:'',einsatzKraefte:null,kurztext:'Kurztext',volltext:'Ein sachlicher Bericht.',notizen:'Private Notiz',kiAnweisung:'Kurz',bilder:[image('Galerie'),image('Titel',{isTitleImage:true}),image('Geheimes Infobild',{isInformationOnly:true})]});
const env={ADMIN_USERNAME:'tester',ADMIN_PASSWORD_HASH:passwordHash('test-password'),SESSION_SECRET:'x'.repeat(64),GITHUB_TOKEN:'test',GITHUB_REPO:'test/site',DRAFTS_REPO:'test/private',GEMINI_API_KEY:'test'};
test('separate users are returned by session, audit attribution cannot be forged, and passwords stay private',async()=>{
  const users=[{username:'Felix',displayName:'Felix Dornhackl',passwordHash:passwordHash('shared-test')},{username:'Matthias',displayName:'Matthias Goll',passwordHash:passwordHash('shared-test')}];
  const config={...env,ADMIN_USERS:JSON.stringify(users)};const store=new MemoryStore();const handler=createHandler(config,{store});
  assert.equal((await handler(req('/activity'))).status,401);
  for(const user of users){
    const login=await handler(req('/login',{username:user.username,password:'shared-test'}));assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal((await(await handler(req('/session',undefined,cookie))).json()).user.username,user.username);
    const saved=await handler(req('/drafts',{...draft(),id:crypto.randomUUID(),username:'forged'},cookie));assert.equal(saved.status,200);
    const log=await(await handler(req('/activity',undefined,cookie))).json();assert.equal(log[0].username,user.username);assert.equal(log[0].action,'draft.created');
    assert(!JSON.stringify(log).includes('Private Notiz'));assert(!JSON.stringify(log).includes('shared-test'));assert(!JSON.stringify(log).includes(user.passwordHash));
    const disabled=createHandler({...config,ADMIN_USERS:JSON.stringify(users.map(u=>({...u,disabled:u.username===user.username})))},{store});
    assert.equal((await disabled(req('/activity',undefined,cookie))).status,401);
  }
});
test('audit commits retry conflicts, without duplicate entries',async()=>{
  const store=new MemoryStore();let first=true;const commit=store.commit.bind(store);store.commit=async(...args)=>{if(first){first=false;throw new ApiError(409,'Conflict');}return commit(...args);};
  const handler=createHandler(env,{store});assert.equal((await handler(req('/login',{username:'tester',password:'test-password'}))).status,200);
  assert.equal(store.data.private['activity.json'].length,1);
});
test('successful publication is attributed privately and includes the commit',async()=>{
  const {handler,cookie,store}=await fixture();const saved=await(await handler(req('/drafts',draft(),cookie))).json();
  assert.equal((await handler(req('/publish',saved,cookie))).status,200);
  const log=store.data.private['activity.json'];assert.equal(log[0].action,'post.published');assert.equal(log[0].username,'tester');assert.equal(log[0].commit,'commit-id');
  assert(!JSON.stringify(store.data.public).includes('activity.json'));
});
class MemoryStore {
  constructor(){this.data={public:{'wwwroot/data/posts.json':[]},private:{}};this.commits=[];}
  async snapshot(priv=false){return{repo:priv?'private':'public'};}
  async read(snap,path,optional=false){const value=this.data[snap.repo][path];if(value===undefined&&!optional)throw new ApiError(404,'Fehlt');return value===undefined?null:structuredClone(value);}
  async commit(snap,files,message){this.commits.push({repo:snap.repo,files,message});for(const file of files)if(file.path.endsWith('.json'))this.data[snap.repo][file.path]=JSON.parse(file.content);return'commit-id';}
}
function req(route,body,cookie){return new Request('https://ffrastenfeld.at/api/admin'+route,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json','X-Editor-Request':'1',Origin:'https://ffrastenfeld.at'}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});}
async function fixture(extra={}){const store=new MemoryStore();const handler=createHandler(env,{store,...extra});const login=await handler(req('/login',{username:'tester',password:'test-password'}));assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];return{store,handler,cookie};}
test('title image first, private notes and information images stay out of public commit',()=>{const result=makePublication(draft(),[]);assert.equal(result.post.Bilder[0].Beschreibung,'Titel');assert.equal(result.post.Bilder.length,2);assert(!JSON.stringify(result).includes('Geheimes'));assert(!JSON.stringify(result).includes('Private Notiz'));assert.equal(result.post.Id,1);});
test('editing retains ID, slug and custom fields; rejects stale edit',()=>{const original={...makePublication(draft(),[]).post,CustomField:'keep'};const edit=postToDraft(original);edit.titel='Geänderter Titel';const changed=makePublication(edit,[original]);assert.equal(changed.posts.length,1);assert.equal(changed.post.Id,original.Id);assert.equal(changed.post.Slug,original.Slug);assert.equal(changed.post.CustomField,'keep');assert.throws(()=>makePublication(edit,[{...original,Titel:'Anderer Editor'}]),/inzwischen/);});
test('retrying identical publication does not create a duplicate',()=>{const d=draft();const result=makePublication(d,[]);const retry=makePublication(d,result.posts);assert.equal(retry.unchanged,true);assert.equal(retry.posts.length,1);});
test('rejects active content images, bad IDs and cross-post file paths',()=>{const d=draft();d.bilder=[{...image('bad'),dataUrl:'data:image/svg+xml;base64,PHN2Zz4='}];assert.throws(()=>makePublication(d,[]));d.bilder=[{id:'bad',path:'../../secret.png',caption:''}];assert.throws(()=>makePublication(d,[]));d.id='../secret';assert.throws(()=>makePublication(d,[]));});
test('API protects posts and drafts, requires CSRF header and validates login',async()=>{const handler=createHandler(env,{store:new MemoryStore()});assert.equal((await handler(req('/posts'))).status,401);assert.equal((await handler(req('/drafts',draft()))).status,401);assert.equal((await handler(req('/login',{username:'tester',password:'wrong'}))).status,401);assert.equal((await handler(new Request('https://ffrastenfeld.at/api/admin/login',{method:'POST',body:'{}'}))).status,403);});
test('draft save persists content across requests and detects stale revisions',async()=>{const{handler,cookie}=await fixture();const first=await(await handler(req('/drafts',draft(),cookie))).json();assert.ok(first.revision);assert.equal((await handler(req('/drafts',draft(),cookie))).status,409);const opened=await(await handler(req('/drafts/'+first.id,undefined,cookie))).json();assert.equal(opened.notizen,'Private Notiz');const saved=await handler(req('/drafts',{...opened,titel:'Neu'},cookie));assert.equal(saved.status,200);});
test('publication writes all images and posts in ONE public commit and removes active draft',async()=>{const{handler,cookie,store}=await fixture();const saved=await(await handler(req('/drafts',draft(),cookie))).json();const response=await handler(req('/publish',saved,cookie));assert.equal(response.status,200);const result=await response.json();assert.equal(result.post.Id,1);const commits=store.commits.filter(c=>c.repo==='public');assert.equal(commits.length,1);assert.equal(commits[0].files.filter(f=>f.path.endsWith('posts.json')).length,1);assert.equal(store.data.private['index.json'].length,0);});
test('AI receives image data AND existing text; key is header only',async()=>{let seen;const{handler,cookie}=await fixture({fetch:async(url,options)=>{seen={url,options};return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({titel:'KI Titel',kurztext:'Kurz',volltext:'Bericht'})}]}}]});}});const response=await handler(req('/ai',draft(),cookie));assert.equal(response.status,200);assert(!seen.url.includes('key='));assert.equal(seen.options.headers['x-goog-api-key'],'test');const body=JSON.parse(seen.options.body);assert(body.contents[0].parts.some(p=>p.inlineData));assert(body.contents[0].parts[0].text.includes('Ein sachlicher Bericht.'));});
test('settings never expose secrets, stale password invalidates session',async()=>{const{handler,cookie}=await fixture();const text=await(await handler(req('/settings',undefined,cookie))).text();assert(!text.includes(env.SESSION_SECRET));assert(!text.includes(env.ADMIN_PASSWORD_HASH));const newHandler=createHandler({...env,ADMIN_PASSWORD_HASH:passwordHash('changed')});assert.equal((await newHandler(req('/posts',undefined,cookie))).status,401);});
test('GitHub transaction uses one tree and non-force reference update',async()=>{const calls=[];const store=new GitStore(env,async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return Response.json({sha:'abc'});});await store.commit({repo:'test/site',head:'old',tree:'oldtree',branch:'main'},[{path:'posts.json',content:'[]'},{path:'img/a.jpg',content:'AA==',encoding:'base64'}],'Test');assert.equal(calls.filter(c=>c.url.endsWith('/git/trees')).length,1);assert.equal(calls.at(-1).body.force,false);assert.deepEqual(calls.find(c=>c.url.endsWith('/git/commits')).body.parents,['old']);});
test('public draft repository is rejected',async()=>{const store=new GitStore(env,async()=>Response.json({private:false}));await assert.rejects(store.snapshot(true),/privat/);});
