const CONFIG = {
  SPREADSHEET_ID: 'INSERT YOUR SPREADSHEET ID HERE',
  RAW_SHEET: 'Data_Raw',
  REMARKS_SHEET: 'Remarks',
  ALARMS_SHEET: 'Data_Alarms',
  SESSION_HOURS: 1
};

function doGet() {
  const t = HtmlService.createTemplateFromFile('Index');
  t.appTitle = 'ZTE MoraRep CSR Network Dashboard';
  return t.evaluate()
    .setTitle(t.appTitle)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function debugSheets() {
  const ss = getSpreadsheet_();
  return ss.getSheets().map(s => s.getName());
}

function getRawSheet_() {
  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName(CONFIG.RAW_SHEET);
  if (!sh) {
    throw new Error(
      'Sheet not found: ' + CONFIG.RAW_SHEET +
      ' | available: ' + ss.getSheets().map(s => s.getName()).join(', ')
    );
  }
  return sh;
}

function getAlarmsSheet_() {
  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName(CONFIG.ALARMS_SHEET);
  if (!sh) {
    throw new Error(
      'Sheet not found: ' + CONFIG.ALARMS_SHEET +
      ' | available: ' + ss.getSheets().map(s => s.getName()).join(', ')
    );
  }
  return sh;
}

function ensureRemarksSheet_() {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(CONFIG.REMARKS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.REMARKS_SHEET);
    sh.getRange(1, 1, 1, 6).setValues([[
      'Timestamp', 'Site_ID', 'City', 'IP', 'Status', 'Remark'
    ]]);
  }
  return sh;
}


function getRemarksTable() {
  const sh = ensureRemarksSheet_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) {
    return {
      ok: true,
      columns: ['Timestamp', 'Site_ID', 'City', 'IP', 'Status', 'Remark'],
      rows: []
    };
  }
  const headers = values[0].map(h => String(h).trim());
  const rows = values.slice(1).map(r => ({
    timestamp: formatTimestampSafe_(r[0]),
    site_id: r[1],
    city: r[2],
    ip: r[3],
    status: r[4],
    remark: r[5]
  }));
  return {
    ok: true,
    columns: headers,
    rows
  };
}

function parseDate_(v) {
  if (v instanceof Date) return v;
  if (typeof v === 'string') return new Date(v.replace(' ', 'T'));
  return new Date(v);
}

function formatDate_(v) {
  return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function formatTimestampSafe_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v.trim())) {
      return v.trim();
    }
    try {
      const d = new Date(v.replace(' ', 'T'));
      if (!isNaN(d.getTime())) {
        return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      }
    } catch(e) {}
  }
  return String(v);
}

function getRemarksMap_() {
  const sh = ensureRemarksSheet_();
  const vals = sh.getDataRange().getValues();
  const map = {};
  vals.slice(1).forEach(r => {
    // Key structure: [Timestamp, Site_ID, Status]
    // Value: Remark (r[5])
    const formattedDate = formatTimestampSafe_(r[0]); // <-- FIX: Convert to safe string key
    map[[formattedDate, r[1], r[4]].join('||')] = r[5] || '';
  });
  return map;
}
function dashboard(mode) {
  const sh = getRawSheet_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) {
    return {
      ok: true,
      latestTimestamp: null,
      windowStart: null,
      windowEnd: null,
      summary: { up: 0, down: 0 },
      detail: [],
      top10: []
    };
  }

  const headers = values[0].map(h => String(h).trim().toLowerCase());
  const idx = name => headers.indexOf(name.toLowerCase());

  const rows = values.slice(1).map(r => ({
    timestamp: parseDate_(r[idx('Timestamp')]),
    site_id: r[idx('Site_ID')],
    city: r[idx('City')],
    csr_ip: r[idx('CSR')],
    bbu_ip: r[idx('BBU')],
    csr: String(r[idx('Status CSR')] || '').trim(),
    bbu: String(r[idx('Status BBU')] || '').trim()
  })).filter(r => r.timestamp && !isNaN(r.timestamp.getTime()));

  const latest = rows.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
  const end = latest.timestamp;
  const start = new Date(end.getTime() - 3600 * 1000);
  const active = rows.filter(r => r.timestamp >= start && r.timestamp <= end);

  const m = String(mode || 'csr').toLowerCase();
  const field = m === 'bbu' ? 'bbu' : 'csr';
  const remarksMap = getRemarksMap_();

  const summary = {
    up: active.filter(r => String(r[field]).toLowerCase() === 'up').length,
    down: active.filter(r => String(r[field]).toLowerCase() === 'down').length
  };

  const detail = active
    .filter(r => String(r[field]).toLowerCase() === 'down')
    .map(r => {
      const rowKey = [formatDate_(r.timestamp), r.site_id, 'Down'].join('||');
      return {
        rowKey,
        timestamp: formatDate_(r.timestamp),
        site_id: r.site_id,
        city: r.city,
        ip: m === 'bbu' ? r.bbu_ip : r.csr_ip,
        status: r[field],
        remark: remarksMap[rowKey] || ''
      };
    });

  const counts = {};
  rows.filter(r => String(r[field]).toLowerCase() === 'down').forEach(r => {
    const k = r.site_id + '||' + r.city;
    counts[k] = (counts[k] || 0) + 1;
  });

  const top10 = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, v]) => {
      const [site_id, city] = k.split('||');
      return { site_id, city, count: v };
    });

  return {
    ok: true,
    latestTimestamp: formatDate_(end),
    windowStart: formatDate_(start),
    windowEnd: formatDate_(end),
    summary,
    detail,
    top10
  };
}

