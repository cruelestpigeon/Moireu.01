/* Moireu v1.8 — adds replies system + auto-character posting
   Built on v1.7 behavior; UI changes are minimal and additive.
*/

/* ---------- Utilities ---------- */
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from((ctx||document).querySelectorAll(sel));
const now = () => new Date().toISOString();
const randBetween = (a,b) => { a=Number(a)||0; b=Number(b)||0; if(a>b)[a,b]=[b,a]; return Math.floor(Math.random()*(b-a+1))+a; };
const escapeHTML = s => (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* ---------- Storage model (extend v1.7) ---------- */
const STORAGE_KEY = 'moireu_v1.8_state';
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
  const universeText = "Welcome to this universe. Describe the setting here.";
  // replies map: postId => [ replyObj ... ]
  const replies = {};
  // repliesGenerated set
  const repliesGenerated = {};
  return { profiles: [p_me,p_a], posts, dms, myProfileId: p_me.id, universeText, replies, repliesGenerated };
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

/* Create post button */
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
  if(viewId === 'repliesTab'){ /* no-op here; replies are rendered by openReplies */ }
}

/* default view */
openView('feedTab');

/* ---------- Markdown-lite renderer (bold/italic) ---------- */
function mdToHtml(text=''){ 
  const esc = escapeHTML(text);
  return esc.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/\n/g,'<br>');
}

/* ---------- Helper ---------- */
function getMyProfile(){ return state.profiles.find(p=>p.id===state.myProfileId) || state.profiles[0] || null; }
function getMyUsername(){ const me = getMyProfile(); return me ? me.username : null; }

/* ---------- POSTS: render, create (extend to auto-post characters) ---------- */
function renderFeed(){
  const container = $('#postsContainer');
  container.innerHTML = '';
  const ordered = [...state.posts].sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
  for(const p of ordered){
    const el = document.createElement('div');
    el.className = 'post';
    el.dataset.postId = p.id;
    el.innerHTML = `
      <div class="meta"><strong>${escapeHTML(p.displayName)}</strong> &nbsp; <span class="muted">@<a class="profile-link" data-username="${escapeHTML(p.username)}">${escapeHTML(p.username)}</a></span></div>
      <div class="content">${mdToHtml(p.content)}</div>
      <div class="actions">
        <button class="open-profile" data-username="${escapeHTML(p.username)}">[ → ]</button>
        <span>♡ ${p.likes}</span>
        <span>⇄</span>
        <button class="open-replies" data-postid="${p.id}">⌯⌲ ${p.replies}</button>
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

  // wire replies buttons
  $$('.open-replies', container).forEach(btn => btn.addEventListener('click', (e)=>{
    const postId = e.currentTarget.dataset.postid;
    openReplies(postId);
  }));
}

/* open profile by username; if not exist create? loads profile editor */
function openProfileByUsername(username){
  const prof = state.profiles.find(p=>p.username===username);
  if(prof) {
    loadProfileIntoEditor(prof);
    openView('profileTab');
  } else {
    loadProfileIntoEditor({ id: null, displayName:'', username, bio:'', description:'', relationships:'', followers:0, likesMin:1, likesMax:25 });
    openView('profileTab');
  }
}

/* POST editor autofill & publish */
function autofillPostEditor(){
  const prof = getMyProfile();
  $('#post-displayName').value = prof ? prof.displayName : 'You';
  $('#post-username').value = prof ? prof.username : 'you';
  $('#post-content').value = '';
  $('#post-likes').textContent = prof ? `${prof.likesMin}–${prof.likesMax}` : '1–25';
  $('#post-replies').textContent = '5–250';
}

/* publish post — extended: if publisher is the user, generate character posts (1 per character) */
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

  // If the post is authored by the user's profile, generate a post from each character (simulated)
  const myProfile = getMyProfile();
  if(myProfile && profile.id === myProfile.id) {
    // For each character (profiles excluding the user's profile), create a simulated post
    const chars = state.profiles.filter(p=>p.id !== myProfile.id);
    for(const c of chars){
      const cLikes = randBetween(c.likesMin || 1, c.likesMax || 25);
      const cReplies = randBetween(0,50);
      // Simulated content: keep it short and safe — placeholder for AI
      const cContent = `${c.displayName} responds to ${displayName}'s post.`;
      const cpost = { id: 'post_'+Math.random().toString(36).slice(2,9), profileId: c.id, displayName: c.displayName, username: c.username, content: cContent, likes: cLikes, replies: cReplies, createdAt: now() };
      state.posts.push(cpost);
    }
  }

  saveState();
  openView('feedTab');
});

