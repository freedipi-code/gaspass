const $=(selector)=>document.querySelector(selector);
const escapeHtml=(value)=>String(value??'').replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const money=(value)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
const imageUrl=(image)=>image?`/${String(image).replace(/^\/+/, '')}`:'/images/cana.jpeg';
function getBrowserId(){let id=localStorage.getItem('canna-browser-id');if(!id){id=crypto.randomUUID();localStorage.setItem('canna-browser-id',id)}return id}
function initials(name){return String(name||'Canna Express').split(/\s+/).map(part=>part[0]).slice(0,2).join('').toUpperCase()}
function statusLabel(status){return({pending:'Pending',paid:'Paid',shipped:'Shipped',cancelled:'Cancelled'})[status]||status}
function formatDate(date){if(!date)return'—';return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(date))}
function showToast(message){const toast=$('#toast');toast.textContent=message;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),2400)}
async function api(path,options={}){const response=await fetch(`/api/store${path}`,{...options,headers:{'content-type':'application/json','x-age-confirmed':'true',...(options.headers||{})}});const payload=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(payload.error||'Something went wrong. Please try again.');error.status=response.status;throw error}return payload}

function unlockSite(){sessionStorage.setItem('canna-age-confirmed','true');document.body.classList.remove('age-locked');$('#ageGate').classList.add('is-hidden');$('#siteShell').setAttribute('aria-hidden','false');bootAccount()}
$('#confirmAge').addEventListener('click',unlockSite);$('#rejectAge').addEventListener('click',()=>{$('#ageQuestion').hidden=true;$('#ageDenied').hidden=false});

function showAuth(mode='login'){
  const login=mode==='login';
  $('#authView').hidden=false;$('#dashboardView').hidden=true;$('#accountNav').hidden=true;$('#logoutButton').hidden=true;
  $('#loginTab').classList.toggle('active',login);$('#registerTab').classList.toggle('active',!login);
  $('#loginTab').setAttribute('aria-selected',String(login));$('#registerTab').setAttribute('aria-selected',String(!login));
  $('#loginForm').hidden=!login;$('#registerForm').hidden=login;$('#authError').textContent='';
  $('#authTitle').textContent=login?'Welcome back':'Create your customer space';
  $('#authDescription').textContent=login?'Sign in to open your customer dashboard.':'Your existing orders from this browser will be connected automatically.';
}

function showDashboard(){
  $('#authView').hidden=true;$('#dashboardView').hidden=false;$('#accountNav').hidden=false;$('#logoutButton').hidden=false;
}

$('#loginTab').addEventListener('click',()=>showAuth('login'));
$('#registerTab').addEventListener('click',()=>showAuth('register'));

async function submitAuth(form,path,loadingText){
  const button=form.querySelector('button[type="submit"]');const error=$('#authError');const original=button.textContent;
  button.disabled=true;button.textContent=loadingText;error.textContent='';
  try{const values=Object.fromEntries(new FormData(form));if(path==='/auth/register')values.browserId=getBrowserId();await api(path,{method:'POST',body:JSON.stringify(values)});form.reset();showDashboard();await loadAccount();showToast(path==='/auth/register'?'Your customer space is ready.':'Welcome back.')}catch(requestError){error.textContent=requestError.message}finally{button.disabled=false;button.textContent=original}
}

$('#loginForm').addEventListener('submit',event=>{event.preventDefault();submitAuth(event.currentTarget,'/auth/login','Signing in…')});
$('#registerForm').addEventListener('submit',event=>{event.preventDefault();submitAuth(event.currentTarget,'/auth/register','Creating your space…')});
$('#logoutButton').addEventListener('click',async()=>{try{await api('/auth/logout',{method:'POST',body:'{}'})}finally{showAuth('login');showToast('You have been signed out.')}});

