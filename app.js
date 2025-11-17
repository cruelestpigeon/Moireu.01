/* Moireu v1.5 implementation (client-side SPA)
   - built on Moireu v0.1 codebase
   - adds UNIVERSE tab and small label updates for create/new conversation
   - localStorage persistence
*/

/* ---------- Utilities ---------- */
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const now = () => new Date().toISOString();
const randBetween = (a,b) => { a=Number(a)||0; b=Number(b)||0; if(a>b)[a,b]=[b,a]; return Math.floor(Math.random()*(b-a+1))+a; };
const escapeHTML = s => (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* ---------- Storage model ---------- */
const STORAGE_KEY = 'moireu_v1.5_state';
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ console.error(e); }
  return seedState();
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function seedState(){
  const p_me = { id: 'p_me', displayName:'You', username:'you', bio:'My profile', description:'', relationships:'', followers: 42, likesMin:5, likesMax:150, createdAt: now() };
  const p_a = { id: 'p_aria', displayName:'Aria', username:'aria', bio:'Wandering bard', description:'Plays lute.', relationships:'friend of You', followers:128, likesMin:20, likesMax:400, createdAt: now() };
  const posts = [
    { id: 'post_'+Math.random().toString(36).slice(2,9), profileId: p_a.id, displayName: p_a.displayName, username: p_a.username, content:'Hello world! **I sing** tonight. #bard', likes: randBetween(p_a.likesMin,p_a.likesMax), replies: randBetween(5,250), createdAt: now() },
    { id: 'post_'+Math.random().toString(36).slice(2,9), profileId: p_me.id, displayName: p_me.displayName, username: p_me.username, content:'Starting Moireu v1.5 — *client-only*!', likes: randBetween(p_me.likesMin,p_me.likesMax), replies: randBetween(5,250), createdAt: now() }
  ];
  const dms = {};
  dms['dm_aria'] = { participants: [p_me.username, p_a.username], messages: [{ id:'m_'+Math.random().toString(36).slice(2,9), from:p_a.username, text:'Hey! Want to RP?', createdAt: now() }] };
  // Universe default text
  const universeText = "Welcome to this universe. Describe the setting here.";
  return { profiles: [p_me,p_a], posts, dms, myProfileId: p_me.id, universeText };
}

let state = loadState();

/* ---------- UI: Sidebar toggle & navigation ---------- */
const sidebar = $('#sidebar');
$('#btn-sidebar').addEventListener('click', ()=> { sidebar.classList.add('show'); sidebar.setAttribute('aria-hidden','false'); });
$('#btn-close-sidebar').addEventListener('click', ()=> { sidebar.classList.remove('show'); sidebar.setAttribute('aria-hidden','true'); });
$$('.nav-btn').forEach(btn => btn.addEventListener('click', (e) => {
  const t = e.currentTarget.dataset.target;
  openView(t);
}));

/* Back buttons linking */
$$('.back-btn').forEach(b => b.addEventListener('click', e => openView(e.currentTarget.dataset.target || 'feedTab')));

/* Create post button (label already updated in HTML) */
$('#btn-create-post').addEventListener('click', ()=> {
  openView('postTab');
  autofillPostEditor();
});

/* ---------- View switching ---------- */
function openView(viewId){
  // hide sidebar on navigation for mobile
  sidebar.classList.remove('show'); sidebar.setAttribute('aria-hidden','true');

  const views = $$('.view');
  views.forEach(v => v.classList.add('hidden'));
  const v = $('#'+viewId);
  if(v) v.classList.remove('hidden');

  // special render hooks
  if(viewId === 'feedTab') renderFeed();
  if(viewId === 'charactersTab') renderCharacterList();
  if(viewId === 'dmsTab') renderDMList();
  if(viewId === 'universeTab') renderUniverse();
}

/* default view */
openView('feedTab');

/* ---------- Markdown-lite renderer (bold/italic) ---------- */
function mdToHtml(text=''){ 
  const esc = escapeHTML(text);
  return esc.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/\n/g,'<br>');
}

