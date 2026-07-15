const $=s=>document.querySelector(s), money=n=>'P'+Number(n).toLocaleString('en-BW');
const API = 'http://localhost:5001/api';
const countries={Botswana:['Gaborone','Francistown','Maun','Kasane','Palapye','Serowe','Mahalapye','Lobatse','Nata'],'South Africa':['Johannesburg','Pretoria','Polokwane','Rustenburg','Cape Town','Durban'],'Zimbabwe':['Harare','Bulawayo','Victoria Falls','Plumtree','Gweru'],'Zambia':['Lusaka','Livingstone','Kazungula','Kitwe','Ndola']};

const state={
  token:localStorage.rw_token||null,
  userId:localStorage.rw_userId||null,
  user:null,
  mode:'customer',
  page:'home',
  trips:[],
  requests:[],
  orders:{},
  currentOrder:null,
  wallet:null
};

function save(){localStorage.rw_token=state.token;localStorage.rw_userId=state.userId;}

async function apiCall(method,endpoint,data=null){
  const opts={method,headers:{'Content-Type':'application/json'}};
  if(state.token)opts.headers.Authorization=`Bearer ${state.token}`;
  if(data)opts.body=JSON.stringify(data);
  
  try{
    const res=await fetch(API+endpoint,opts);
    if(!res.ok){
      if(res.status===401){logout();return null;}
      const err=await res.json();
      toast(err.error||'API Error');
      return null;
    }
    return await res.json();
  }catch(e){
    toast('Network error');
    return null;
  }
}

async function logout(){
  state.token=null;state.userId=null;state.user=null;save();render();
}

async function loadTrips(){state.trips=await apiCall('GET','/trips');}
async function loadRequests(){state.requests=await apiCall('GET','/requests');}
async function loadWallet(){if(state.userId)state.wallet=await apiCall('GET',`/wallets/${state.userId}`);}

function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),2200)}
function badge(s){return `<span class='badge ${s==='published'||s==='accepted'?'success':s==='pending'?'warning':'neutral'}'>${s}</span>`}

function routeSearch(){return `<div class='route-search'><label>From<input id='from' list='cities' placeholder='City or country'></label><button>⇄</button><label>To<input id='to' list='cities' placeholder='Destination'></label><label>Date<input type='date'></label><button class='primary' id='find'>Find Trips</button><datalist id='cities'>${Object.entries(countries).flatMap(([c,a])=>a.map(x=>`<option value='${x}, ${c}'>`)).join('')}</datalist></div>`}

function tripCard(t){return `<div class='card trip-card'><div>${badge(t.status||'published')}<h3>${t.from_city} → ${t.to_city}</h3><p>${t.departure_date} • ${t.departure_time} • ${t.runner_name||'Runner'} • ★ ${t.rating||5}</p><div class='pills'><span>${t.capacity_kg} kg</span><span>${t.available_spaces||6} spaces</span></div></div><div class='price'><small>Potential earnings</small><strong>P3,200</strong><button class='primary view' data-id='${t.id}'>View Trip</button></div></div>`}

function heat(){return `<div class='heat'>${[['Johannesburg → Gaborone',96],['Harare → Francistown',82],['Gaborone → Maun',67],['Lusaka → Kasane',61]].map(x=>`<div><b>${x[0]}</b><i><em style='width:${x[1]}%'></em></i><span>${x[1]>80?'High':'Medium'}</span></div>`).join('')}</div>`}

function loginForm(){return `<form id='loginForm'><label>Email<input name='email' type='email' required></label><label>Password<input name='password' type='password' required></label><div style='display:flex;gap:10px;margin-top:12px;'><button type='submit' class='primary' style='flex:1;'>Login</button><button type='button' id='switchRegister' class='secondary' style='flex:1;background:#f0f0f0;color:#333;'>Register</button></div></form>`}

function registerForm(){return `<form id='regForm'><label>Full Name<input name='name' required></label><label>Email<input name='email' type='email' required></label><label>Password<input name='password' type='password' required></label><label>Role<select name='role'><option value='customer'>Customer</option><option value='runner'>Runner</option></select></label><div style='display:flex;gap:10px;margin-top:12px;'><button type='submit' class='primary' style='flex:1;'>Register</button><button type='button' id='switchLogin' class='secondary' style='flex:1;background:#f0f0f0;color:#333;'>Login</button></div></form>`}

