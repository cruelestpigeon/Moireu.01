/* Moireu v0.1 - app.js
   Client-only SPA using localStorage.
*/

(() => {
  /* ---------- Utilities ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const id = (n) => n + '_' + Math.random().toString(36).slice(2,9);
  const now = () => new Date().toISOString();

  const mdToHtml = (text='') => {
    // minimal markdown: **bold**, *italic* -> HTML; escape
    const esc = text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return esc
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/\n/g,'<br>');
  };

  /* ---------- Storage model ---------- */
  const STORAGE_KEY = 'moireu_v0.1';
  const defaultState = {
    profiles: [],   // {id, displayName, username, bio, description, relationships, followers, likesMin, likesMax, createdAt}
    posts: [],      // {id, profileId, displayName, username, content, likes, replies, createdAt}
    dms: {},        // { conversationId: {participants:[username,...], messages:[{id,from,text,createdAt}]} }
    myProfileId: null,
  };

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) {
        const s = JSON.stringify(seedState());
        localStorage.setItem(STORAGE_KEY, s);
        return JSON.parse(s);
      }
      return JSON.parse(raw);
    } catch(e) {
      console.error('loadState', e);
      return seedState();
    }
  }

  function seedState(){
    const p1 = { id: 'p_me', displayName: 'You', username: 'you', bio: 'My main profile', description: 'Player profile', relationships:'', followers: 42, likesMin: 5, likesMax: 150, createdAt: now()};
    const p2 = { id: 'p_aria', displayName: 'Aria', username: 'aria', bio: 'Wandering bard', description:'Plays lute.', relationships:'friend of You', followers: 128, likesMin: 20, likesMax: 400, createdAt: now()};
    const posts = [
      {id: id('post'), profileId:p2.id, displayName:p2.displayName, username:p2.username, content:'Hello world! **I sing** tonight. #bard', likes: randBetween(p2.likesMin,p2.likesMax), replies: randBetween(5,250), createdAt: now()},
      {id: id('post'), profileId:p1.id, displayName:p1.displayName, username:p1.username, content:'Starting Moireu v0.1 — *client-only*!', likes: randBetween(p1.likesMin,p1.likesMax), replies: randBetween(5,250), createdAt: now()}
    ];
    const dms = {};
    dms['dm_'+p2.username] = { participants: [p1.username, p2.username], messages: [{id:id('m'), from:p2.username, text:'Hey! Want to RP?', createdAt: now()}] };
    return { profiles:[p1,p2], posts, dms, myProfileId: p1.id };
  }

  function saveState(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){ console.error('saveState',e); }
  }

  function randBetween(a,b){ a=Number(a)||0; b=Number(b)||0; if(a>b) [a,b]=[b,a]; return Math.floor(Math.random()*(b-a+1))+a; }

  /* ---------- App State ---------- */
  let state = loadState();

  /* ---------- Routing & View Utils ---------- */
  const viewRoot = $('#view-root');

  function routeTo(view, opts){
    location.hash = '#/'+view + (opts? '/'+encodeURIComponent(JSON.stringify(opts)) : '');
  }

  function currentView(){
    const hash = location.hash.replace(/^#\//,'');
    if(!hash) return 'feed';
    const parts = hash.split('/');
    return parts[0] || 'feed';
  }

  function parseOpts(){
    const hash = location.hash.replace(/^#\//,'');
    const parts = hash.split('/');
    if(parts.length < 2) return null;
    try { return JSON.parse(decodeURIComponent(parts[1])); } catch(e){ return null; }
  }

  /* ---------- Rendering ---------- */

  function render(){
    const v = currentView();
    // top title adjustments
    const topTitle = $('#top-title');
    if(v === 'feed') topTitle.textContent = 'GLOBAL FEED';
    else if(v === 'post') topTitle.textContent = 'POST';
    else if(v === 'profile') topTitle.textContent = 'PROFILE';
    else if(v === 'characters') topTitle.textContent = 'CHARACTERS';
    else if(v === 'dms') topTitle.textContent = 'DIRECT MESSAGES';
    else topTitle.textContent = 'MOIREU';

    // Clear root
    viewRoot.innerHTML = '';

    if(v === 'feed') renderFeed();
    else if(v === 'post') renderPostEditor(parseOpts());
    else if(v === 'profile') renderProfile(parseOpts());
    else if(v === 'characters') renderCharacters();
    else if(v === 'dms') renderDMList();
    else if(v === 'dm') renderDMChat(parseOpts());
    else renderFeed();
  }

  /* ----- Feed ----- */
  function renderFeed(){
    const tpl = document.getElementById('tpl-global-feed').content.cloneNode(true);
    const postsContainer = tpl.getElementById('posts-container');

    // sort newest-first by createdAt
    const ordered = [...state.posts].sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
    for(const p of ordered){
      const node = document.createElement('div');
      node.className = 'post';
      node.innerHTML = `
        <div class="meta"><strong>${escapeHtml(p.displayName)}</strong> &nbsp; <span class="muted">@${escapeHtml(p.username)}</span></div>
        <div class="content">${mdToHtml(p.content)}</div>
        <div class="actions">
          <button data-action="open" data-username="${p.username}" class="link-btn">[Open]</button>
          <span>♡ likes ${p.likes}</span>
          <span>⇄</span>
          <span>⌯⌲ ${p.replies} replies</span>
        </div>
      `;
      postsContainer.appendChild(node);

      node.querySelector('[data-action="open"]').addEventListener('click', (e)=>{
        const uname = e.currentTarget.dataset.username;
        const prof = state.profiles.find(x=>x.username===uname);
        if(prof) routeTo('profile', { username: uname });
      });
    }

    viewRoot.appendChild(tpl);
  }

  /* ----- Post Editor ----- */
  function renderPostEditor(opts){
    const tpl = document.getElementById('tpl-post-editor').content.cloneNode(true);
    const root = tpl.querySelector('section');
    const displayInput = tpl.getElementById('edit-displayName');
    const usernameInput = tpl.getElementById('edit-username');
    const contentInput = tpl.getElementById('edit-content');
    const likesSpan = tpl.getElementById('edit-likes');
    const repliesSpan = tpl.getElementById('edit-replies');

    // Pre-fill from my profile if present or from opts.username
    const optU = opts && opts.username;
    const prof = (optU ? state.profiles.find(p=>p.username===optU) : state.profiles.find(p=>p.id===state.myProfileId)) || (state.profiles[0] || null);

    if(prof){
      displayInput.value = prof.displayName;
      usernameInput.value = prof.username;
      likesSpan.textContent = `${prof.likesMin}–${prof.likesMax}`;
      repliesSpan.textContent = '5–250';
    }

    tpl.getElementById('btn-save-post').addEventListener('click', ()=>{
      const displayName = displayInput.value.trim() || (prof?prof.displayName:'You');
      const username = (usernameInput.value.trim() || (prof?prof.username:'you')).replace(/^@/,'');
      const content = contentInput.value.trim();
      if(!content){ alert('Please write something.'); return; }

      // identify profile: if username exists use that profile, else create a profile placeholder
      let profile = state.profiles.find(p=>p.username===username);
      if(!profile){
        profile = {
          id: id('p'), displayName, username, bio:'', description:'', relationships:'', followers:0, likesMin:1, likesMax:25, createdAt: now()
        };
        state.profiles.push(profile);
      }

      const likes = randBetween(profile.likesMin, profile.likesMax);
      const replies = randBetween(5,250);
      const post = { id: id('post'), profileId: profile.id, displayName, username, content, likes, replies, createdAt: now() };
      state.posts.push(post);
      saveState();
      routeTo('feed');
      render();
    });

    tpl.getElementById('btn-cancel-post').addEventListener('click', ()=>{
      routeTo('feed');
      render();
    });

    viewRoot.appendChild(tpl);
  }

  /* ----- Profiles ----- */
  function renderProfile(opts){
    // opts: { username } or { new: true }
    const tpl = document.getElementById('tpl-profile').content.cloneNode(true);
    const root = tpl.querySelector('section');

    const backBtn = tpl.getElementById('btn-back-profile');
    const inputDisplay = tpl.getElementById('profile-displayName');
    const inputUsername = tpl.getElementById('profile-username');
    const inputBio = tpl.getElementById('profile-bio');
    const inputDesc = tpl.getElementById('profile-description');
    const inputRel = tpl.getElementById('profile-relationships');
    const inputFollowers = tpl.getElementById('profile-followers');
    const inputLikesMin = tpl.getElementById('profile-likes-min');
    const inputLikesMax = tpl.getElementById('profile-likes-max');
    const btnSave = tpl.getElementById('btn-save-profile');
    const btnDelete = tpl.getElementById('btn-delete-profile');
    const btnDM = tpl.getElementById('btn-open-dm');

    const username = opts && opts.username;

    let profile = username ? state.profiles.find(p=>p.username===username) : (state.profiles.find(p=>p.id===state.myProfileId) || null);

    if(profile){
      inputDisplay.value = profile.displayName;
      inputUsername.value = profile.username;
      inputBio.value = profile.bio || '';
      inputDesc.value = profile.description || '';
      inputRel.value = profile.relationships || '';
      inputFollowers.value = profile.followers || 0;
      inputLikesMin.value = profile.likesMin || 0;
      inputLikesMax.value = profile.likesMax || 0;
    } else {
      // new blank profile
      inputDisplay.value = '';
      inputUsername.value = '';
      inputBio.value = '';
      inputDesc.value = '';
      inputRel.value = '';
      inputFollowers.value = 0;
      inputLikesMin.value = 1;
      inputLikesMax.value = 25;
      // Hide delete
      btnDelete.style.display = 'none';
    }

    backBtn.addEventListener('click', ()=>{
      routeTo('feed');
      render();
    });

    btnSave.addEventListener('click', ()=>{
      const uname = (inputUsername.value || '').trim().replace(/^@/,'');
      if(!uname){ alert('Username required'); return; }
      // If username exists and is different profile, ask? -> overwrite for simplicity
      let existing = state.profiles.find(p=>p.username===uname);
      if(existing && profile && existing.id !== profile.id){
        // collision: we'll alert and abort
        if(!confirm(`Username @${uname} already exists. Overwrite that profile?`)) return;
        // delete existing
        state.profiles = state.profiles.filter(p=>p.id !== existing.id);
        existing = null;
      }

      if(!profile){
        profile = {
          id: id('p'), displayName: inputDisplay.value||uname, username: uname,
          bio: inputBio.value, description: inputDesc.value, relationships: inputRel.value,
          followers: Number(inputFollowers.value) || 0, likesMin: Number(inputLikesMin.value)||1, likesMax: Number(inputLikesMax.value)||25,
          createdAt: now()
        };
        state.profiles.push(profile);
      } else {
        profile.displayName = inputDisplay.value || uname;
        profile.username = uname;
        profile.bio = inputBio.value;
        profile.description = inputDesc.value;
        profile.relationships = inputRel.value;
        profile.followers = Number(inputFollowers.value) || 0;
        profile.likesMin = Number(inputLikesMin.value) || 1;
        profile.likesMax = Number(inputLikesMax.value) || 25;
      }

      // If saving first time and this was My Profile creation
      if(!state.myProfileId){
        // create My Profile if none exists
        state.myProfileId = profile.id;
      }

      saveState();
      // ensure Characters list shows the new profile
      routeTo('characters');
      render();
    });

    btnDelete.addEventListener('click', ()=>{
      if(!profile) return;
      if(!confirm('Delete this profile? This will not delete posts or DMs automatically.')) return;
      state.profiles = state.profiles.filter(p=>p.id !== profile.id);
      if(state.myProfileId === profile.id) state.myProfileId = null;
      saveState();
      routeTo('characters');
      render();
    });

    btnDM.addEventListener('click', ()=>{
      const uname = inputUsername.value.trim();
      if(!uname){ alert('Enter username to DM'); return; }
      openDMWith(uname);
    });

    viewRoot.appendChild(tpl);
  }

  /* ----- Characters list ----- */
  function renderCharacters(){
    const tpl = document.getElementById('tpl-characters-list').content.cloneNode(true);
    const container = tpl.getElementById('characters-container');
    const btnCreate = tpl.getElementById('btn-create-character');
    const btnBack = tpl.getElementById('btn-back-characters');

    const ordered = [...state.profiles].sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
    for(const p of ordered){
      const n = document.createElement('div');
      n.className = 'item';
      n.innerHTML = `<strong>${escapeHtml(p.displayName)}</strong> <div class="muted">@${escapeHtml(p.username)}</div>`;
      n.addEventListener('click', ()=> {
        routeTo('profile', { username: p.username });
        render();
      });
      container.appendChild(n);
    }

    btnCreate.addEventListener('click', ()=>{
      routeTo('profile', { new: true });
      // we want blank profile - passing no username will result in blank form
      renderProfile({});
    });

    btnBack.addEventListener('click', ()=>{
      routeTo('feed');
      render();
    });

    viewRoot.appendChild(tpl);
  }

  /* ----- DMs ----- */
  function renderDMList(){
    const tpl = document.getElementById('tpl-dm-list').content.cloneNode(true);
    const container = tpl.getElementById('conversations-container');
    const btnNew = tpl.getElementById('btn-new-conversation');

    // conversations sorted by last message time (or creation)
    const convs = Object.entries(state.dms).map(([id,conv])=>{
      const last = conv.messages && conv.messages.length ? conv.messages[conv.messages.length-1].createdAt : null;
      return { id, conv, last };
    }).sort((a,b)=> new Date(b.last || 0) - new Date(a.last || 0));

    for(const {id:cid, conv} of convs){
      const other = conv.participants.find(u => u !== (getMyUsername() || 'you')) || conv.participants[0];
      const display = state.profiles.find(p=>p.username===other)?.displayName || other;
      const lastMsg = conv.messages.length ? conv.messages[conv.messages.length-1].text.slice(0,140) : '';
      const n = document.createElement('div');
      n.className = 'item';
      n.innerHTML = `<strong>${escapeHtml(display)}</strong><div class="muted">@${escapeHtml(other)}</div><div class="muted">${escapeHtml(lastMsg)}</div>`;
      n.addEventListener('click', ()=> {
        routeTo('dm', { id: cid, with: other });
        render();
      });
      container.appendChild(n);
    }

    btnNew.addEventListener('click', async ()=>{
      const uname = prompt('Start conversation with username (no @):');
      if(!uname) return;
      openDMWith(uname.trim());
    });

    viewRoot.appendChild(tpl);
  }

  function openDMWith(username){
    // ensure conversation exists keyed by dm_<username> (simple model)
    const key = 'dm_'+username;
    if(!state.dms[key]){
      state.dms[key] = { participants: [ getMyUsername() || 'you', username ], messages: [] };
      saveState();
    }
    routeTo('dm', { id: key, with: username });
    render();
  }

  function renderDMChat(opts){
    const tpl = document.getElementById('tpl-dm-chat').content.cloneNode(true);
    const dmTitle = tpl.getElementById('dm-title');
    const dmMessages = tpl.getElementById('dm-messages');
    const dmInput = tpl.getElementById('dm-input');
    const dmSend = tpl.getElementById('dm-send');
    const backBtn = tpl.getElementById('btn-back-dm');

    const idOpt = opts && opts.id;
    const key = idOpt || ('dm_' + (opts && opts.with));
    const conv = state.dms[key];
    if(!conv){
      viewRoot.appendChild(document.createTextNode('Conversation not found.'));
      return;
    }
    const other = conv.participants.find(u=>u !== (getMyUsername()||'you')) || conv.participants[0];
    dmTitle.innerHTML = `<strong>${escapeHtml(state.profiles.find(p=>p.username===other)?.displayName || other)}</strong> @${escapeHtml(other)}`;

    // messages
    for(const m of conv.messages){
      const el = document.createElement('div');
      el.className = 'msg ' + (m.from === (getMyUsername()||'you') ? 'right' : 'left');
      if(m.from !== (getMyUsername()||'you')) el.innerHTML = `<div class="who">${escapeHtml(m.from)}</div>`;
      el.innerHTML += `<div class="txt">${escapeHtml(m.text)}</div>`;
      dmMessages.appendChild(el);
    }
    dmMessages.scrollTop = dmMessages.scrollHeight;

    dmSend.addEventListener('click', ()=>{
      const text = dmInput.value.trim();
      if(!text) return;
      const m = { id: id('m'), from: (getMyUsername()||'you'), text, createdAt: now() };
      conv.messages.push(m);
      saveState();
      // re-render chat
      routeTo('dm', { id: key, with: other });
      render();
    });

    backBtn.addEventListener('click', ()=>{
      routeTo('dms');
      render();
    });

    viewRoot.appendChild(tpl);
  }

  function getMyUsername(){
    const me = state.profiles.find(p=>p.id === state.myProfileId);
    return me ? me.username : null;
  }

  /* ---------- Helpers ---------- */
  function escapeHtml(s){
    return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ---------- Top-level nav bindings ---------- */
  function setupNav(){
    $('#nav-myprofile').addEventListener('click', ()=>{
      // On first time click, open MY PROFILE editor (create if none)
      if(!state.myProfileId){
        // open profile creation view (blank)
        routeTo('profile', {});
      } else {
        const me = state.profiles.find(p => p.id === state.myProfileId);
        if(me) routeTo('profile', { username: me.username });
        else routeTo('profile', {});
      }
      render();
    });
    $('#nav-dms').addEventListener('click', ()=>{
      routeTo('dms');
      render();
    });
    $('#nav-characters').addEventListener('click', ()=>{
      routeTo('characters');
      render();
    });
    $('#btn-create-post').addEventListener('click', ()=>{
      // open post editor with myProfile if exists
      const me = state.profiles.find(p => p.id === state.myProfileId);
      if(me) routeTo('post', { username: me.username });
      else routeTo('post', {});
      render();
    });

    // settings nav button (currently stub)
    $('#nav-settings').addEventListener('click', ()=> {
      alert('Settings placeholder — nothing here yet.');
    });
  }

  /* ---------- Init ---------- */
  function init(){
    setupNav();
    // initial route
    if(!location.hash) routeTo('feed');
    // wire hash changes
    window.addEventListener('hashchange', render);
    render();
  }

  init();

})();