/* ---------- POSTS: render, create ---------- */
function renderFeed(){
  const container = $('#postsContainer');
  container.innerHTML = '';
  const ordered = [...state.posts].sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
  for(const p of ordered){
    const el = document.createElement('div');
    el.className = 'post';
    el.innerHTML = `
      <div class="meta"><strong>${escapeHTML(p.displayName)}</strong> &nbsp; <span class="muted">@<a class="profile-link" data-username="${escapeHTML(p.username)}">${escapeHTML(p.username)}</a></span></div>
      <div class="content">${mdToHtml(p.content)}</div>
      <div class="actions">
        <button class="open-profile" data-username="${escapeHTML(p.username)}">[ → ]</button>
        <span>♡ likes ${p.likes}</span>
        <span>⇄</span>
        <span>⌯⌲ ${p.replies} replies</span>
      </div>`;
    container.appendChild(el);
  }

  // wire profile links and open-profile buttons
  $$('.profile-link', container).forEach(a => a.addEventListener('click', (e)=> {
    const u = e.currentTarget.dataset.username;
    openProfileByUsername(u);
  }));
  $$('.open-profile', container).forEach(b => b.addEventListener('click', (e)=> {
    const u = e.currentTarget.dataset.username;
    openProfileByUsername(u);
  }));
}

/* open profile by username; if not exist create? opens profile editor */
function openProfileByUsername(username){
  const prof = state.profiles.find(p=>p.username===username);
  if(prof) {
    // load into profileTab for viewing/editing
    loadProfileIntoEditor(prof);
    openView('profileTab');
  } else {
    // if username not found, open profileTab blank with username prefilled
    loadProfileIntoEditor({ id: null, displayName:'', username, bio:'', description:'', relationships:'', followers:0, likesMin:1, likesMax:25 });
    openView('profileTab');
  }
}

/* ---------- POST editor autofill & publish ---------- */
function getMyProfile(){
  return state.profiles.find(p=>p.id===state.myProfileId) || state.profiles[0] || null;
}
function autofillPostEditor(){
  const prof = getMyProfile();
  $('#post-displayName').value = prof ? prof.displayName : 'You';
  $('#post-username').value = prof ? prof.username : 'you';
  $('#post-content').value = '';
  $('#post-likes').textContent = prof ? `${prof.likesMin}–${prof.likesMax}` : '1–25';
  $('#post-replies').textContent = '5–250';
}
$('#btn-publish-post').addEventListener('click', ()=>{
  const displayName = $('#post-displayName').value.trim() || 'You';
  const username = ($('#post-username').value.trim() || 'you').replace(/^@/,'');
  const content = $('#post-content').value.trim();
  if(!content){ alert('Please write something.'); return; }

  // identify or create profile
  let profile = state.profiles.find(p=>p.username===username);
  if(!profile){
    profile = {
      id: 'p_'+Math.random().toString(36).slice(2,9),
      displayName, username, bio:'', description:'', relationships:'', followers:0, likesMin:1, likesMax:25, createdAt: now()
    };
    state.profiles.push(profile);
  }

  const likes = randBetween(profile.likesMin, profile.likesMax);
  const replies = randBetween(5,250);
  const post = { id: 'post_'+Math.random().toString(36).slice(2,9), profileId: profile.id, displayName, username, content, likes, replies, createdAt: now() };
  state.posts.push(post);
  saveState();
  openView('feedTab');
});

/* cancel post */
$('#btn-cancel-post').addEventListener('click', ()=> openView('feedTab'));

/* ---------- CHARACTER LIST ---------- */
$('#btn-create-character').addEventListener('click', ()=> {
  // open profile editor with blank fields
  loadProfileIntoEditor({ id:null, displayName:'', username:'', bio:'', description:'', relationships:'', followers:0, likesMin:1, likesMax:25 });
  openView('profileTab');
});