function home(){
  return `<div class='hero'><div><small>BOTSWANA • SOUTH AFRICA • ZIMBABWE • ZAMBIA</small><h2>Someone is already going there. Let RunWise carry it.</h2><p>Find a trip, send a parcel, request shopping, or announce your own journey and earn along the way.</p></div><div class='wallet'><span>Trips available</span><strong>${state.trips.length}</strong></div></div>
  <div class='service-grid'>${[['🚗','Find a Trip','trips'],['📦','Send a Parcel','parcel'],['🛒','Shopping Request','shopping'],['📄','Documents','documents'],['💊','Medicine','medicine'],['🎁','Gift Delivery','gift'],['🚚','Large Item','large'],['✈️','Announce a Trip','announce']].map(x=>`<button class='service' data-act='${x[2]}'><b>${x[0]}</b><strong>${x[1]}</strong></button>`).join('')}</div>
  <div class='section'><h3>Search a route</h3></div><div class='card'>${routeSearch()}</div>
  <div class='section'><h3>Available trips</h3></div><div class='grid g2'>${state.trips.length?state.trips.map(tripCard).join(''):'<p>No trips available yet.</p>'}</div>
  <div class='section'><h3>Demand heat map</h3></div><div class='card'>${heat()}</div>`
}

function trips(){return `<div class='card'>${routeSearch()}</div><div class='section'><h3>Trip board</h3></div><div class='grid g2'>${state.trips.map(tripCard).join('')}</div>`}

function requests(){return `<div class='section'><h3>Your requests</h3><button id='newReq' class='primary'>+ Post Request</button></div><div class='card'>${state.requests.length?state.requests.map(r=>`<div class='order'><b>${r.type}</b><span>${r.from_city} → ${r.to_city}</span><span>${money(r.value||0)}</span><span class='badge ${r.status==='open'?'warning':'success'}'>${r.status}</span></div>`).join(''):'<p>No requests yet. Post one to find runners!</p>'}</div>`}

function live(){
  if(state.trips.length===0)return '<p>No active journey</p>';
  let t=state.trips[0],steps=['Heading to Pickup','Collected','Shopping Complete','Journey Started','Border Reached','Destination Reached','Delivered'];
  return `<div class='live-banner'><b>Your item is moving</b><span>${t.from_city} → ${t.to_city}</span></div><div class='grid g2'><div class='card map'><div class='route'></div><div class='pin a'></div><div class='pin b'></div><div class='car'>🚙</div></div><div class='card'><small>ORD-${state.currentOrder?.id||1001}</small><h3>${t.runner_name||'Runner'} • ${t.capacity_kg}kg vehicle</h3><p>Current location: Transit • ETA 16:45</p><div class='progress'><i style='width:46%'></i></div>${steps.map((s,i)=>`<div class='step ${i<2?'done':i===2?'now':''}'><i></i><div><b>${s}</b><small>${i<2?'Completed':i===2?'Live now':'Pending'}</small></div></div>`).join('')}</div></div><div class='grid g4 stats'><div class='card stat'><span>Distance left</span><strong>312 km</strong></div><div class='card stat'><span>Your position</span><strong>3 of 7</strong></div><div class='card stat'><span>ETA</span><strong>Tomorrow 14:30</strong></div><div class='card stat'><span>Next update</span><strong>Border</strong></div></div>`
}

function wallet(){return `<div class='grid g3'><div class='card stat'><span>Wallet balance</span><strong>${money(state.wallet?.balance||0)}</strong></div><div class='card stat'><span>Pending balance</span><strong>${money(state.wallet?.pending||0)}</strong></div><div class='card stat'><span>Total earned</span><strong>${money(state.wallet?.total_earned||0)}</strong></div></div><div class='section'><h3>Recent transactions</h3></div><div class='card'><p>No recent transactions</p></div>`}

function runner(){return `<div class='hero'><div><small>RUNNER MODE</small><h2>Turn your next journey into earnings.</h2><p>Announce your route and RunWise finds requests along the way.</p></div><div class='wallet'><span>Potential earnings</span><strong>${money(state.wallet?.balance||0)}</strong></div></div><div class='grid g4 stats'><div class='card stat'><span>Available requests</span><strong>${state.requests.length}</strong></div><div class='card stat'><span>Active journeys</span><strong>1</strong></div><div class='card stat'><span>Rating</span><strong>5.0</strong></div><div class='card stat'><span>On-time rate</span><strong>100%</strong></div></div><div class='section'><h3>Demand heat map</h3></div><div class='card'>${heat()}</div>`}

function announce(){return `<div class='card'><h3>Announce your journey</h3>${tripForm()}</div>`}

function tripForm(){return `<form id='tripForm'><label>From city<input name='from_city' required placeholder='Johannesburg'></label><label>To city<input name='to_city' required placeholder='Gaborone'></label><label>Departure date<input type='date' name='departure_date' required></label><label>Departure time<input type='time' name='departure_time' required></label><label>Vehicle type<input name='vehicle' required placeholder='Toyota Hilux'></label><label>Capacity (kg)<input name='capacity_kg' type='number' value='40' required></label><label class='full'>Stops<input name='stops' placeholder='Pretoria, Polokwane'></label><button class='primary full'>Publish Trip</button></form>`}

