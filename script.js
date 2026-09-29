// Smart Shop logic
const $ = id => document.getElementById(id);
const SOON_DAYS = 7;
let products = load('ss_products', null);
let sales = load('ss_sales', []);
let editId = null;

function load(k, d){ try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch(e){ return d; } }
function save(){ try { localStorage.setItem('ss_products', JSON.stringify(products)); localStorage.setItem('ss_sales', JSON.stringify(sales)); } catch(e){} }
const dayOffset = n => { const d = new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };
if(!products){
  products = [
    {id:1,name:"Basmati Rice 5kg",cat:"Grocery",price:520,qty:24,min:8,exp:dayOffset(200)},
    {id:2,name:"Amul Milk 1L",cat:"Dairy",price:66,qty:4,min:10,exp:dayOffset(3)},
    {id:3,name:"Bread",cat:"Bakery",price:40,qty:12,min:6,exp:dayOffset(-1)},
    {id:4,name:"Toothpaste",cat:"Personal care",price:95,qty:0,min:5,exp:dayOffset(400)},
    {id:5,name:"Biscuits Pack",cat:"Snacks",price:30,qty:40,min:10,exp:dayOffset(60)}
  ]; save();
}

const daysLeft = p => p.exp ? Math.ceil((new Date(p.exp) - new Date(new Date().toDateString()))/864e5) : null;
function status(p){
  const s = [], d = daysLeft(p);
  if(p.qty === 0) s.push(['out','Out of stock']); else if(p.qty <= p.min) s.push(['low','Low stock']);
  if(d !== null){ if(d < 0) s.push(['exp','Expired']); else if(d <= SOON_DAYS) s.push(['soon','Expires in '+d+'d']); }
  return s;
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => '₹' + Number(n).toLocaleString('en-IN');
function toast(m){ const t=$('toast'); t.textContent=m; t.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>t.classList.remove('show'),2600); }

/* tabs */
document.querySelectorAll('aside button').forEach(b => b.onclick = () => {
  document.querySelectorAll('aside button').forEach(x => x.classList.toggle('on', x===b));
  document.querySelectorAll('section').forEach(s => s.classList.toggle('on', s.id===b.dataset.tab));
});

/* add / edit product */
$('pForm').onsubmit = e => {
  e.preventDefault();
  const item = {name:$('pName').value.trim(), cat:$('pCat').value.trim(), price:+$('pPrice').value, qty:+$('pQty').value, min:+$('pMin').value, exp:$('pExp').value};
  if(editId){ Object.assign(products.find(p=>p.id===editId), item); toast('Product updated'); }
  else { products.push({id:Date.now(), ...item}); toast('Product added'); }
  resetForm(); save(); render();
};
function resetForm(){ editId=null; $('pForm').reset(); $('pMin').value=5; $('formTitle').textContent='Add product'; $('pSave').textContent='Add product'; $('pCancel').hidden=true; }
$('pCancel').onclick = resetForm;

function editProduct(id){
  const p = products.find(x=>x.id===id); editId = id;
  $('pName').value=p.name; $('pCat').value=p.cat; $('pPrice').value=p.price; $('pQty').value=p.qty; $('pMin').value=p.min; $('pExp').value=p.exp||'';
  $('formTitle').textContent='Edit product'; $('pSave').textContent='Save changes'; $('pCancel').hidden=false;
  window.scrollTo({top:0,behavior:'smooth'}); $('pName').focus();
}
function delProduct(id){
  const p = products.find(x=>x.id===id);
  if(confirm('Delete "'+p.name+'"?')){ products = products.filter(x=>x.id!==id); save(); render(); toast('Product deleted'); }
}
function restock(id){
  const n = parseInt(prompt('How many units to add?'), 10);
  if(n > 0){ products.find(x=>x.id===id).qty += n; save(); render(); toast('Stock updated'); }
}

/* sales */
$('sForm').onsubmit = e => {
  e.preventDefault();
  const p = products.find(x=>x.id === +$('sProd').value), q = +$('sQty').value;
  if(!p) return;
  if(daysLeft(p) !== null && daysLeft(p) < 0){ toast('Cannot sell — this product is expired'); return; }
  if(q > p.qty){ toast('Only '+p.qty+' in stock'); return; }
  p.qty -= q;
  sales.unshift({id:Date.now(), name:p.name, qty:q, total:q*p.price, date:new Date().toISOString()});
  save(); render(); $('sQty').value = 1;
  toast('Sale recorded: ' + money(q*p.price) + (p.qty <= p.min ? ' — '+p.name+' is now low on stock' : ''));
};