function getAlarms() {
  const sh = getAlarmsSheet_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) {
    return {
      ok: true,
      latestTimestamp: null,
      windowStart: null,
      windowEnd: null,
      levelCounts: {},
      moduleCounts: {},
      rows: [],
      columns: ['Hostname', 'Host', 'ID', 'Code', 'Level', 'Time', 'Module', 'Detail']
    };
  }

  const headers = values[0].map(h => String(h).trim());
  const lower = headers.map(h => h.toLowerCase());
  const idx = name => lower.indexOf(name.toLowerCase());
  const tsIdx = idx('Timestamp');
  const hostnameIdx = idx('Hostname');
  const hostIdx = idx('Host');
  const idIdx = idx('ID');
  const codeIdx = idx('Code');
  const levelIdx = idx('Level');
  const timeIdx = idx('Time');
  const moduleIdx = idx('Module');
  const detailIdx = idx('Detail');

  const rows = values.slice(1).map(r => ({
    rawTimestamp: parseDate_(r[tsIdx]),
    hostname: r[hostnameIdx],
    host: r[hostIdx],
    id: r[idIdx],
    code: r[codeIdx],
    level: String(r[levelIdx] || '').trim(),
    time: r[timeIdx],
    module: String(r[moduleIdx] || '').trim(),
    detail: r[detailIdx]
  })).filter(r => r.rawTimestamp && !isNaN(r.rawTimestamp.getTime()));

  const latest = rows.reduce((a, b) => a.rawTimestamp > b.rawTimestamp ? a : b);
  const end = latest.rawTimestamp;
  const start = new Date(end.getTime() - 3600 * 1000);
  const active = rows.filter(r => r.rawTimestamp >= start && r.rawTimestamp <= end);

  const levelCounts = {};
  const moduleCounts = {};
  active.forEach(r => {
    const lv = String(r.level || '').toLowerCase();
    const mod = String(r.module || '').trim();
    if (lv) levelCounts[lv] = (levelCounts[lv] || 0) + 1;
    if (mod) moduleCounts[mod] = (moduleCounts[mod] || 0) + 1;
  });

  const rowsOut = active.map(r => ({
    Hostname: r.hostname,
    Host: r.host,
    ID: r.id,
    Code: r.code,
    Level: r.level,
    Time: formatDate_(r.rawTimestamp),
    Module: r.module,
    Detail: r.detail
  }));

  return {
    ok: true,
    latestTimestamp: formatDate_(end),
    windowStart: formatDate_(start),
    windowEnd: formatDate_(end),
    levelCounts,
    moduleCounts,
    rows: rowsOut,
    columns: ['Hostname', 'Host', 'ID', 'Code', 'Level', 'Time', 'Module', 'Detail']
  };
}

function saveRemarksTable(updatedRows) {
  const ss = getSpreadsheet_(); // <-- FIX
  const remarksSheet = ss.getSheetByName(CONFIG.REMARKS_SHEET);

  if (!remarksSheet) throw new Error("Sheet 'Remarks' not found.");

  const headers = [
    'Timestamp',
    'Site_ID',
    'City',
    'IP',
    'Status',
    'Remark'
  ];

  remarksSheet.clearContents();
  remarksSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (updatedRows && updatedRows.length) {
    remarksSheet.getRange(2, 1, updatedRows.length, updatedRows[0].length).setValues(updatedRows);
  }

  return { ok: true };
}