function renderCharacterList(){
  const container = $('#charactersContainer');
  container.innerHTML = '';
  const ordered = [...state.profiles].sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
  for(const p of ordered){
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `<strong>${escapeHTML(p.displayName)}</strong><div class="muted">@${escapeHTML(p.username)}</div>`;
    item.addEventListener('click', ()=> { loadProfileIntoEditor(p); openView('profileTab'); });
    container.appendChild(item);
  }
}

/* ---------- PROFILE editor ---------- */
function loadProfileIntoEditor(profile){
  // profile can be an object (existing or new)
  $('#profile-displayName').value = profile.displayName || '';
  $('#profile-username').value = profile.username || '';
  $('#profile-bio').value = profile.bio || '';
  $('#profile-description').value = profile.description || '';
  $('#profile-relationships').value = profile.relationships || '';
  $('#profile-followers').value = profile.followers || 0;
  $('#profile-likes-min').value = profile.likesMin || 1;
  $('#profile-likes-max').value = profile.likesMax || 25;

  // store current editing username on DOM for save/delete
  $('#profileTab').dataset.editingUsername = profile.username || '';
  $('#profileTab').dataset.editingId = profile.id || '';
}

$('#btn-save-profile').addEventListener('click', ()=>{
  const uname = ($('#profile-username').value||'').trim().replace(/^@/,'');
  if(!uname){ alert('Username required'); return; }
  const existing = state.profiles.find(p=>p.username===uname);
  const editingId = $('#profileTab').dataset.editingId;

  // collision handling: if existing and not the same ID, ask
  if(existing && existing.id && editingId && existing.id !== editingId){
    if(!confirm(`Username @${uname} exists. Overwrite?`)) return;
    // remove existing
    state.profiles = state.profiles.filter(p=>p.id !== existing.id);
  }

  if(editingId){
    // update existing profile by id
    const prof = state.profiles.find(p=>p.id === editingId);
    if(prof){
      prof.displayName = $('#profile-displayName').value || uname;
      prof.username = uname;
      prof.bio = $('#profile-bio').value;
      prof.description = $('#profile-description').value;
      prof.relationships = $('#profile-relationships').value;
      prof.followers = Number($('#profile-followers').value) || 0;
      prof.likesMin = Number($('#profile-likes-min').value) || 1;
      prof.likesMax = Number($('#profile-likes-max').value) || 25;
    }
  } else {
    // create new profile
    const newProf = {
      id: 'p_'+Math.random().toString(36).slice(2,9),
      displayName: $('#profile-displayName').value || uname,
      username: uname,
      bio: $('#profile-bio').value,
      description: $('#profile-description').value,
      relationships: $('#profile-relationships').value,
      followers: Number($('#profile-followers').value) || 0,
      likesMin: Number($('#profile-likes-min').value) || 1,
      likesMax: Number($('#profile-likes-max').value) || 25,
      createdAt: now()
    };
    state.profiles.push(newProf);

    // If first-time save and myProfileId not set, set it as MY PROFILE
    if(!state.myProfileId){
      state.myProfileId = newProf.id;
    }
  }

  saveState();
  openView('charactersTab');
});

/* delete profile */
$('#btn-delete-profile').addEventListener('click', ()=>{
  const editingId = $('#profileTab').dataset.editingId;
  if(!editingId){ alert('No profile to delete'); return; }
  if(!confirm('Delete this profile?')) return;
  state.profiles = state.profiles.filter(p=>p.id !== editingId);
  if(state.myProfileId === editingId) state.myProfileId = null;
  saveState();
  openView('charactersTab');
});

/* open DM from profile */
$('#btn-open-dm').addEventListener('click', ()=>{
  const uname = ($('#profile-username').value||'').trim().replace(/^@/,'');
  if(!uname){ alert('Enter username to DM'); return; }
  openDMWith(uname);
});