function mytrips(){return `<div class='section'><h3>Your trips</h3></div><div class='grid g2'>${state.trips.length?state.trips.map(tripCard).join(''):'<p>No trips announced yet</p>'}</div>`}

function matches(){return `<div class='grid g3'>${state.requests.slice(0,3).map(r=>`<div class='card'><small>REQUEST</small><h3>${r.type}</h3><p>${r.from_city} → ${r.to_city}</p><strong>${money(r.value||300)}</strong><button class='primary accept' data-rid='${r.id}'>Accept</button></div>`).join('')}</div>`}

function earnings(){return `<div class='grid g4 stats'><div class='card stat'><span>Available</span><strong>${money(state.wallet?.balance||0)}</strong></div><div class='card stat'><span>Pending</span><strong>${money(state.wallet?.pending||0)}</strong></div><div class='card stat'><span>Completed trips</span><strong>0</strong></div><div class='card stat'><span>Lifetime earnings</span><strong>${money(state.wallet?.total_earned||0)}</strong></div></div><div class='section'><h3>Withdrawal</h3></div><div class='card'><label>Amount<input type='number' id='withdrawAmount' placeholder='500' min='100'></label><button class='primary' id='withdrawBtn'>Withdraw to Orange Money</button></div>`}

function opts(sel){return Object.keys(countries).map(c=>`<option ${c===sel?'selected':''}>${c}</option>`).join('')}

function view(){
  if(!state.token)return `<div class='card' style='padding:40px;text-align:center;'><h3>Welcome to RunWise</h3><p>Login or register to get started</p><button class='primary' id='showLogin' style='margin:12px 0;'>Login</button><button style='background:#f0f0f0;color:#333;margin:12px 0;' id='showRegister'>Register</button></div>`;
  if(state.mode==='runner')return state.page==='announce'?announce():state.page==='mytrips'?mytrips():state.page==='matches'?matches():state.page==='live'?live():state.page==='earnings'?earnings():runner();
  return state.page==='trips'?trips():state.page==='requests'?requests():state.page==='live'?live():state.page==='wallet'?wallet():home()
}

async function render(){
  if(state.token){
    const menus={customer:[['home','⌂ Home'],['trips','🚗 Trips'],['requests','📦 Requests'],['live','📍 Live'],['wallet','◈ Wallet']],runner:[['runner','⌂ Runner'],['announce','✈ Announce'],['mytrips','🚗 My Trips'],['matches','⚡ Matches'],['live','📍 Live'],['earnings','◈ Earnings']]};
    $('#nav').innerHTML=menus[state.mode].map(x=>`<button class='nav-btn ${state.page===x[0]?'active':''}' data-page='${x[0]}'>${x[1]}</button>`).join('');
    document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>{state.page=b.dataset.page;render()});
    $('#portalName').textContent=state.mode==='runner'?'RUNNER MODE':'CUSTOMER MODE';
    $('#pageTitle').textContent=state.page;
    $('#authBtn').textContent='Logout';
    $('#authBtn').onclick=logout;
    let profile=$('#profile');
    profile.innerHTML=`<div class='avatar'>${state.user?.name?.[0]||'U'}</div><div><b>${state.user?.name||'User'}</b><small>${state.user?.role||'customer'}</small></div>`;
  }else{
    $('#nav').innerHTML='';
    $('#portalName').textContent='RUNWISE';
    $('#pageTitle').textContent='Login Required';
    $('#authBtn').textContent='Login';
    $('#authBtn').onclick=()=>openAuth();
  }
  
  $('#content').innerHTML=view();
  bind();
}

async function bind(){
  document.querySelectorAll('.service').forEach(b=>b.onclick=()=>{let a=b.dataset.act;if(a==='trips'){state.page='trips';render()}else if(a==='announce'){state.mode='runner';state.page='announce';render()}else openRequest(a)});
  document.querySelectorAll('.view').forEach(b=>b.onclick=()=>openTrip(b.dataset.id));
  document.querySelectorAll('.accept').forEach(b=>b.onclick=()=>acceptMatch(b.dataset.rid));
  
  let f=$('#find');if(f)f.onclick=()=>{state.page='trips';render()};
  let n=$('#newReq');if(n)n.onclick=()=>openRequest('parcel');
  
  let tf=$('#tripForm');if(tf)tf.onsubmit=submitTrip;
  let rf=$('#reqForm');if(rf)rf.onsubmit=submitRequest;
  let lf=$('#loginForm');if(lf)lf.onsubmit=submitLogin;
  let regf=$('#regForm');if(regf)regf.onsubmit=submitRegister;
  
  let switchReg=$('#switchRegister');if(switchReg)switchReg.onclick=()=>openAuth('register');
  let switchLog=$('#switchLogin');if(switchLog)switchLog.onclick=()=>openAuth('login');
  
  let wb=$('#withdrawBtn');if(wb)wb.onclick=submitWithdrawal;
  
  let showLogin=$('#showLogin');if(showLogin)showLogin.onclick=()=>openAuth('login');
  let showReg=$('#showRegister');if(showReg)showReg.onclick=()=>openAuth('register');
}

