const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const toastNode = document.querySelector('#toast');
let data, selected, page = 'operations', filter = 'All', query = '', zoom = 1, busy = false;
let token = sessionStorage.getItem('afterlight-token') || '';
let toastTimer;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug = value => String(value).toLowerCase().replace(/\s+/g,'-');
const fields = i => ({...i.extraction,...(i.review || {}),locationId:i.review ? i.review.locationId : i.report.locationId});
const location = id => data.locations.find(l=>l.id===id)?.name || 'Location unknown';
const time = value => new Date(value).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'});
const date = value => `${new Date(value).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'})}, ${time(value)} UTC`;
const number = i => `HL-${String(i.number).padStart(3,'0')}`;
const current = () => data.incidents.find(i=>i.id===selected);
const pendingPairs = () => data.duplicates.filter(d=>!d.decision);
const icons = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
  report:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  layers:'<path d="m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
  activity:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  pin:'<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  refresh:'<path d="M20 8a8 8 0 1 0 0 9M20 3v5h-5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
};
const icon = (name,cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;
const pill = (text,type='') => `<span class="pill ${type || slug(text)}">${esc(text)}</span>`;
const button = (action,label,kind='secondary',extra='') => `<button class="btn ${kind}" data-action="${action}" ${extra}>${label}</button>`;
function toast(text) { clearTimeout(toastTimer); toastNode.textContent=text;toastNode.classList.add('show');toastTimer=setTimeout(()=>toastNode.classList.remove('show'),5000); }
let browserExercise;
async function api(path,body) {
  if (browserExercise) return browserExercise(path,body);
  const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await response.json();
  if (!response.ok) { const error=new Error(result.error || 'Request failed.');error.status=response.status;throw error; }
  if (path === '/api/state' && result.storageMode === 'browser') {
    ({judgeRequest:browserExercise} = await import('/exercise/judge-store.mjs'));
    return browserExercise(path,body);
  }
  return result;
}
async function refresh() { data=await api('/api/state');if (!data.incidents.some(i=>i.id===selected)) selected=data.incidents.find(i=>i.status==='Needs review')?.id || data.incidents[0]?.id;render(); }
function navItem(id,label,iconName,badge='') { return `<button data-action="page" data-page="${id}" aria-label="${label}${badge ? ` (${badge})` : ''}" class="nav-item ${page===id?'active':''}" ${page===id?'aria-current="page"':''}>${icon(iconName)}<span>${label}</span>${badge ? `<span class="nav-count">${badge}</span>`:''}</button>`; }
function shell(content) {
  return `<aside class="sidebar">
    <a class="brand" href="/" aria-label="Afterlight home"><img src="/favicon.svg" alt="" width="35" height="35"><span>afterlight<span class="brand-dot">.</span></span></a>
    <div class="workspace-label">EXERCISE WORKSPACE</div>
    <nav aria-label="Main navigation">${navItem('operations','Overview','grid')}${navItem('map','Incident map','map')}${navItem('duplicates','Duplicate review','layers',pendingPairs().length)}${navItem('reports','Situation reports','report')}${navItem('activity','Activity log','activity')}<span class="mobile-settings">${navItem('settings','Exercise settings','settings')}</span></nav>
    <div class="sidebar-bottom"><div class="exercise-note"><span class="little-star">✦</span><strong>Built for clarity.</strong><p>AI organizes the information.<br>You make the decisions.</p></div>${navItem('settings','Exercise settings','settings')}<div class="reviewer-avatar"><span>DR</span><div><strong>Demo reviewer</strong><small>Harborlight exercise</small></div><span class="online-dot"></span></div></div>
  </aside>
  <div class="main-shell"><header class="topbar"><div class="breadcrumb"><span class="crumb-icon">${icon('layers')}</span><span>Workspace</span><span class="crumb-slash">/</span><strong>Harborlight</strong></div><div class="topbar-right">${pill(data.storageMode==='browser'?'Saved in this browser · Simulation':'Simulation','simulation')}<span class="topbar-date">${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}</span></div></header>
  <main id="main" tabindex="-1">${content}</main><footer class="app-footer"><span><span class="online-dot"></span> Fictional data · Human review required</span><span>Afterlight / Preparedness, with perspective.</span></footer></div>`;
}
function heading(kicker,title,subtitle,actions='') { return `<section class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${actions}</div></section>`; }
function metrics() {
  const total=data.incidents.length, review=data.incidents.filter(i=>['New','Needs review'].includes(i.status)).length, high=data.incidents.filter(i=>i.status!=='Resolved'&&['High','Critical'].includes(i.reviewerPriority||i.priority.band)).length, reviewed=data.incidents.filter(i=>i.reviewerPriority).length;
  return `<section class="metrics" aria-label="Scenario metrics">${[
    ['Total reports',total,'Across the fictional scenario','layers','', 'all'],
    ['Awaiting review',review,'Your next place to focus','clock','amber','review'],
    ['Elevated priority',high,'Suggested or reviewer-assigned','activity','rust','high'],
    ['Human decisions',reviewed,'Reports with a reviewed priority','check','green','reviewed'],
  ].map(([label,value,note,ico,cls,key])=>`<button class="metric ${cls}" data-action="metric" data-filter="${key}"><span class="metric-label">${label}${icon(ico)}</span><strong>${value.toString().padStart(2,'0')}</strong><small>${note}</small></button>`).join('')}</section>`;
}
function visibleIncidents() {
  return data.incidents.filter(i=>{
    const f=fields(i);const matches=filter==='All'||filter===i.status||(filter==='Awaiting review'&&['New','Needs review'].includes(i.status))||(filter==='Elevated'&&i.status!=='Resolved'&&['High','Critical'].includes(i.reviewerPriority||i.priority.band))||(filter==='Human decisions'&&i.reviewerPriority);
    return matches && `${f.title} ${f.summary} ${location(f.locationId)} ${number(i)}`.toLowerCase().includes(query.toLowerCase());
  }).sort((a,b)=>b.number-a.number);
}
function queueItems() {
  const incidents=visibleIncidents();
  if(!incidents.length)return `<div class="empty compact">${icon('search')}<strong>No matching reports</strong><p>Try a different search or filter.</p></div>`;
  return incidents.map(i=>{const f=fields(i);return `<button class="incident-card ${selected===i.id?'selected':''}" data-action="select" data-id="${i.id}" aria-pressed="${selected===i.id}"><div class="incident-meta"><span>${number(i)}</span><span>${time(i.createdAt)} UTC</span></div><h3>${esc(f.title)}</h3><p>${icon('pin')}${esc(location(f.locationId))}</p><div class="incident-tags">${pill(i.reviewerPriority || i.priority.band)}<span class="status-dot ${slug(i.status)}">${esc(i.status)}</span></div></button>`;}).join('');
}
function queue() { return `<section class="queue panel" aria-labelledby="queue-title"><div class="panel-header"><h2 id="queue-title">Incident queue <span class="subcount">${data.incidents.length}</span></h2></div><label class="search-field">${icon('search')}<input id="queue-search" type="search" placeholder="Search reports…" value="${esc(query)}" aria-label="Search reports"></label><div class="queue-tabs" aria-label="Report filter">${['All','Awaiting review','Monitoring'].map(f=>`<button class="${filter===f?'active':''}" data-action="filter" data-filter="${f}">${f==='Awaiting review'?'To review':f}</button>`).join('')}</div>${!['All','Awaiting review','Monitoring'].includes(filter)?`<div class="filter-note">${esc(filter)} ${button('filter','Clear','text','data-filter="All"')}</div>`:''}<div class="queue-list" id="queue-list">${queueItems()}</div></section>`; }
let leafletMap, mapView, markerLayer, mapResizeObserver;
function map() {
  const shown=visibleIncidents();
  return `<section class="map-panel panel ${page==='map'?'expanded-map':''}" aria-labelledby="map-title"><div class="panel-header"><div><h2 id="map-title">The shared picture</h2><p>${esc(data.mapConfig.region)} · Real basemap</p></div><span id="mapped-count">${pill(`${shown.filter(i=>fields(i).locationId).length} mapped`,'neutral')}</span></div>
    <div class="map-canvas real-map-canvas"><div id="real-map" aria-label="Interactive OpenStreetMap basemap with simulated incident markers"></div><div class="map-label"><span class="online-dot"></span> SIMULATED REPORTS</div><div class="map-legend"><span><i class="legend-dot critical"></i>Critical</span><span><i class="legend-dot high"></i>High</span><span><i class="legend-dot moderate"></i>Moderate</span><span><i class="legend-dot low"></i>Low</span></div><div class="map-tile-error" role="status" hidden>Map tiles are unavailable. The report queue still works.</div></div><div class="map-footer">${icon('info')}Real geography · Fictional exercise points and reports. No live incident data.</div></section>`;
}
function updateMapMarkers() {
  if(!leafletMap||!markerLayer)return;
  markerLayer.clearLayers();
  const grouped=new Map();
  for(const i of visibleIncidents()){const id=fields(i).locationId;if(id){if(!grouped.has(id))grouped.set(id,[]);grouped.get(id).push(i);}}
  for(const [id,incidents] of grouped){
    const l=data.locations.find(l=>l.id===id);if(!l||!Number.isFinite(l.lat)||!Number.isFinite(l.lng))continue;
    const target=incidents.find(i=>i.id===selected)||incidents[0];const isSelected=incidents.some(i=>i.id===selected);
    const marker=L.marker([l.lat,l.lng],{keyboard:true,title:`${l.name} · ${incidents.length} simulated reports`,icon:L.divIcon({className:`leaflet-report-icon ${slug(target.reviewerPriority||target.priority.band)} ${isSelected?'selected':''}`,html:`<span class="leaflet-report-dot">${incidents.length}</span>`,iconSize:[34,34],iconAnchor:[17,17]})});
    marker.bindTooltip(`${esc(l.name)}<br>${incidents.length} simulated report${incidents.length===1?'':'s'} · Click to review`,{direction:'top',offset:[0,-17]});
    marker.on('click',()=>{const index=incidents.findIndex(i=>i.id===selected);selected=incidents[(index+1)%incidents.length].id;render();const focus=document.querySelector('.leaflet-report-icon.selected');focus?.focus();});
    marker.addTo(markerLayer);
    marker.getElement()?.setAttribute('aria-label',`${l.name}, ${incidents.length} simulated reports. ${number(target)}`);
    marker.getElement()?.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();marker.fire('click');}});
  }
  const count=document.querySelector('#mapped-count');if(count)count.innerHTML=pill(`${visibleIncidents().filter(i=>fields(i).locationId).length} mapped`,'neutral');
}
function mountMap() {
  const target=document.querySelector('#real-map');if(!target)return;
  if(!window.L){target.innerHTML='<div class="empty"><p>Map library could not load. The report queue is still available.</p></div>';return;}
  leafletMap=L.map(target,{zoomControl:true,attributionControl:true,scrollWheelZoom:false}).setView(mapView?.center||data.mapConfig.center,mapView?.zoom||data.mapConfig.zoom);
  const tiles=L.tileLayer(data.mapConfig.tileUrl,{maxZoom:19,attribution:data.mapConfig.attribution,updateWhenIdle:true,keepBuffer:1}).addTo(leafletMap);
  tiles.on('tileerror',()=>{const note=document.querySelector('.map-tile-error');if(note)note.hidden=false;});
  tiles.on('tileload',()=>{const note=document.querySelector('.map-tile-error');if(note)note.hidden=true;});
  markerLayer=L.layerGroup().addTo(leafletMap);updateMapMarkers();
  mapResizeObserver=new ResizeObserver(()=>leafletMap?.invalidateSize({pan:false}));mapResizeObserver.observe(target);
  requestAnimationFrame(()=>leafletMap?.invalidateSize());
}
function reviewedFieldsSection(i) {
  const hasAP = i.review && 'affectedPeople' in i.review;
  const hasN = i.review && 'needs' in i.review;
  const ap = hasAP ? i.review.affectedPeople : i.extraction.affectedPeople;
  const ns = hasN ? i.review.needs : i.extraction.needs;
  const badge = (hasAP || hasN) ? ' ' + pill('Reviewed', 'green') : '<span class="form-field-hint"> · extracted</span>';
  const apText = (ap === null || ap === undefined) ? 'Unknown' + (hasAP ? ' (reviewed)' : ' (extracted)') : (ap + (hasAP ? ' (reviewed)' : ' (source claim)'));
  const needsHtml = (ns && ns.length) ? '<ul class="unknown-list">' + ns.map(n => '<li><span>\u2713</span>' + esc(n) + '</li>').join('') + '</ul>' : '<p class="small-copy">No needs recorded.</p>';
  return '<div class="detail-section"><h4>Affected people &amp; reported needs' + badge + '</h4><p class="small-copy">Affected people: ' + esc(apText) + '</p><p class="small-copy">Reported needs (' + (hasN ? 'reviewed' : 'extracted') + ')</p>' + needsHtml + '</div>';
}
function detail() {
  const i=current();if(!i)return `<section class="detail-panel panel"><div class="empty"><h2>Select a report</h2><p>Choose a card or map marker to review it.</p></div></section>`;
  const f=fields(i);const pairs=pendingPairs().filter(p=>p.a===i.id||p.b===i.id);
  return `<section class="detail-panel panel" aria-labelledby="detail-title"><div class="panel-header"><h2 id="detail-title">Report detail</h2><span class="mono">${number(i)}</span></div><div class="detail-body"><div class="detail-tags">${pill(i.reviewerPriority||i.priority.band)}${pill(i.status,'neutral')}</div><h3>${esc(f.title)}</h3><div class="detail-location">${icon('pin')}${esc(location(f.locationId))}</div><p class="detail-summary">${esc(f.summary)}</p><div class="source-line">${icon('clock')}Submitted ${time(i.createdAt)} UTC · ${esc(i.report.source)}</div>
    <div class="assist-box"><div class="assist-heading">${icon('spark')}<strong>${i.ai.mode==='model'?'AI extraction':'Demo extraction'}</strong><span>${Math.round(i.extraction.confidence*100)}%</span></div><div class="confidence-track"><div style="width:${i.extraction.confidence*100}%"></div></div><p>Extraction confidence describes field parsing. It does not verify this report.</p><small>${esc(i.ai.label)}</small></div>
    ${i.ai.error?`<div class="inline-warning">${esc(i.ai.error)}</div>`:''}
    <div class="detail-section"><h4>What’s still unknown <span>${f.missingFields.length}</span></h4><ul class="unknown-list">${f.missingFields.map(s=>`<li><span>?</span>${esc(s)}</li>`).join('')}</ul></div>
    <div class="detail-section"><h4>Priority suggestion ${pill(i.priority.band)}</h4><p class="small-copy">${i.priority.factors.map(esc).join(' · ')}</p><p class="rubric">${esc(i.priority.rubric)}</p></div>
    ${pairs.length?`<button class="duplicate-notice" data-action="compare" data-id="${esc(pairs[0].id)}">${icon('layers')}<span>Possible related report<strong>Compare before deciding</strong></span>${icon('chevron')}</button>`:''}
    ${i.review?`<div class="review-note">${icon('check')}<div><strong>Reviewed by ${esc(i.review.actor)}</strong><p>${esc(i.review.note || 'A human priority and status decision has been recorded.')}</p></div></div>`:''}
    <details class="source-details"><summary>Original report & uncertainty</summary><blockquote>${esc(i.report.text)}</blockquote>${i.report.image?`<img src="${esc(i.report.image)}" alt="Synthetic report attachment" class="attachment">`:''}<ul>${i.extraction.uncertainty.map(s=>`<li>${esc(s)}</li>`).join('')}</ul><p>Affected people (extracted): ${i.extraction.affectedPeople===null?'Unknown':`${i.extraction.affectedPeople} (source claim)`}</p><ul>${i.extraction.evidenceNotes.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></details>
    ${reviewedFieldsSection(i)}</div><div class="detail-actions">${button('review',`${icon('check')}${i.review?'Edit review':'Review report'}`,'primary')}${button('retry',icon('refresh'),'secondary','aria-label="Retry extraction" title="Retry extraction"')}</div></section>`;
}
function operations() { return `${heading('HARBORLIGHT / EXERCISE 01','A clearer picture.','Turn scattered reports into a shared understanding.',button('new-report',`${icon('plus')}New report`,'primary')+button('generate',`${icon('report')}Generate summary`))}${metrics()}<div class="section-kicker"><h2>Live exercise workspace</h2><span><span class="online-dot"></span> ${data.incidents.length} reports · ${pendingPairs().length} possible duplicate pairs</span></div><div class="workspace-grid">${queue()}${map()}${detail()}</div><div class="quiet-note">${icon('info')}This is a preparedness prototype with fictional data. Every suggestion stays open to human review.</div>`; }
function mapPage() { return `${heading('SPATIAL VIEW','Every report, in context.','Explore the real basemap and inspect simulated reports. Unknown locations stay in the queue.',button('new-report',`${icon('plus')}New report`,'primary'))}<div class="workspace-grid map-layout">${queue()}${map()}${detail()}</div>`; }
function duplicatesPage() {
  return `${heading('HUMAN REVIEW','Connected, or coincidental?','Compare overlapping reports. Similarity suggests a conversation, not a conclusion.')}<div class="summary-strip"><strong>${pendingPairs().length} pairs awaiting review</strong><span>Decisions never automatically merge or hide reports.</span></div><div class="duplicates-list">${data.duplicates.length?data.duplicates.map(p=>{const a=data.incidents.find(i=>i.id===p.a),b=data.incidents.find(i=>i.id===p.b);return `<article class="duplicate-card panel"><div class="duplicate-card-top">${pill(p.decision?`Marked ${p.decision}`:'Awaiting review',p.decision?'green':'amber')}<span>${Math.round(p.score*100)}% similarity</span></div><div class="pair-preview"><div><span class="mono">${number(a)}</span><h2>${esc(fields(a).title)}</h2><p>${esc(a.report.text)}</p></div><span class="pair-link">${icon('layers')}</span><div><span class="mono">${number(b)}</span><h2>${esc(fields(b).title)}</h2><p>${esc(b.report.text)}</p></div></div><div class="duplicate-card-bottom"><p>${esc(p.reason)}</p>${button('compare',`Compare reports ${icon('arrow')}`,'secondary',`data-id="${esc(p.id)}"`)}</div></article>`;}).join(''):`<div class="empty panel">${icon('check')}<h2>No possible duplicates</h2><p>Similar reports at the same fictional location will appear here.</p></div>`}</div>`;
}
function reportsPage() {
  const draft=data.situationReports.at(-1);
  return `${heading('THE BIG PICTURE','Understanding, on one page.','A time-stamped draft of reported needs, review progress, and remaining gaps.',button('generate',`${icon('spark')}Generate new draft`,'primary'))}${draft?`<article class="sitrep panel"><div class="sitrep-top"><div>${pill('Draft · Human review required','amber')}<h2>Harborlight situation report</h2><p>Generated ${date(draft.generatedAt)} · ${esc(draft.ai.label)}</p></div>${button('export',`${icon('download')}Export Markdown`)}</div><div class="sitrep-summary"><span class="eyebrow">SITUATION OVERVIEW</span><p>${esc(draft.text)}</p></div><div class="sitrep-columns"><div><h3>Review coverage</h3><div class="status-breakdown">${Object.entries(draft.byStatus).map(([status,count])=>`<div><span><i class="status-color ${slug(status)}"></i>${status}</span><strong>${count}</strong></div>`).join('')}</div></div><div><h3>Reported needs</h3><ul class="needs-list">${draft.needs.length?draft.needs.map(n=>`<li>${icon('chevron')}${esc(n)}</li>`).join(''):'<li>No needs recorded.</li>'}</ul><h3 class="gaps-heading">Information gaps</h3><p>${draft.unreviewed} without a human priority decision<br>${draft.noLocation} with an unknown location<br>${draft.duplicateCount} possible duplicate pairs</p></div></div><div class="coverage-note">${icon('info')}<p>${esc(draft.coverage)}</p></div></article><div class="report-history"><h2>Draft history</h2>${data.situationReports.slice().reverse().map((r,index)=>`<button data-action="show-draft" data-id="${r.id}">${icon('report')}<strong>Harborlight draft ${data.situationReports.length-index}</strong><span>${date(r.generatedAt)}</span><span>${r.count} reports</span>${icon('chevron')}</button>`).join('')}</div>`:`<div class="empty panel report-empty"><div class="empty-illustration">${icon('report')}</div><h2>Make space for the big picture.</h2><p>Generate a situation draft from the current exercise.<br>Reported needs and information gaps stay visible.</p>${button('generate',`${icon('spark')}Generate first draft`,'primary')}</div>`}`;
}
function activityPage() {
  return `${heading('TRACEABLE DECISIONS','A record of what changed.','Report intake, suggestions, and human decisions, in one chronological trail.')}<section class="activity-panel panel"><div class="panel-header"><h2>Exercise activity</h2><span>${data.audit.length} entries</span></div>${data.audit.slice().reverse().map(a=>`<article class="audit-item"><div class="audit-icon">${icon(a.action.includes('review')?'check':a.action.includes('Report')?'plus':a.action.includes('draft')?'report':'activity')}</div><div class="audit-content"><div><h3>${esc(a.action)}</h3><time datetime="${a.at}">${date(a.at)}</time></div><p>${esc(a.details)}</p><small>${esc(a.actor)}${a.incidentId?` · ${number(data.incidents.find(i=>i.id===a.incidentId)||{number:0})}`:''}</small>${a.before?`<details><summary>View recorded changes</summary><div class="audit-changes"><div><strong>Before</strong><pre>${esc(JSON.stringify(a.before,null,2))}</pre></div><div><strong>After</strong><pre>${esc(JSON.stringify(a.after,null,2))}</pre></div></div></details>`:''}</div></article>`).join('')}</section>`;
}
function settingsPage() {
  return `${heading('EXERCISE SETTINGS','A safe space to explore.','Keep this workspace repeatable and its limitations clear.')}<section class="settings-grid"><article class="panel settings-card"><span class="eyebrow">SCENARIO</span><h2>Harborlight</h2><p>A fictional flood preparedness exercise with synthetic places, participants, and reports.</p><div class="settings-row"><span>Mode</span>${pill('Simulation','simulation')}</div><div class="settings-row"><span>Seed reports</span><strong>10</strong></div><div class="settings-row"><span>Location system</span><strong>Real map / simulated points</strong></div>${button('reset',`${icon('refresh')}Reset exercise`,'secondary')}</article><article class="panel settings-card"><span class="eyebrow">ASSISTANCE</span><h2>Transparent by design.</h2><div class="settings-row"><span>AI connection</span>${pill(data.aiConfigured?'Connected':'Demo mode',data.aiConfigured?'green':'amber')}</div><p>${data.aiConfigured?'A connected model can extract report fields and summarize exercise records. Outputs may still be incomplete or inaccurate.':'Text extraction uses a rule-based demo parser. Images can be attached but their pixels are not analyzed in demo mode. The project owner can enable an AI connection.'}</p><ul class="settings-list"><li>AI suggestions are editable.</li><li>Unknown values remain visible.</li><li>Similarity scores are not probabilities.</li><li>Priority bands organize the review queue.</li></ul>${token?button('logout','Forget access token','text'):''}</article></section><div class="coverage-note settings-coverage">${icon('info')}<p>This prototype is for exercises. It does not verify incidents, dispatch services, or provide real-world response advice. The activity log is a demo record, not a tamper-proof compliance system.</p></div>`;
}
function render() { mapResizeObserver?.disconnect(); if(leafletMap){const center=leafletMap.getCenter();mapView={center:[center.lat,center.lng],zoom:leafletMap.getZoom()};leafletMap.remove();leafletMap=null;markerLayer=null;} app.innerHTML=shell(({operations,map:mapPage,duplicates:duplicatesPage,reports:reportsPage,activity:activityPage,settings:settingsPage}[page])()); mountMap(); }
function openModal(content,wide=false) { modal.innerHTML=content;modal.classList.toggle('wide',wide);modal.showModal();modal.querySelector('input,textarea,select,button')?.focus(); }
function modalHeading(kicker,title,subtitle='') { return `<div class="modal-heading"><div><span class="eyebrow">${kicker}</span><h2 id="modal-title">${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div><button class="icon-button" data-action="close" aria-label="Close dialog">${icon('close')}</button></div>`; }
function options(values,value) { return values.map(v=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(v)}</option>`).join(''); }
function locationOptions(id) { return `<option value="">Unknown / not supplied</option>${data.locations.map(l=>`<option value="${l.id}" ${l.id===id?'selected':''}>${esc(l.name)}</option>`).join('')}`; }
function reportModal() {
  openModal(`${modalHeading('FICTIONAL REPORT INTAKE','Start with what was reported.','Use synthetic exercise details. Missing information is welcome.')}<form id="report-form"><label>Report text <span class="required">Required</span><textarea name="text" rows="5" required minlength="15" maxlength="5000" placeholder="SIMULATION: Water is reported near the fictional Northgate community hall…"></textarea></label><button type="button" class="sample-button" data-action="sample">${icon('spark')}Use the prepared demo report</button><div class="form-columns"><label>Fictional location<select name="locationId">${locationOptions('')}</select></label><label>Source label<input name="source" value="Exercise participant" required maxlength="80"></label></div><details class="upload-details"><summary>Add a synthetic image (optional)</summary><label>PNG or JPEG · maximum 1 MB<input name="image" type="file" accept="image/png,image/jpeg"></label><label>Image context<input name="imageContext" maxlength="600" placeholder="Describe the synthetic image and what is uncertain"></label><p>Demo extraction uses report text. A connected vision model can analyze the attachment.</p></details><div class="form-note">${icon('info')}The report will be saved as “Needs review.” Suggestions will be clearly labeled.</div><div class="form-error" role="alert"></div><div class="modal-actions">${button('close','Cancel')}<button type="submit" class="btn primary">${icon('plus')}Submit report</button></div></form>`);
}
function reviewModal() { const i=current(),f=fields(i);if(!i)return;
  const reviewedAP = f.affectedPeople;
  const apValue = reviewedAP !== null && reviewedAP !== undefined ? String(reviewedAP) : '';
  const reviewedNeeds = i.review && 'needs' in i.review ? i.review.needs : f.needs;
  const needsValue = Array.isArray(reviewedNeeds) ? reviewedNeeds.join('\n') : '';
  openModal(`${modalHeading(`HUMAN REVIEW / ${number(i)}`,'Your judgment stays in control.','Edit the record and save a traceable decision. The original report is retained.')}<form id="review-form" data-id="${i.id}"><label>Title<input name="title" value="${esc(f.title)}" required minlength="3" maxlength="120"></label><label>Reviewed summary<textarea name="summary" rows="4" required minlength="3" maxlength="1200">${esc(f.summary)}</textarea></label><div class="form-columns"><label>Category<select name="category">${options(data.categories,f.category)}</select></label><label>Fictional location<select name="locationId">${locationOptions(f.locationId)}</select></label></div><div class="form-columns"><label>Status<select name="status">${options(data.statuses,i.status==='Needs review'||i.status==='New'?'Reviewed':i.status)}</select></label><label>Your priority decision<select name="priority">${options(data.priorities,i.reviewerPriority || i.priority.band)}</select></label></div><div class="form-columns"><label>Affected people <span class="form-field-hint">Nonnegative integer or leave blank for unknown</span><input name="affectedPeople" type="number" min="0" max="1000000" step="1" value="${esc(apValue)}" placeholder="Unknown"></label><label>Reported needs <span class="form-field-hint">One per line · up to 12</span><textarea name="needs" rows="3" maxlength="7500" placeholder="Medical needs mentioned&#10;Supplies mentioned">${esc(needsValue)}</textarea></label></div><label>Review note<input name="note" value="${esc(i.review?.note||'')}" maxlength="600" placeholder="What did you change or decide?"></label><label>Reviewer label<input name="actor" value="${esc(i.review?.actor||'Demo reviewer')}" required maxlength="80"></label><div class="form-error" role="alert"></div><div class="modal-actions">${button('close','Cancel')}<button type="submit" class="btn primary">${icon('check')}Save review</button></div></form>`); }
function compareModal(id) { const pair=data.duplicates.find(p=>p.id===id);if(!pair)return;const incidents=[pair.a,pair.b].map(id=>data.incidents.find(i=>i.id===id));openModal(`${modalHeading('DUPLICATE REVIEW','Two reports. One careful decision.','Compare the source claims. Both reports remain in the exercise.')}<div class="comparison">${incidents.map(i=>`<article><span class="mono">${number(i)}</span><h3>${esc(fields(i).title)}</h3><p class="comparison-location">${icon('pin')}${esc(location(fields(i).locationId))}</p><blockquote>${esc(i.report.text)}</blockquote><div>${pill(i.status,'neutral')}${pill(i.reviewerPriority||i.priority.band)}</div><small>${date(i.createdAt)} · ${esc(i.report.source)}</small></article>`).join('')}</div><div class="similarity-note">${icon('layers')}<p><strong>${Math.round(pair.score*100)}% similarity score</strong><br>${esc(pair.reason)}</p></div><div class="form-error" role="alert"></div><div class="modal-actions"><span class="decision-copy">${pair.decision?`Current decision: ${esc(pair.decision)}`:'Do these reports appear related?'}</span>${button('duplicate-decision','Keep distinct','secondary',`data-id="${esc(id)}" data-decision="distinct"`)}${button('duplicate-decision',`${icon('check')}Mark as related`,'primary',`data-id="${esc(id)}" data-decision="related"`)}</div>`,true); }
function resetModal() { openModal(`${modalHeading('RESET EXERCISE','Start with a fresh scenario.','This clears added reports, decisions, drafts, and activity. It restores the 10 seeded reports.')}<div class="modal-actions">${button('close','Keep current exercise')}${button('confirm-reset',`${icon('refresh')}Reset demo data`,'danger')}</div>`); }
function tokenModal(message='') { if(modal.open)modal.close();openModal(`${modalHeading('JUDGE ACCESS','Open the exercise.','Enter the demo access token provided by the project owner.')}<form id="token-form"><label>Access token<input name="token" type="password" required autocomplete="off"></label><div class="form-error" role="alert">${esc(message)}</div><div class="modal-actions"><button type="submit" class="btn primary">Open workspace ${icon('arrow')}</button></div></form>`); }
async function run(operation) { if(busy)return;busy=true;const buttons=[...modal.querySelectorAll('button'),...app.querySelectorAll('.heading-actions button,.detail-actions button')];buttons.forEach(b=>b.disabled=true);try{await operation();}catch(error){const target=modal.open?modal.querySelector('.form-error'):null;if(target)target.textContent=error.message;else toast(error.message);if(error.status===401)tokenModal(error.message);}finally{busy=false;buttons.forEach(b=>b.disabled=false);} }
async function generate() { await run(async()=>{toast('Preparing the exercise summary…');await api('/api/situation-reports',{});page='reports';await refresh();toast('Situation draft generated. Review it before sharing.');}); }
function exportDraft(draft) { const text=`# Harborlight situation report\n\nDRAFT — HUMAN REVIEW REQUIRED\n\nGenerated: ${draft.generatedAt}\nMethod: ${draft.ai.label}\n\n${draft.text}\n\n## Status counts\n${Object.entries(draft.byStatus).map(([s,c])=>`- ${s}: ${c}`).join('\n')}\n\n## Reported needs\n${draft.needs.map(n=>`- ${n}`).join('\n') || 'None recorded.'}\n\n## Coverage\n${draft.coverage}\n`;const url=URL.createObjectURL(new Blob([text],{type:'text/markdown'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=`afterlight-situation-${draft.generatedAt.slice(0,10)}.md`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
document.addEventListener('click', async event=>{
  const target=event.target.closest('[data-action]');if(!target||target.disabled||busy)return;const action=target.dataset.action;
  if(action==='page'){page=target.dataset.page;render();document.querySelector('#main')?.focus();}
  if(action==='select'){selected=target.dataset.id;render();}
  if(action==='filter'){filter=target.dataset.filter;render();}
  if(action==='metric'){filter=({all:'All',review:'Awaiting review',high:'Elevated',reviewed:'Human decisions'})[target.dataset.filter];render();}
  if(action==='new-report')reportModal();
  if(action==='review')reviewModal();
  if(action==='close')modal.close();
  if(action==='sample'){const form=document.querySelector('#report-form');form.elements.text.value='SIMULATION: Water is reported near the fictional Northgate community hall. Two nearby streets may be affected. Exact depth and number of affected households are unknown.';form.elements.locationId.value='northgate';form.elements.text.focus();}
  if(action==='compare')compareModal(target.dataset.id);
  if(action==='generate')await generate();
  if(action==='retry')await run(async()=>{toast('Retrying report extraction…');await api(`/api/incidents/${selected}/retry`,{});await refresh();toast('Extraction updated. Human edits were retained.');});
  if(action==='duplicate-decision')await run(async()=>{await api('/api/duplicates/decision',{pairId:target.dataset.id,decision:target.dataset.decision});modal.close();await refresh();toast('Decision recorded. Both reports remain available.');});
  if(action==='reset')resetModal();
  if(action==='confirm-reset')await run(async()=>{await api('/api/reset',{confirm:'RESET'});modal.close();selected=null;filter='All';query='';page='operations';zoom=1;mapView=null;await refresh();toast('A fresh Harborlight exercise is ready.');});
  if(action==='zoom-in'){zoom=Math.min(2,zoom+.5);render();}
  if(action==='zoom-out'){zoom=Math.max(1,zoom-.5);render();}
  if(action==='zoom-reset'){zoom=1;render();}
  if(action==='export'&&data.situationReports.length)exportDraft(data.situationReports.at(-1));
  if(action==='show-draft'){const draft=data.situationReports.find(d=>d.id===target.dataset.id);openModal(`${modalHeading('SITUATION DRAFT',`Harborlight · ${date(draft.generatedAt)}`)}<div class="saved-draft"><p>${esc(draft.text)}</p><p class="coverage-note">${esc(draft.coverage)}</p></div><div class="modal-actions">${button('close','Close')}${button('export-saved',`${icon('download')}Export draft`,'primary',`data-id="${draft.id}"`)}</div>`,true);}
  if(action==='export-saved')exportDraft(data.situationReports.find(d=>d.id===target.dataset.id));
  if(action==='logout'){token='';sessionStorage.removeItem('afterlight-token');tokenModal();}
  if(action==='reload')await boot();
});
document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.matches('.map-marker')){event.preventDefault();event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
document.addEventListener('input',event=>{if(event.target.id==='queue-search'){query=event.target.value;document.querySelector('#queue-list').innerHTML=queueItems();updateMapMarkers();}});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!['report-form','review-form','token-form'].includes(form.id))return;event.preventDefault();
  if(form.id==='token-form') {token=form.elements.token.value;sessionStorage.setItem('afterlight-token',token);await run(async()=>{await refresh();modal.close();});return;}
  await run(async()=>{
    const body=Object.fromEntries(new FormData(form).entries());
    if(form.id==='report-form'){
      const file=form.elements.image.files[0];body.image=null;
      if(file){if(file.size>1_048_576||!['image/png','image/jpeg'].includes(file.type))throw new Error('Use a PNG or JPEG smaller than 1 MB.');body.image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Image could not be read.'));reader.readAsDataURL(file);});}
      toast('Extracting the report and saving it for review…');
      const result=await api('/api/incidents',body);selected=result.incident.id;page='operations';filter='All';query='';modal.close();await refresh();toast(result.incident.ai.error || 'Report saved. It is ready for human review.');
    } else {await api(`/api/incidents/${form.dataset.id}/review`,body);modal.close();await refresh();toast('Your review decision has been recorded.');}
  });
});
modal.addEventListener('click',event=>{if(event.target===modal){const rect=modal.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)modal.close();}});
async function boot() {try{await refresh();}catch(error){if(error.status===401)tokenModal();else app.innerHTML=`<div class="boot"><img src="/favicon.svg" alt="" width="56" height="56"><h1>We couldn’t open the exercise.</h1><p>${esc(error.message)}</p>${button('reload','Try again','primary')}</div>`;}}
await boot();