/* cancel post */
$('#btn-cancel-post').addEventListener('click', ()=> openView('feedTab'));

/* ---------- CHARACTER LIST ---------- */
$('#btn-create-character').addEventListener('click', ()=> {
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

/* ---------- PROFILE editor (unchanged behavior) ---------- */
function loadProfileIntoEditor(profile){
  $('#profile-displayName').value = profile.displayName || '';
  $('#profile-username').value = profile.username || '';
  $('#profile-bio').value = profile.bio || '';
  $('#profile-description').value = profile.description || '';
  $('#profile-relationships').value = profile.relationships || '';
  $('#profile-followers').value = profile.followers || 0;
  $('#profile-likes-min').value = profile.likesMin || 1;
  $('#profile-likes-max').value = profile.likesMax || 25;

  $('#profileTab').dataset.editingUsername = profile.username || '';
  $('#profileTab').dataset.editingId = profile.id || '';
}

$('#btn-save-profile').addEventListener('click', ()=>{
  const uname = ($('#profile-username').value||'').trim().replace(/^@/,'');
  if(!uname){ alert('Username required'); return; }
  const existing = state.profiles.find(p=>p.username===uname);
  const editingId = $('#profileTab').dataset.editingId;

  if(existing && existing.id && editingId && existing.id !== editingId){
    if(!confirm(`Username @${uname} exists. Overwrite?`)) return;
    state.profiles = state.profiles.filter(p=>p.id !== existing.id);
  }

  if(editingId){
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

/* ---------- MY PROFILE nav behavior (unchanged) ---------- */
$('.nav-btn[data-target="feedTab"]').addEventListener('click', ()=>{
  const me = state.profiles.find(p=>p.id === state.myProfileId);
  if(me) { loadProfileIntoEditor(me); openView('profileTab'); }
  else { loadProfileIntoEditor({id:null, displayName:'', username:'', bio:'', description:'', relationships:'', followers:0, likesMin:1, likesMax:25}); openView('profileTab'); }
});

/* ---------- DM list and chat (unchanged) ---------- */
function renderDMList(){
  const container = $('#conversationsContainer');
  container.innerHTML = '';
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
  $('#dmTitle').textContent = (state.profiles.find(p=>p.username===other)?.displayName || other) + ' @' + other;
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
  $('#dmSend').onclick = () => {
    const text = $('#dmInput').value.trim();
    if(!text) return;
    const m = { id:'m_'+Math.random().toString(36).slice(2,9), from: (getMyUsername()||'you'), text, createdAt: now() };
    conv.messages.push(m);
    saveState();
    $('#dmInput').value = '';
    openView('dmTab');
    openDM(key, other);
  };
  openView('dmTab');
}

/* ---------- UNIVERSE (unchanged) ---------- */
function renderUniverse(){
  $('#universeText').value = state.universeText || '';
}
$('#btn-save-universe').addEventListener('click', ()=>{
  const text = $('#universeText').value || '';
  state.universeText = text;
  saveState();
  const btn = $('#btn-save-universe');
  btn.textContent = '[ ✧ Saved ]';
  setTimeout(()=> btn.textContent = '[ ✧ ]', 900);
});

/* ---------- REPLIES system (new) ---------- */

/*
  Data model for reply object:
  { id, postId, profileId, displayName, username, content, likes, createdAt }
*/

/* Open the replies tab for a given postId. If replies not generated, generate AI-like replies. */
function openReplies(postId){
  const post = state.posts.find(p => p.id === postId);
  if(!post) { alert('Post not found'); return; }

  // If replies array missing, create it
  if(!state.replies[postId]) state.replies[postId] = [];

  // If replies haven't been "generated" yet for this post, simulate AI replies from 1/3 of characters
  if(!state.repliesGenerated[postId]){
    generateCharacterRepliesForPost(postId);
    state.repliesGenerated[postId] = true;
    saveState();
  }

  // Render the replies UI for this post
  renderReplies(postId);
  openView('repliesTab');

  // store current open replies postId on DOM for later reference
  $('#repliesTab').dataset.postId = postId;
}

/* Simulated "Management AI" selects 1/3 of characters and creates replies (placeholder for future AI) */
function generateCharacterRepliesForPost(postId){
  const post = state.posts.find(p => p.id === postId);
  if(!post) return;
  // Determine characters (profiles excluding the current user)
  const chars = state.profiles.filter(p => p.id !== state.myProfileId);
  if(chars.length === 0) return;
  const numToReply = Math.max(1, Math.floor(chars.length / 3));
  // simple deterministic-ish selection: shuffle then slice
  const shuffled = chars.slice().sort(()=> 0.5 - Math.random());
  const selected = shuffled.slice(0, numToReply);
  for(const c of selected){
    const likes = randBetween(c.likesMin || 1, c.likesMax || 25);
    const content = `${c.displayName} thinks about "${post.content.slice(0,80)}" — (auto-reply)`;
    const reply = {
      id: 'r_'+Math.random().toString(36).slice(2,9),
      postId,
      profileId: c.id,
      displayName: c.displayName,
      username: c.username,
      content,
      likes,
      createdAt: now()
    };
    state.replies[postId].push(reply);
  }
}

/* Render replies view for a postId */
function renderReplies(postId){
  const post = state.posts.find(p => p.id === postId);
  const postContainer = $('#repliesPost');
  const replContainer = $('#repliesContainer');
  postContainer.innerHTML = '';
  replContainer.innerHTML = '';

  if(!post) {
    postContainer.textContent = '(post not found)';
    return;
  }

  // Render main post block
  const pEl = document.createElement('div');
  pEl.className = 'post';
  pEl.innerHTML = `
    <div class="meta"><strong>${escapeHTML(post.displayName)}</strong> &nbsp; <span class="muted">@${escapeHTML(post.username)}</span></div>
    <div class="content">${mdToHtml(post.content)}</div>
    <div class="actions"><span>♡ ${post.likes}</span> <span>⇄</span> <span class="muted">⌯⌲ ${post.replies}</span></div>
  `;
  postContainer.appendChild(pEl);

  // Render completed replies (newest first)
  const replies = (state.replies[postId] || []).slice().sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
  for(const r of replies){
    const item = document.createElement('div');
    item.className = 'reply-item';
    item.innerHTML = `
      <div class="meta"><strong>${escapeHTML(r.displayName)}</strong> &nbsp; <span class="muted">@${escapeHTML(r.username)}</span> &nbsp; <span class="muted">${new Date(r.createdAt).toLocaleString()}</span></div>
      <div class="content">${mdToHtml(r.content)}</div>
      <div class="actions"><span>♡ ${r.likes}</span></div>
    `;
    replContainer.appendChild(item);
  }

  // Wire "Reply" button
  $('#btn-new-reply').onclick = () => openBlankReply(postId);
}

/* Open blank reply editor prefilled for current user */
function openBlankReply(postId){
  const post = state.posts.find(p => p.id === postId);
  if(!post) return;

  const me = getMyProfile();
  $('#reply-editor-displayName').textContent = me ? me.displayName : 'You';
  $('#reply-editor-username').textContent = me ? `@${me.username}` : '@you';
  $('#reply-target-line').textContent = `➜ Reply to @${post.username}`;
  $('#reply-content').value = '';
  $('#reply-likes').textContent = me ? randBetween(me.likesMin || 1, me.likesMax || 25) : randBetween(1,25);

  // store metadata on DOM
  $('#replyEditorTab').dataset.postId = postId;

  $('#btn-publish-reply').onclick = () => {
    publishReplyFromEditor();
  };

  openView('replyEditorTab');
}

/* Publish the reply currently in the reply editor */
function publishReplyFromEditor(){
  const postId = $('#replyEditorTab').dataset.postId;
  const post = state.posts.find(p=>p.id === postId);
  if(!post){ alert('No post selected'); openView('repliesTab'); return; }

  const me = getMyProfile();
  const displayName = me ? me.displayName : ($('#reply-editor-displayName').textContent || 'You');
  const username = me ? me.username : ($('#reply-editor-username').textContent || 'you').replace(/^@/,'');
  const content = $('#reply-content').value.trim();
  if(!content){ alert('Write a reply first'); return; }
  const likes = me ? randBetween(me.likesMin || 1, me.likesMax || 25) : randBetween(1,25);

  const reply = {
    id: 'r_'+Math.random().toString(36).slice(2,9),
    postId,
    profileId: me ? me.id : null,
    displayName,
    username,
    content,
    likes,
    createdAt: now()
  };

  if(!state.replies[postId]) state.replies[postId] = [];
  state.replies[postId].push(reply);

  saveState();
  // after publishing, go back to replies view and re-render
  renderReplies(postId);
  openView('repliesTab');
}

/* ---------- Initial render ---------- */
renderFeed();
renderCharacterList();
renderDMList();
renderUniverse();
saveState();

/* ensure feed updates on hashchange (unchanged) */
window.addEventListener('hashchange', ()=> openView(location.hash.replace('#','') || 'feedTab'));