/* ---------- MY PROFILE behavior (nav first-time) ---------- */
$('.nav-btn[data-target="feedTab"]').addEventListener('click', ()=>{
  // this button in sidebar is actually MY PROFILE in original spec: clicking opens MY PROFILE
  // If myProfileId exists, open that profile else open profileTab blank to create
  const me = state.profiles.find(p=>p.id === state.myProfileId);
  if(me) { loadProfileIntoEditor(me); openView('profileTab'); }
  else { loadProfileIntoEditor({id:null, displayName:'', username:'', bio:'', description:'', relationships:'', followers:0, likesMin:1, likesMax:25}); openView('profileTab'); }
});

/* ---------- DM list and chat (updated header/back) ---------- */
function renderDMList(){
  const container = $('#conversationsContainer');
  container.innerHTML = '';
  // produce clickable conversations from state.dms
  const convs = Object.entries(state.dms).map(([id,conv])=>{
    const last = conv.messages && conv.messages.length ? conv.messages[conv.messages.length-1].createdAt : '';
    return { id, conv, last };
  }).sort((a,b)=> new Date(b.last || 0) - new Date(a.last || 0));

  for(const {id, conv} of convs){
    const other = conv.participants.find(u => u !== (getMyUsername() || 'you')) || conv.participants[0];
    const display = state.profiles.find(p=>p.username===other)?.displayName || other;
    const lastMsg = conv.messages.length ? conv.messages[conv.messages.length-1].text.slice(0,140) : '';
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `<strong>${escapeHTML(display)}</strong><div class="muted">@${escapeHTML(other)}</div><div class="muted">${escapeHTML(lastMsg)}</div>`;
    item.addEventListener('click', ()=> openDM(id, other));
    container.appendChild(item);
  }
}
/* NEW CONVERSATION label updated in HTML; behaviour unchanged */
$('#btn-new-conversation').addEventListener('click', ()=>{
  const uname = prompt('Start conversation with username (no @):');
  if(!uname) return;
  openDMWith(uname.trim());
});

function openDMWith(username){
  const key = 'dm_'+username;
  if(!state.dms[key]) state.dms[key] = { participants: [ getMyUsername() || 'you', username ], messages: [] };
  openDM(key, username);
}

function openDM(key, other){
  // set title
  $('#dmTitle').textContent = (state.profiles.find(p=>p.username===other)?.displayName || other) + ' @' + other;
  // load messages
  const conv = state.dms[key];
  const box = $('#dmMessages');
  box.innerHTML = '';
  for(const m of conv.messages){
    const el = document.createElement('div');
    el.className = 'msg ' + (m.from === (getMyUsername()||'you') ? 'right' : 'left');
    if(m.from !== (getMyUsername()||'you')) el.innerHTML = `<div class="who">${escapeHTML(m.from)}</div>`;
    el.innerHTML += `<div class="txt">${escapeHTML(m.text)}</div>`;
    box.appendChild(el);
  }
  // wire send
  $('#dmSend').onclick = () => {
    const text = $('#dmInput').value.trim();
    if(!text) return;
    const m = { id:'m_'+Math.random().toString(36).slice(2,9), from: (getMyUsername()||'you'), text, createdAt: now() };
    conv.messages.push(m);
    saveState();
    $('#dmInput').value = '';
    openView('dmTab');
    openDM(key, other); // re-open to refresh messages
  };
  openView('dmTab');
}

/* ---------- UNIVERSE (v1.5) ---------- */
function renderUniverse(){
  $('#universeText').value = state.universeText || '';
}
$('#btn-save-universe').addEventListener('click', ()=>{
  const text = $('#universeText').value || '';
  state.universeText = text;
  saveState();
  // small feedback: briefly flash the button (simple)
  const btn = $('#btn-save-universe');
  btn.textContent = '✧ Saved';
  setTimeout(()=> btn.textContent = '✧ Save', 1000);
});

/* ---------- Helper ---------- */
function getMyUsername(){ const me = state.profiles.find(p=>p.id === state.myProfileId); return me ? me.username : null; }

/* ---------- Initial render ---------- */
renderFeed();
renderCharacterList();
renderDMList();
renderUniverse();
saveState();

/* make sure feed updates when coming back */
window.addEventListener('hashchange', ()=> openView(location.hash.replace('#','') || 'feedTab'));
