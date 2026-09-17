/**
 * 8. Karmapa Eger: shared registration backend.
 * Paste into Extensions > Apps Script of the Google Sheet, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). After changes: Manage deployments > Edit > New version.
 */
var SHEET_NAME = 'Jelentkezések';
var ITEMS = [
  ['fri_dinner', 'Péntek vacsora', 1800],
  ['fri_room', 'Péntek szállás', 2000],
  ['sat_breakfast', 'Szombat reggeli', 1000],
  ['sat_lunch', 'Szombat ebéd', 1800],
  ['sat_dinner', 'Szombat vacsora', 1800],
  ['sat_room', 'Szombat szállás', 2000],
  ['sun_breakfast', 'Vasárnap reggeli', 1000],
  ['sun_lunch', 'Vasárnap ebéd', 1800]
];
var HEADERS = ['ID', 'Név', 'Étrend']
  .concat(ITEMS.map(function (it) { return it[1]; }))
  .concat(['Összesen', 'Módosítva']);
var COL_MEALS = 3;
var COL_TOTAL = COL_MEALS + ITEMS.length;
var COL_UPDATED = COL_TOTAL + 1;
var MAX_PEOPLE = 400;
var DIET_VEG = 'vegetáriánus';
var DIET_MEAT = 'húsos';
var LAYOUT_VERSION = '2';
var CACHE_KEY = 'people';
// Hand edits in the sheet show up on the site within this many seconds.
var CACHE_SECONDS = 20;

function doGet() {
  return respond_(function () {
    var cache = CacheService.getScriptCache();
    var hit = cache.get(CACHE_KEY);
    if (hit) return { people: JSON.parse(hit) };
    var people = toPeople_(sheet_().getDataRange().getValues());
    putCache_(people);
    return { people: people };
  });
}

function doPost(e) {
  return respond_(function () {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sh = sheet_();
      var values = sh.getDataRange().getValues();
      var result = {};
      if (body.action === 'save') {
        result.id = savePerson_(sh, values, body.person || {});
      } else if (body.action === 'delete') {
        deletePerson_(sh, values, String(body.id || ''));
      } else {
        throw new Error('Unknown action');
      }
      result.people = toPeople_(values);
      putCache_(result.people);
      return result;
    } finally {
      lock.releaseLock();
    }
  });
}

function respond_(fn) {
  var out;
  try {
    out = fn();
    out.ok = true;
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function putCache_(people) {
  try {
    CacheService.getScriptCache().put(CACHE_KEY, JSON.stringify(people), CACHE_SECONDS);
  } catch (err) {
    // Too large for the cache: readers fall back to the sheet.
  }
}

// Column formats are set once, not on every save.
function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('layout') !== LAYOUT_VERSION || sh.getLastRow() === 0) {
    var rows = sh.getMaxRows();
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, rows, COL_MEALS).setNumberFormat('@');
    sh.getRange(1, COL_MEALS + 1, rows, ITEMS.length + 1).setNumberFormat('#,##0" Ft";;""');
    sh.getRange(1, COL_UPDATED + 1, rows, 1).setNumberFormat('yyyy-mm-dd hh:mm');
    props.setProperty('layout', LAYOUT_VERSION);
  }
  return sh;
}

function isTicked_(v) {
  if (v === '' || v === null || v === false || v === 0) return false;
  var s = String(v).trim().toLowerCase();
  return s !== '' && s !== '0' && s !== 'false' && s !== 'nem';
}

function toPeople_(values) {
  var people = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (String(r[0]).trim() === '' || String(r[1]).trim() === '') continue;
    var meals = {};
    for (var j = 0; j < ITEMS.length; j++) meals[ITEMS[j][0]] = isTicked_(r[COL_MEALS + j]);
    var updated = r[COL_UPDATED];
    people.push({
      id: String(r[0]),
      name: String(r[1]),
      diet: String(r[2]).trim().toLowerCase().indexOf('veg') === 0 ? 'veg' : 'meat',
      meals: meals,
      updatedAt: updated instanceof Date ? updated.toISOString() : String(updated || '')
    });
  }
  return people;
}

// Control characters become spaces; leading = + - @ would turn a name into a formula.
function cleanName_(v) {
  return String(v || '')
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[=+\-@]+/, '')
    .trim()
    .slice(0, 80);
}

function findIndex_(values, id) {
  if (!id) return -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === id) return i;
  }
  return -1;
}

function savePerson_(sh, values, p) {
  var name = cleanName_(p.name);
  if (!name) throw new Error('Name is required');
  var id = /^[A-Za-z0-9-]{8,64}$/.test(String(p.id || '')) ? String(p.id) : '';
  var idx = findIndex_(values, id);
  if (idx < 0) {
    if (values.length - 1 >= MAX_PEOPLE) throw new Error('Registration limit reached');
    id = id || Utilities.getUuid();
    idx = values.length;
  }
  var meals = p.meals || {};
  var cells = ITEMS.map(function (it) { return meals[it[0]] === true ? it[2] : ''; });
  var total = cells.reduce(function (s, v) { return s + (Number(v) || 0); }, 0);
  var record = [id, name, p.diet === 'veg' ? DIET_VEG : DIET_MEAT].concat(cells, [total, new Date()]);
  sh.getRange(idx + 1, 1, 1, HEADERS.length).setValues([record]);
  values[idx] = record;
  return id;
}

function deletePerson_(sh, values, id) {
  var idx = findIndex_(values, id);
  if (idx > 0) {
    sh.deleteRow(idx + 1);
    values.splice(idx, 1);
  }
}
