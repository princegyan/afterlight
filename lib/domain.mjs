export const STATUSES = ['New', 'Needs review', 'Reviewed', 'Monitoring', 'Resolved'];
export const PRIORITIES = ['Low', 'Moderate', 'High', 'Critical'];
export const CATEGORIES = ['Flooding', 'Infrastructure', 'Medical', 'Supplies', 'Other'];
export const LOCATIONS = [
  { id: 'northgate', name: 'Northgate community hall', lat: 47.6150, lng: -122.3485 },
  { id: 'canal', name: 'Canal footbridge', lat: 47.6017, lng: -122.3392 },
  { id: 'eastbank', name: 'Eastbank homes', lat: 47.6060, lng: -122.3250 },
  { id: 'station', name: 'Old station', lat: 47.5988, lng: -122.3294 },
  { id: 'market', name: 'Lantern market', lat: 47.6097, lng: -122.3425 },
  { id: 'clinic', name: 'Harborlight clinic', lat: 47.6049, lng: -122.3240 },
  { id: 'school', name: 'Westhaven school', lat: 47.6200, lng: -122.3360 },
];
// Explicitly seeded simulation points over real geography; these are not real reports.
export const MAP_CONFIG = { center: [47.6085, -122.3370], zoom: 14, region: 'Seattle waterfront', tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' };
export const now = () => new Date().toISOString();
export const newId = prefix => `${prefix}-${globalThis.crypto.randomUUID()}`;
export class InputError extends Error { constructor(message) { super(message); this.status = 400; } }
export function boundedText(value, name, min = 0, max = 5000) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw new InputError(`${name} must contain ${min}–${max} characters.`);
  return value.trim();
}
export function validateImage(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > 1_400_000) throw new InputError('Use a PNG or JPEG image smaller than 1 MB.');
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new InputError('Only PNG and JPEG demo images are accepted.');
  let bytes;
  try { bytes = atob(match[2]); } catch { throw new InputError('Invalid image encoding.'); }
  const valid = bytes.startsWith(match[1] === 'png' ? '\x89PNG\r\n\x1a\n' : '\xff\xd8\xff');
  if (!valid || bytes.length > 1_048_576) throw new InputError('Image content does not match its type or is larger than 1 MB.');
  return value;
}
export function validateIntake(body) {
  const text = boundedText(body.text, 'Report', 15, 5000);
  const locationId = body.locationId || null;
  if (locationId && !LOCATIONS.some(l => l.id === locationId)) throw new InputError('Choose a location in the fictional scenario.');
  return { text, locationId, source: boundedText(body.source || 'Exercise participant', 'Source', 1, 80), image: validateImage(body.image), imageContext: boundedText(body.imageContext || '', 'Image context', 0, 600) };
}
export function prioritySuggestion(extraction) {
  // Score only report claims. It is a review queue band, never an instruction to respond.
  const text = positiveClaims(`${extraction.summary} ${extraction.needs.join(' ')}`);
  const factors = [];
  let score = 0;
  if (/injur|medical|medicine/.test(text)) { score += 3; factors.push('Report mentions a medical need (+3)'); }
  if (/isolated|trapped|unable to leave/.test(text)) { score += 3; factors.push('Report mentions people being isolated (+3)'); }
  if (/flood|water|power|bridge/.test(text)) { score += 2; factors.push('Report mentions disrupted access or infrastructure (+2)'); }
  if ((extraction.affectedPeople ?? 0) >= 10) { score += 1; factors.push('Reported group is 10 people or more (+1)'); }
  const band = score >= 6 ? 'Critical' : score >= 3 ? 'High' : score >= 1 ? 'Moderate' : 'Low';
  return { band, score, factors: factors.length ? factors : ['No escalation signals found in this report'], rubric: '0: Low · 1–2: Moderate · 3–5: High · 6+: Critical', note: 'Unverified report claims. A reviewer chooses the final queue priority.' };
}
function positiveClaims(text) {
  return text.toLowerCase()
    .replace(/\b(?:bottled water|drinking water|bottles? of water)\b/g, 'packaged drinks')
    .replace(/\b(?:power|electricity)\s+(?:has been |was |is )(?:restored|back(?: on)?)\b/g, 'service restored')
    .replace(/\bno\s+(?:injuries|injury|medical needs?|power (?:issues?|outages?)|flooding|isolation)\b/g, '')
    .replace(/\bnot\s+(?:injured|isolated|trapped|flooded)\b/g, '')
    .replace(/\binjur(?:y|ies)\s+count\s+(?:is\s+)?(?:unknown|not provided)\b/g, '')
    .replace(/\bno\s+injur(?:y|ies)\s+count\s+(?:is\s+)?provided\b/g, '');
}
export function validateExtraction(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('Extraction must be an object.');
  const list = key => {
    if (!Array.isArray(value[key]) || value[key].length > 12) throw new InputError(`Invalid ${key} in model output.`);
    return value[key].map(v => boundedText(v, key, 1, 600));
  };
  if (!CATEGORIES.includes(value.category)) throw new InputError('Invalid extraction category.');
  if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) throw new InputError('Invalid extraction confidence.');
  if (value.affectedPeople !== null && (!Number.isInteger(value.affectedPeople) || value.affectedPeople < 0 || value.affectedPeople > 1_000_000)) throw new InputError('Invalid affected people estimate.');
  return {
    title: boundedText(value.title, 'Title', 3, 120), summary: boundedText(value.summary, 'Summary', 3, 1200), category: value.category,
    confidence: value.confidence, affectedPeople: value.affectedPeople, needs: list('needs'), uncertainty: list('uncertainty'), missingFields: list('missingFields'), evidenceNotes: list('evidenceNotes'),
  };
}
export function demoExtraction(report) {
  const text = report.text;
  const lower = positiveClaims(text);
  const category = /medical|injur|medicine/.test(lower) ? 'Medical' : /flood|water/.test(lower) ? 'Flooding' : /power|bridge|road|electric|service restored/.test(lower) ? 'Infrastructure' : /suppl|blanket|food|packaged drinks/.test(lower) ? 'Supplies' : 'Other';
  const personMatch = /\b(\d{1,6})\s+(?:people|residents|participants|persons)\b/i.exec(text);
  const uncertainCount = personMatch && /\b(unknown|unconfirmed|uncertain|not confirmed)\b/i.test(text.slice(Math.max(0, personMatch.index - 35), personMatch.index + personMatch[0].length + 55));
  const affectedPeople = personMatch && !uncertainCount ? Number(personMatch[1]) : null;
  const location = LOCATIONS.find(l => l.id === report.locationId);
  const needs = [];
  if (/medicine|medical|injur/.test(lower)) needs.push('Medical needs mentioned');
  if (/supplies|food|blanket/.test(lower)) needs.push('Supplies mentioned');
  if (/\b(?:need(?:ed)?|request(?:ed)?|short of)\s+(?:more\s+)?packaged drinks\b|\bpackaged drinks\s+(?:are\s+|is\s+)?(?:needed|requested)\b/.test(lower)) needs.push('Drinking water requested');
  if (/power|electric/.test(lower)) needs.push('Power disruption mentioned');
  if (/isolated|trapped|unable to leave/.test(lower)) needs.push('Isolation reported');
  const missingFields = ['Independent confirmation', ...(affectedPeople === null ? ['Affected people count'] : []), ...(!location ? ['Location'] : []), 'Incident occurrence time'];
  const uncertainty = ['The report has not been independently verified.', ...(/may|might|unknown|uncertain|unconfirmed|conflict/.test(lower) ? ['The source explicitly expresses uncertainty.'] : []), ...(report.image ? ['Rule-based demo extraction does not analyze image pixels.'] : [])];
  return validateExtraction({ title: `${category} report${location ? ` · ${location.name}` : ' · location unknown'}`, summary: text.replace(/^SIMULATION:\s*/i, '').slice(0, 1200), category, confidence: 0.55, affectedPeople, needs, uncertainty, missingFields, evidenceNotes: ['Fields were extracted from the submitted text with a deterministic demo parser.', ...(report.imageContext ? [`Image context supplied by participant: ${report.imageContext}`] : [])] });
}
export function buildIncident(report, extraction, ai) {
  return { id: newId('inc'), number: 0, report, extraction, ai, priority: prioritySuggestion(extraction), reviewerPriority: null, status: 'Needs review', createdAt: now(), updatedAt: now() };
}
export function validateReviewAffectedPeople(value) {
  // null means "unknown"; absence of key means "not corrected".
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    value = value.trim();
    if (value === '') return null;
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) throw new InputError('Affected people must be a nonnegative integer or unknown.');
  } else if (typeof value !== 'number') {
    throw new InputError('Affected people must be a nonnegative integer or unknown.');
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000) throw new InputError('Affected people must be a nonnegative integer or unknown.');
  return n;
}
export function validateReviewNeeds(value) {
  // Accepts an array of strings or a newline-delimited string from a textarea.
  let arr;
  if (Array.isArray(value)) {
    arr = value;
  } else if (typeof value === 'string') {
    arr = value.split('\n').map(s => s.trim()).filter(s => s.length > 0);
  } else if (value == null) {
    return [];
  } else {
    throw new InputError('Needs must be a list of strings.');
  }
  if (arr.length > 12) throw new InputError('A review can list at most 12 needs.');
  return arr.map(s => boundedText(s, 'Need', 1, 600));
}
export function applyReview(incident, body) {
  if (!STATUSES.includes(body.status)) throw new InputError('Invalid status.');
  if (!PRIORITIES.includes(body.priority)) throw new InputError('Choose a final priority.');
  const title = boundedText(body.title, 'Title', 3, 120);
  const summary = boundedText(body.summary, 'Summary', 3, 1200);
  if (!CATEGORIES.includes(body.category)) throw new InputError('Choose a category.');
  const category = body.category;
  const locationId = body.locationId || null;
  if (locationId && !LOCATIONS.some(l => l.id === locationId)) throw new InputError('Choose a fictional location.');
  const actor = boundedText(body.actor || 'Demo reviewer', 'Reviewer', 1, 80);
  const note = boundedText(body.note || '', 'Review note', 0, 600);
  // Validate reviewer corrections for affectedPeople and needs.
  // "affectedPeople" key absent in body → not supplied this review (keep previous or leave absent).
  // "affectedPeople": null or '' → reviewer explicitly marks as unknown.
  const hasAffectedPeople = 'affectedPeople' in body;
  const affectedPeople = hasAffectedPeople ? validateReviewAffectedPeople(body.affectedPeople) : undefined;
  const hasNeeds = 'needs' in body;
  const needs = hasNeeds ? validateReviewNeeds(body.needs) : undefined;
  const previous = displayFields(incident);
  // Record before values including any existing human corrections.
  const before = {
    status: incident.status,
    priority: incident.reviewerPriority,
    title: previous.title,
    summary: previous.summary,
    category: previous.category,
    locationId: previous.locationId,
    // Include previous human corrections if they exist.
    ...('affectedPeople' in (incident.review || {}) ? { affectedPeople: incident.review.affectedPeople } : {}),
    ...('needs' in (incident.review || {}) ? { needs: incident.review.needs } : {}),
  };
  // Preserve model suggestions and original report; reviewer corrections live separately.
  const review = { title, summary, category, locationId, actor, note, reviewedAt: now() };
  if (hasAffectedPeople) review.affectedPeople = affectedPeople;
  else if (incident.review && 'affectedPeople' in incident.review) review.affectedPeople = incident.review.affectedPeople;
  if (hasNeeds) review.needs = needs;
  else if (incident.review && 'needs' in incident.review) review.needs = incident.review.needs;
  incident.review = review;
  incident.status = body.status;
  incident.reviewerPriority = body.priority;
  incident.updatedAt = now();
  const after = { title, summary, category, locationId, status: body.status, priority: body.priority };
  if ('affectedPeople' in review) after.affectedPeople = review.affectedPeople;
  if ('needs' in review) after.needs = review.needs;
  return { actor, details: `Set status to ${body.status} and priority to ${body.priority}.${note ? ` ${note}` : ''}`, before, after };
}
export const displayFields = incident => {
  const base = { ...incident.extraction, ...(incident.review || {}), locationId: incident.review ? incident.review.locationId : incident.report.locationId };
  // affectedPeople: use review value when the key is explicitly present (covers null and 0); otherwise use extraction.
  if (!incident.review || !('affectedPeople' in incident.review)) base.affectedPeople = incident.extraction.affectedPeople;
  // needs: use review value when the key is explicitly present (covers empty array); otherwise use extraction.
  if (!incident.review || !('needs' in incident.review)) base.needs = incident.extraction.needs;
  return base;
};
export function duplicateCandidates(incidents, decisions = []) {
  const words = text => new Set(text.toLowerCase().match(/\b[a-z]{4,}\b/g)?.filter(w => !['simulation','report','reported','fictional','unknown','near','with','from','have','this','that','says'].includes(w)) || []);
  const result = [];
  for (let a = 0; a < incidents.length; a++) for (let b = a + 1; b < incidents.length; b++) {
    const first = incidents[a], second = incidents[b];
    const firstFields = displayFields(first), secondFields = displayFields(second);
    if (!firstFields.locationId || firstFields.locationId !== secondFields.locationId) continue;
    const aw = words(first.report.text), bw = words(second.report.text);
    const overlap = [...aw].filter(w => bw.has(w));
    const similarity = overlap.length / Math.max(1, new Set([...aw, ...bw]).size);
    const sameCategory = firstFields.category === secondFields.category;
    const withinWindow = Math.abs(Date.parse(first.createdAt) - Date.parse(second.createdAt)) <= 24 * 60 * 60 * 1000;
    const score = Math.min(0.99, 0.4 + similarity * 0.35 + (sameCategory ? 0.15 : 0) + (withinWindow ? 0.05 : 0));
    if (overlap.length < 2 || score < 0.65) continue;
    const id = [first.id, second.id].sort().join('::');
    const decision = decisions.find(d => d.pairId === id);
    result.push({ id, a: first.id, b: second.id, score, reason: `Same fictional location; ${sameCategory ? 'same category; ' : ''}${overlap.length} shared report terms${withinWindow ? '; submitted within 24 hours' : ''}. This is a similarity score, not a probability.`, decision: decision?.decision || null });
  }
  return result.sort((a,b) => b.score - a.score);
}
export function createSeed() {
  const inputs = [
    ['northgate','SIMULATION: Water is reported near Northgate community hall. Two nearby streets may be affected. Exact depth and affected people count are unknown.','Needs review'],
    ['eastbank','SIMULATION: 12 residents report flooding at Eastbank homes. The group says they are isolated. Water depth is unknown.','Needs review'],
    ['canal','SIMULATION: The Canal footbridge is reported closed after flooding. The bridge condition is unconfirmed.','Monitoring'],
    ['clinic','SIMULATION: Harborlight clinic reports a power interruption and a need for medicine supplies. No injury count is provided.','Reviewed'],
    ['northgate','SIMULATION: Water near Northgate community hall may affect two streets. The number of affected people is unknown.','New'],
    ['school','SIMULATION: Westhaven school has blankets and food supplies available for the exercise. Delivery needs are unknown.','Reviewed'],
    ['station','SIMULATION: Old station reports a power interruption. Cause and duration have not been confirmed.','Monitoring'],
    ['market','SIMULATION: Lantern market reports standing water. A participant says conditions may be improving.','Resolved'],
    ['eastbank','SIMULATION: Eastbank homes report flooding with residents possibly isolated. The number of residents is unconfirmed.','Needs review'],
    ['canal','SIMULATION: Debris is reported beside the Canal footbridge. No structural damage has been confirmed.','New'],
  ];
  const incidents = inputs.map(([locationId,text,status], i) => {
    const incident = buildIncident({text, locationId, source: `Exercise participant ${String(i+1).padStart(2,'0')}`, image: null, imageContext: ''}, demoExtraction({text,locationId}), {mode:'demo', label:'Rule-based demo', error:null});
    incident.id = `inc-seed-${i+1}`; incident.number = i+1; incident.status = status;
    incident.createdAt = new Date(Date.now() - (inputs.length-i) * 7 * 60_000).toISOString();
    incident.updatedAt = incident.createdAt;
    if (['Reviewed','Monitoring','Resolved'].includes(status)) incident.reviewerPriority = incident.priority.band;
    return incident;
  });
  return {version:1, scenario:{id:'harborlight', name:'Harborlight', subtitle:'Fictional flood exercise', startedAt:now()}, incidents, decisions:[], situationReports:[], audit:[{id:newId('audit'), action:'Scenario initialized', actor:'Demo system', details:'10 synthetic reports loaded. All locations are fictional.', at:now()}]};
}
export function auditEntry(action, actor, details, incidentId = null, extra = {}) { return {id:newId('audit'), action, actor, details, incidentId, at:now(), ...extra}; }
export function situationDraft(state) {
  const incidents = state.incidents;
  const byStatus = Object.fromEntries(STATUSES.map(s => [s, incidents.filter(i=>i.status===s).length]));
  // Use displayFields so reviewed needs take precedence over extraction needs.
  const needs = [...new Set(incidents.filter(i=>i.status!=='Resolved').flatMap(i=>displayFields(i).needs))];
  const unreviewed = incidents.filter(i=>!i.reviewerPriority).length;
  const noLocation = incidents.filter(i=>!displayFields(i).locationId).length;
  const duplicateCount = duplicateCandidates(incidents,state.decisions).filter(d=>!d.decision).length;
  return {generatedAt:now(), count:incidents.length, byStatus, unreviewed, needs, noLocation, duplicateCount,
    text:`Harborlight fictional flood exercise contains ${incidents.length} reports. ${byStatus['New'] + byStatus['Needs review']} await review, ${byStatus.Monitoring} are being monitored, and ${byStatus.Resolved} are marked resolved in the simulation. ${unreviewed} reports have no human priority decision. Reported needs: ${needs.length ? needs.join('; ') : 'none recorded'}. ${duplicateCount} possible duplicate pairs remain for review. ${noLocation} reports have an unknown location.`,
    coverage:'Generated draft for human review. Counts represent submitted reports, not verified events or unique affected people. Source claims may conflict. This simulation provides no response instructions.'};
}
