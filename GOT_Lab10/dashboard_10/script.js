(() => {
  'use strict';
  const data = window.GOT_DATA;
  const $ = id => document.getElementById(id);
  const bookNames = ['', 'A Game of Thrones', 'A Clash of Kings', 'A Storm of Swords', 'A Feast for Crows', 'A Dance with Dragons'];
  const colors = ['#d2a65c','#74b7cf','#75c0a3','#b48cc4','#e27e78','#8b9dc9','#637389'];
  const state = {book:'',year:'',houses:new Set(),gender:'',nobility:'',status:'',tableSearch:'',houseSearch:'',sort:'Name',dir:1,page:0};
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const svg = inner => `<svg viewBox="0 0 560 205" role="img" aria-label="Chart">${inner}</svg>`;
  const empty = id => { $(id).innerHTML = '<div class="chart-empty">No records in this selection</div>'; };
  if (!Array.isArray(data)) { document.querySelector('main').innerHTML = '<p>Data could not load. Run prepare_data.py.</p>'; return; }
  function passes(r, omit='') {
    return (omit==='book'||!state.book||String(r['Book of Death']??'')===state.book)
      &&(omit==='year'||!state.year||String(r['Death Year']??'')===state.year)
      &&(omit==='houses'||!state.houses.size||state.houses.has(r.House))
      &&(omit==='gender'||!state.gender||r['Gender Label']===state.gender)
      &&(omit==='nobility'||!state.nobility||r['Nobility Label']===state.nobility)
      &&(omit==='status'||!state.status||r['Death Status']===state.status);
  }
  const filtered = omit => data.filter(r => passes(r,omit));
  function setOptions(id, values, label, selected) {
    const select=$(id);
    select.innerHTML=`<option value="">${label}</option>`+values.map(([value,text])=>`<option value="${esc(value)}">${esc(text)}</option>`).join('');
    select.value=selected;
    if (select.value!==selected) { select.add(new Option(selected,selected)); select.value=selected; }
  }
  function updateOptions() {
    setOptions('book',[1,2,3,4,5].filter(v=>filtered('book').some(r=>r['Book of Death']===v)).map(v=>[v,bookNames[v]]),'All books',state.book);
    setOptions('year',[...new Set(filtered('year').map(r=>r['Death Year']).filter(v=>v!=null))].sort((a,b)=>a-b).map(v=>[v,v]),'All years',state.year);
    for(const [id,key,field,label] of [['gender','gender','Gender Label','All genders'],['nobility','nobility','Nobility Label','All statuses'],['status','status','Death Status','All records']]) {
      const values=[...new Set(filtered(key).map(r=>r[field]))].filter(Boolean).sort();
      setOptions(id,values.map(v=>[v,v]),label,state[key]);
    }
    const available=[...new Set(filtered('houses').map(r=>r.House))].sort();
    const houses=[...new Set([...available,...state.houses])].filter(v=>v.toLowerCase().includes(state.houseSearch.toLowerCase()));
    $('houses').innerHTML=houses.map(h=>`<label class="house-option"><input type="checkbox" value="${esc(h)}" ${state.houses.has(h)?'checked':''}><span>${esc(h)}</span></label>`).join('') || '<span class="chart-empty">No houses</span>';
    $('house-count').textContent=state.houses.size?`${state.houses.size} selected`:'All';
    $('houses').querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{input.checked?state.houses.add(input.value):state.houses.delete(input.value);state.page=0;render();}));
  }
  function group(rows,key){const m=new Map();rows.forEach(r=>{const k=key(r);m.set(k,(m.get(k)||0)+1)});return m;}
  function kpis(rows){
    const deaths=rows.filter(r=>r['Death Year']!=null), books=group(rows.filter(r=>r['Book of Death']!=null),r=>r['Book of Death']);
    const top=[...books].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0];
    $('kpi-total').textContent=rows.length.toLocaleString('en-US');$('kpi-known').textContent=deaths.length.toLocaleString('en-US');
    $('kpi-average').textContent=deaths.length?(deaths.reduce((s,r)=>s+r['Death Year'],0)/deaths.length).toFixed(1):'—';
    $('kpi-book').textContent=top?bookNames[top[0]]:'—';$('kpi-book-sub').textContent=top?`${top[1]} death records`:'No known death book';
    $('result-count').textContent=`${rows.length} of ${data.length} characters`;
  }
  function bars(rows){const counts=group(rows.filter(r=>r['Book of Death']!=null),r=>r['Book of Death']);if(!counts.size)return empty('bar-chart');const max=Math.max(...counts.values());let s='';for(let i=0;i<4;i++){const y=163-i*43;s+=`<line class="gridline" x1="38" y1="${y}" x2="545" y2="${y}"/><text class="axis" x="7" y="${y+4}">${Math.round(max*i/3)}</text>`}for(let b=1;b<=5;b++){const n=counts.get(b)||0,x=62+(b-1)*100,h=n/max*130;s+=`<rect class="bar" x="${x}" y="${163-h}" width="52" height="${h}" rx="4"><title>${bookNames[b]}: ${n}</title></rect><text class="axis" x="${x+14}" y="185">${b}</text>`}s+='<text class="axis" x="218" y="202">Book of death (1–5)</text>';$('bar-chart').innerHTML=svg(s)}
  function donut(rows){if(!rows.length)return empty('donut-chart');const entries=[...group(rows,r=>r.House)].sort((a,b)=>b[1]-a[1]);const top=entries.slice(0,6),other=entries.slice(6).reduce((s,x)=>s+x[1],0);if(other)top.push(['Other',other]);let offset=0;const circle=2*Math.PI*68;const arcs=top.map(([name,n],i)=>{const length=n/rows.length*circle;const x=`<circle cx="100" cy="100" r="68" fill="none" stroke="${colors[i]}" stroke-width="28" stroke-dasharray="${length} ${circle-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 100 100)"><title>${esc(name)}: ${n}</title></circle>`;offset+=length;return x}).join('');$('donut-chart').innerHTML=`<div class="donut-layout"><svg viewBox="0 0 200 200" role="img" aria-label="House distribution">${arcs}<text x="100" y="97" text-anchor="middle" fill="#edf2f8" font-size="28">${rows.length}</text><text x="100" y="115" text-anchor="middle" fill="#8e9bae" font-size="10">CHARACTERS</text></svg><div class="legend">${top.map(([name,n],i)=>`<div><b style="background:${colors[i]}"></b>${esc(name)}<span>${n}</span></div>`).join('')}</div></div>`}
  function line(rows){const entries=[...group(rows.filter(r=>r['Death Year']!=null),r=>r['Death Year'])].sort((a,b)=>a[0]-b[0]);if(!entries.length)return empty('line-chart');const max=Math.max(...entries.map(x=>x[1]));const lo=entries[0][0],hi=entries.at(-1)[0];const px=y=>48+(hi===lo?225:(y-lo)/(hi-lo)*460),py=n=>165-n/max*125;let s='';for(let i=0;i<4;i++){const y=165-i*42;s+=`<line class="gridline" x1="45" y1="${y}" x2="530" y2="${y}"/><text class="axis" x="9" y="${y+4}">${Math.round(max*i/3)}</text>`}s+=`<polyline class="plot-line" points="${entries.map(([y,n])=>`${px(y)},${py(n)}`).join(' ')}"/>`;for(const [y,n] of entries){s+=`<circle cx="${px(y)}" cy="${py(n)}" r="5" fill="#d2a65c"><title>Year ${y}: ${n}</title></circle><text class="axis" x="${px(y)-12}" y="188">${y}</text>`}$('line-chart').innerHTML=svg(s)}
  function heat(rows){if(!rows.length)return empty('heatmap');const houses=[...group(rows,r=>r.House)].sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>x[0]);const counts=group(rows.filter(r=>r['Book of Death']!=null),r=>`${r.House}|${r['Book of Death']}`),max=Math.max(1,...counts.values());let html='<div class="heat-grid"><div></div>'+[1,2,3,4,5].map(b=>`<div>BOOK ${b}</div>`).join('');for(const house of houses){html+=`<div title="${esc(house)}">${esc(house)}</div>`;for(let b=1;b<=5;b++){const n=counts.get(`${house}|${b}`)||0;html+=`<div class="cell" style="background:rgba(210,166,92,${n?(.16+.84*n/max):.06})" title="${esc(house)}, ${esc(bookNames[b])}: ${n}">${n||'·'}</div>`}}$('heatmap').innerHTML=html+'</div>'}
  function scatter(rows){const points=rows.filter(r=>r['Book Intro Chapter']!=null);if(!points.length)return empty('scatter-chart');const max=Math.max(1,...points.map(r=>r['Book Intro Chapter']));let s='';for(let i=0;i<=5;i++){const y=170-i*29;s+=`<line class="gridline" x1="43" y1="${y}" x2="538" y2="${y}"/><text class="axis" x="20" y="${y+4}">${i}</text>`}s+='<text class="axis" x="200" y="202">Book intro chapter</text>';for(const r of points){const x=45+r['Book Intro Chapter']/max*490,y=170-r['Books Appeared']*29;s+=`<circle class="point" cx="${x}" cy="${y}" r="3.2"><title>${esc(r.Name)} · chapter ${r['Book Intro Chapter']} · ${r['Books Appeared']} books</title></circle>`}$('scatter-chart').innerHTML=svg(s)}
  function table(rows){let list=rows.filter(r=>`${r.Name} ${r.House}`.toLowerCase().includes(state.tableSearch.toLowerCase()));const key=state.sort;list.sort((a,b)=>{const av=a[key],bv=b[key];if(av==null)return bv==null?0:1;if(bv==null)return -1;return (typeof av==='number'?av-bv:String(av).localeCompare(String(bv)))*state.dir});const pages=Math.max(1,Math.ceil(list.length/7));state.page=Math.min(state.page,pages-1);const part=list.slice(state.page*7,state.page*7+7);$('table-body').innerHTML=part.map(r=>`<tr><td>${esc(r.Name)}</td><td>${esc(r.House)}</td><td>${r['Death Year']??'—'}</td><td>${r['Book of Death']??'—'}</td><td>${r['Books Appeared']}</td></tr>`).join('')||'<tr><td colspan="5">No matching characters</td></tr>';$('table-count').textContent=`${list.length} rows`;$('page-info').textContent=`Page ${state.page+1} of ${pages}`;$('prev').disabled=state.page===0;$('next').disabled=state.page>=pages-1}
  function render(){updateOptions();const rows=filtered();kpis(rows);bars(rows);donut(rows);line(rows);heat(rows);scatter(rows);table(rows)}
  for(const id of ['book','year','gender','nobility','status'])$(id).addEventListener('change',e=>{state[id]=e.target.value;state.page=0;render()});
  $('house-search').addEventListener('input',e=>{state.houseSearch=e.target.value;updateOptions()});
  $('table-search').addEventListener('input',e=>{state.tableSearch=e.target.value;state.page=0;table(filtered())});
  document.querySelectorAll('th[data-sort]').forEach(th=>th.addEventListener('click',()=>{state.dir=state.sort===th.dataset.sort?-state.dir:1;state.sort=th.dataset.sort;table(filtered())}));
  $('prev').addEventListener('click',()=>{state.page--;table(filtered())});$('next').addEventListener('click',()=>{state.page++;table(filtered())});
  $('reset').addEventListener('click',()=>{Object.assign(state,{book:'',year:'',houses:new Set(),gender:'',nobility:'',status:'',tableSearch:'',houseSearch:'',sort:'Name',dir:1,page:0});$('house-search').value='';$('table-search').value='';render()});
  render();
})();