/* render */
function filtered(){
  const q = $('q').value.toLowerCase(), f = $('fStatus').value, c = $('fCat').value;
  return products.filter(p => {
    if(q && !(p.name+' '+p.cat).toLowerCase().includes(q)) return false;
    if(c && p.cat !== c) return false;
    const k = status(p).map(s=>s[0]);
    if(f==='low') return k.includes('low') || k.includes('out');
    if(f!=='all') return k.includes(f);
    return true;
  });
}
function alertsList(){
  const a = [];
  products.forEach(p => status(p).forEach(([k,t]) => {
    const msg = {out:p.name+' is out of stock', low:p.name+' is running low ('+p.qty+' left, alert at '+p.min+')',
      exp:p.name+' expired on '+p.exp+' — remove it from the shelf', soon:p.name+' expires in '+daysLeft(p)+' day(s) ('+p.exp+')'}[k];
    a.push({k,msg});
  }));
  return a.sort((x,y)=> ['out','exp','low','soon'].indexOf(x.k) - ['out','exp','low','soon'].indexOf(y.k));
}
const alertHTML = a => a.length ? a.map(x=>'<div class="alert '+x.k+'">'+esc(x.msg)+'</div>').join('') : '<p class="empty">All clear — no stock or expiry problems.</p>';
function salesTable(list){
  if(!list.length) return '<p class="empty">No sales yet. Record one from the Sales tab.</p>';
  return '<table><thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Total</th></tr></thead><tbody>' +
    list.map(s=>'<tr><td>'+new Date(s.date).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})+'</td><td>'+esc(s.name)+'</td><td>'+s.qty+'</td><td>'+money(s.total)+'</td></tr>').join('') + '</tbody></table>';
}
const stat = (icon, value, label, cls) =>
  '<div class="stat ' + cls + '"><i class="ico">' + icon + '</i><div><b>' + value + '</b><span>' + label + '</span></div></div>';

$('today').textContent = new Date().toLocaleDateString('en-IN', {weekday:'long', day:'numeric', month:'long', year:'numeric'}) + ' — here is how your shop is doing.';

function render(){
  const al = alertsList();
  const cats = [...new Set(products.map(p=>p.cat))].sort();
  const cur = $('fCat').value;
  $('fCat').innerHTML = '<option value="">All categories</option>' + cats.map(c=>'<option'+(c===cur?' selected':'')+'>'+esc(c)+'</option>').join('');
  $('cats').innerHTML = cats.map(c=>'<option value="'+esc(c)+'">').join('');
  $('sProd').innerHTML = products.map(p=>'<option value="'+p.id+'"'+(p.qty===0?' disabled':'')+'>'+esc(p.name)+' — '+p.qty+' in stock</option>').join('');

  const today = new Date().toDateString();
  const todayRev = sales.filter(s=>new Date(s.date).toDateString()===today).reduce((a,s)=>a+s.total,0);
  const stockValue = products.reduce((a,p)=>a+p.qty*p.price,0);
  const cnt = k => al.filter(x=>x.k===k).length;
  $('stats').innerHTML =
    stat('📦', products.length, 'Products', '') +
    stat('💎', money(stockValue), 'Stock value', '') +
    stat('💰', money(todayRev), 'Sales today', '') +
    stat('📉', cnt('low') + cnt('out'), 'Low / out of stock', 'w') +
    stat('⏳', cnt('soon'), 'Expiring soon', 'w') +
    stat('⛔', cnt('exp'), 'Expired', 'b');
  $('dashAlerts').innerHTML = alertHTML(al.slice(0,5));
  $('dashSales').innerHTML = salesTable(sales.slice(0,5));
  $('alertList').innerHTML = alertHTML(al);
  $('badge').textContent = al.length; $('badge').hidden = !al.length;

  const rows = filtered();
  $('invBody').innerHTML = rows.length ? rows.map(p=>{
    const st = status(p);
    const tags = st.length ? st.map(([k,t])=>'<span class="tag '+(k==='soon'||k==='low'?'t-low':'t-bad')+'">'+t+'</span>').join('') : '<span class="tag t-ok">OK</span>';
    return '<tr><td>'+esc(p.name)+'</td><td>'+esc(p.cat)+'</td><td>'+money(p.price)+'</td><td>'+p.qty+'</td><td>'+(p.exp||'—')+'</td><td>'+tags+'</td>'+
      '<td><button class="btn s" onclick="restock('+p.id+')">+ Stock</button> <button class="btn s g" onclick="editProduct('+p.id+')">Edit</button> <button class="btn s d" onclick="delProduct('+p.id+')">Delete</button></td></tr>';
  }).join('') : '<tr><td colspan="7" class="empty">No products match. Change the search or filter, or add a product above.</td></tr>';

  $('salesList').innerHTML = salesTable(sales);
  $('sTotal').textContent = sales.reduce((a,s)=>a+s.total,0).toLocaleString('en-IN');
}
['q','fStatus','fCat'].forEach(id => $(id).addEventListener('input', render));
render();

/* startup alert */
const startAlerts = alertsList().length;
if(startAlerts) setTimeout(()=>toast('⚠ '+startAlerts+' alert(s) need your attention'), 500);