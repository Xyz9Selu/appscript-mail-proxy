/**
 * Request logs, written to tabs of the spreadsheet this script is bound to.
 * Tabs and header rows are created on first write.
 * Logging failures never fail the request: the log functions return the error
 * message (or null) so the caller can report it in the response.
 */

var LOG_SHEETS = {
  search: {
    name: 'SearchLog',
    headers: ['timestamp', 'query', 'start', 'max', 'body', 'count', 'durationMs']
  },
  // Used once sending is implemented.
  send: {
    name: 'SendLog',
    headers: ['timestamp', 'to', 'cc', 'bcc', 'subject', 'attachmentCount', 'durationMs']
  },
  error: {
    name: 'ErrorLog',
    headers: ['timestamp', 'action', 'params', 'error', 'durationMs']
  }
};

function logSearch_(req, count, durationMs) {
  return appendLog_(LOG_SHEETS.search, [new Date(), req.query, req.start, req.max, req.body, count, durationMs]);
}

function logSend_(mail, durationMs) {
  return appendLog_(LOG_SHEETS.send, [
    new Date(), mail.to || '', mail.cc || '', mail.bcc || '', mail.subject || '',
    (mail.attachments || []).length, durationMs
  ]);
}

function logError_(action, params, error, durationMs) {
  return appendLog_(LOG_SHEETS.error, [new Date(), action, JSON.stringify(redactParams_(params)), error, durationMs]);
}

// Never write the token to the sheet.
function redactParams_(params) {
  var out = {};
  Object.keys(params || {}).forEach(function (k) {
    if (k !== 'token') out[k] = params[k];
  });
  return out;
}

function appendLog_(def, row) {
  try {
    getLogSheet_(def).appendRow(row.map(escapeCell_));
    return null;
  } catch (err) {
    var message = 'log write failed (' + def.name + '): ' + (err && err.stack ? err.stack : err);
    console.error(message);
    return message;
  }
}

// Stop user-supplied text such as "=HYPERLINK(...)" from being read as a formula.
function escapeCell_(value) {
  return typeof value === 'string' && /^[=+\-@]/.test(value) ? "'" + value : value;
}

function getLogSheet_(def) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(def.name);
  if (sheet) return sheet;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
      sheet.appendRow(def.headers);
      sheet.setFrozenRows(1);
    }
    return sheet;
  } finally {
    lock.releaseLock();
  }
}