function openAuth(mode='login'){
  openModal(mode==='register'?'Create Account':'Login',mode==='register'?registerForm():loginForm());
}

async function submitLogin(e){
  e.preventDefault();
  let f=new FormData(e.target);
  let result=await apiCall('POST','/auth/login',{email:f.get('email'),password:f.get('password')});
  if(result){
    state.token=result.token;
    state.userId=result.userId;
    state.user=result;
    state.mode=result.role==='runner'?'runner':'customer';
    state.page=result.role==='runner'?'runner':'home';
    save();
    $('#modal').classList.add('hidden');
    await loadTrips();
    await loadRequests();
    await loadWallet();
    render();
    toast('Logged in successfully');
  }
}

async function submitRegister(e){
  e.preventDefault();
  let f=new FormData(e.target);
  let result=await apiCall('POST','/auth/register',{email:f.get('email'),password:f.get('password'),name:f.get('name'),role:f.get('role')});
  if(result){
    state.token=result.token;
    state.userId=result.userId;
    state.user=result;
    state.mode=result.role==='runner'?'runner':'customer';
    state.page=result.role==='runner'?'runner':'home';
    save();
    $('#modal').classList.add('hidden');
    await loadTrips();
    await loadRequests();
    await loadWallet();
    render();
    toast('Account created! Welcome to RunWise');
  }
}

async function submitTrip(e){
  e.preventDefault();
  let f=new FormData(e.target);
  let result=await apiCall('POST','/trips',{from_city:f.get('from_city'),to_city:f.get('to_city'),departure_date:f.get('departure_date'),departure_time:f.get('departure_time'),capacity_kg:+f.get('capacity_kg'),stops:f.get('stops')});
  if(result){
    $('#modal').classList.add('hidden');
    await loadTrips();
    state.page='mytrips';
    render();
    toast('Trip published!');
  }
}

async function submitRequest(e){
  e.preventDefault();
  let f=new FormData(e.target);
  let result=await apiCall('POST','/requests',{type:f.get('type'),from_city:f.get('from_city'),to_city:f.get('to_city'),value:+f.get('value'),details:f.get('details')});
  if(result){
    $('#modal').classList.add('hidden');
    await loadRequests();
    state.page='requests';
    render();
    toast('Request posted! Runners will see it now');
  }
}

async function submitWithdrawal(){
  let amt=+$('#withdrawAmount').value;
  if(!amt||amt<100)return toast('Minimum withdrawal is P100');
  let result=await apiCall('POST','/withdrawals',{amount:amt});
  if(result){
    await loadWallet();
    render();
    toast(`Withdrawal of ${money(amt)} submitted`);
  }
}

async function openRequest(type='parcel'){
  openModal('Post a Request',`<form id='reqForm'><label>Type<select name='type'><option>${type}</option><option>Shopping</option><option>Parcel</option><option>Documents</option><option>Medicine</option><option>Gift</option><option>Large Item</option></select></label><label>From city<input name='from_city' required></label><label>To city<input name='to_city' required></label><label>Estimated value<input type='number' name='value' value='300'></label><label class='full'>Details<textarea name='details'></textarea></label><button class='primary full'>Post Request</button></form>`);
}

async function openTrip(id){
  let t=state.trips.find(x=>x.id==id);
  if(!t)return;
  openModal(`${t.from_city} → ${t.to_city}`,`<p><b>${t.runner_name}</b> • ★ ${t.rating||5}</p><h3>Capacity</h3><p>${t.capacity_kg} kg • ${t.available_spaces||6} spaces</p><button id='bookTrip' class='primary'>Book this trip</button>`);
  $('#bookTrip').onclick=()=>bookTrip(t.id);
}

async function bookTrip(tripId){
  if(state.requests.length===0)return toast('Post a request first');
  let result=await apiCall('POST','/bookings',{trip_id:tripId,request_id:state.requests[0].id,runner_id:state.requests[0].runner_id||1});
  if(result){
    $('#modal').classList.add('hidden');
    toast('Booking created! Waiting for acceptance...');
    await loadTrips();
    await loadRequests();
    render();
  }
}

async function acceptMatch(requestId){
  toast('Match accepted! Order created');
}

function openModal(title,body){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=body;$('#modal').classList.remove('hidden')}

$('#notify').onclick=()=>toast('3 new routes match your request');
$('#close').onclick=()=>$('#modal').classList.add('hidden');

// Initial load
loadTrips();
render();
