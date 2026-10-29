/**
 * Mail proxy web app.
 *
 * GET ?token=...&query=...&start=0&max=20&body=none|plain|html
 *
 * Parameters mirror GmailApp.search(query, start, max):
 *   query  Gmail search string, same syntax as the Gmail search box (default: "")
 *   start  index of the first thread to return (default: 0)
 *   max    number of threads to return, 1..500 (default: 20)
 * Extra:
 *   body   include message bodies: none (default), plain, html
 *   token  must equal the API_TOKEN script property
 */

var DEFAULT_MAX = 20;
var MAX_LIMIT = 500; // GmailApp.search hard limit

function doGet(e) {
  var params = (e && e.parameter) || {};
  var startedAt = Date.now();
  var authorized = false;
  try {
    checkToken_(params.token);
    authorized = true;
    var req = parseSearchParams_(params);
    var result = searchMail_(req);
    var logError = logSearch_(req, result.count, Date.now() - startedAt);
    if (logError) result.logError = logError;
    return json_(result);
  } catch (err) {
    var message = String(err && err.message ? err.message : err);
    var out = { ok: false, error: message };
    var logFailure = logError_('search', params, message, Date.now() - startedAt);
    // Only callers with a valid token see internal log failures.
    if (logFailure && authorized) out.logError = logFailure;
    return json_(out);
  }
}

function checkToken_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!expected) throw new Error('API_TOKEN script property is not set');
  if (token !== expected) throw new Error('unauthorized');
}

function parseSearchParams_(params) {
  var start = toInt_(params.start, 0, 'start');
  var max = toInt_(params.max, DEFAULT_MAX, 'max');
  if (start < 0) throw new Error('start must be >= 0');
  if (max < 1 || max > MAX_LIMIT) throw new Error('max must be between 1 and ' + MAX_LIMIT);
  var body = params.body || 'none';
  if (['none', 'plain', 'html'].indexOf(body) < 0) throw new Error('body must be none, plain or html');
  return { query: params.query || '', start: start, max: max, body: body };
}

function toInt_(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  if (!/^-?\d+$/.test(value)) throw new Error(name + ' must be an integer');
  return parseInt(value, 10);
}

function searchMail_(req) {
  var threads = GmailApp.search(req.query, req.start, req.max);
  return {
    ok: true,
    query: req.query,
    start: req.start,
    max: req.max,
    count: threads.length,
    threads: threads.map(function (t) { return serializeThread_(t, req.body); })
  };
}

function serializeThread_(thread, body) {
  return {
    id: thread.getId(),
    subject: thread.getFirstMessageSubject(),
    lastMessageDate: thread.getLastMessageDate().toISOString(),
    messageCount: thread.getMessageCount(),
    labels: thread.getLabels().map(function (l) { return l.getName(); }),
    isUnread: thread.isUnread(),
    isImportant: thread.isImportant(),
    isInInbox: thread.isInInbox(),
    permalink: thread.getPermalink(),
    messages: thread.getMessages().map(function (m) { return serializeMessage_(m, body); })
  };
}

function serializeMessage_(msg, body) {
  var out = {
    id: msg.getId(),
    from: msg.getFrom(),
    to: msg.getTo(),
    cc: msg.getCc(),
    bcc: msg.getBcc(),
    replyTo: msg.getReplyTo(),
    subject: msg.getSubject(),
    date: msg.getDate().toISOString(),
    isUnread: msg.isUnread(),
    isStarred: msg.isStarred(),
    attachments: msg.getAttachments().map(function (a) {
      return { name: a.getName(), contentType: a.getContentType(), size: a.getSize() };
    })
  };
  if (body === 'plain') out.body = msg.getPlainBody();
  if (body === 'html') out.body = msg.getBody();
  return out;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Run this from the editor after adding a scope to appsscript.json.
 * doGet catches log-write errors, so running it never shows the consent screen.
 */
function authorize() {
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  console.log('all scopes granted');
}