function orderCard(order){const items=order.items.map(item=>`<div class="account-order-item"><img src="${escapeHtml(imageUrl(item.product.image))}" alt="" onerror="this.onerror=null;this.src='/images/cana.jpeg'"><div><h3>${escapeHtml(item.product.name)}</h3><small>${item.quantity} × ${money(item.price)}${item.label?` · ${escapeHtml(item.label)}`:''}</small></div><strong>${money(item.price*item.quantity)}</strong></div>`).join('');return `<details class="order-card"><summary><div class="order-number"><b>${escapeHtml(order.orderNumber)}</b><small>${order.items.length} product${order.items.length===1?'':'s'}</small></div><span class="order-date">${formatDate(order.createdAt)}</span><strong class="order-total">${money(order.total)}</strong><span class="status-pill status-${escapeHtml(order.status)}">${escapeHtml(statusLabel(order.status))}</span><svg class="order-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"></path></svg></summary><div class="order-body"><div class="order-items">${items}</div><div class="order-meta"><span>Payment: ${escapeHtml(order.paymentMethod)}</span><span>${order.proofReceived?'Payment proof received':'Payment proof pending'}</span><span>Ship to: ${escapeHtml(order.shippingCity)}, ${escapeHtml(order.shippingCountry)}</span></div></div></details>`}

function renderDelivery(shipping){if(!shipping){$('#deliveryDetails').innerHTML='<p>Delivery details will appear after your first order.</p>';return}const fields=[['Recipient',shipping.name],['Street',[shipping.street,shipping.apt].filter(Boolean).join(', ')],['City / postal code',[shipping.city,shipping.zip].filter(Boolean).join(' ')],['Country',[shipping.state,shipping.country].filter(Boolean).join(', ')]];$('#deliveryDetails').innerHTML=fields.map(([label,value])=>`<div><small>${label}</small><b>${escapeHtml(value||'Not provided')}</b></div>`).join('')}
function renderProfile(profile){const fields=[['Email',profile.email],['Member since',formatDate(profile.memberSince)],['Last sign-in',formatDate(profile.lastLoginAt)]];$('#profileDetails').innerHTML=fields.map(([label,value])=>`<div><small>${label}</small><b>${escapeHtml(value||'—')}</b></div>`).join('')}
function activityLabel(type){return({account_created:'Account created',login:'Signed in',order_created:'Order created',payment_proof:'Payment proof submitted'})[type]||'Account activity'}
function renderActivities(activities){$('#activityList').innerHTML=activities.map(activity=>`<article class="activity-item"><span class="activity-dot"></span><div><b>${escapeHtml(activityLabel(activity.type))}</b><p>${escapeHtml(activity.detail||'Activity recorded')}</p></div><time>${formatDate(activity.createdAt)}</time></article>`).join('');$('#activityEmpty').hidden=activities.length>0}

async function loadAccount(){const button=$('#refreshAccount');button.disabled=true;$('#accountLoading').hidden=false;$('#accountEmpty').hidden=true;try{const data=await api('/account');const name=data.profile.fullName||'Customer';$('#customerName').textContent=name;$('#accountAvatar').textContent=initials(name);$('#totalOrders').textContent=data.summary.totalOrders;$('#pendingOrders').textContent=data.summary.pendingOrders;$('#completedOrders').textContent=data.summary.completedOrders;$('#totalSpent').textContent=money(data.summary.totalSpent);$('#ordersList').innerHTML=data.orders.map(orderCard).join('');$('#accountEmpty').hidden=data.orders.length>0;renderProfile(data.profile);renderDelivery(data.profile.shipping);renderActivities(data.activities||[])}catch(error){if(error.status===401){showAuth('login');return}$('#ordersList').innerHTML=`<div class="account-empty"><h3>Unable to load your orders</h3><p>${escapeHtml(error.message)}</p></div>`}finally{$('#accountLoading').hidden=true;button.disabled=false}}
async function bootAccount(){try{await api('/auth/me');showDashboard();await loadAccount()}catch(error){showAuth('login')}}

$('#refreshAccount').addEventListener('click',loadAccount);$('#year').textContent=new Date().getFullYear();if(sessionStorage.getItem('canna-age-confirmed')==='true')unlockSite();else requestAnimationFrame(()=>$('#confirmAge').focus());
