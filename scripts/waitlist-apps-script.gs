/**
 * Aurevo waitlist -> Google Sheet webhook.
 *
 * Setup (~5 min):
 * 1. Create a Google Sheet (sheets.new), name it e.g. "Aurevo waitlist".
 * 2. Extensions -> Apps Script, delete the stub and paste this whole file.
 * 3. Deploy -> New deployment -> type "Web app":
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    Click Deploy, authorize, and copy the Web app URL.
 * 4. In the repo, create `.env.local` with:
 *      NEXT_PUBLIC_WAITLIST_WEBHOOK_URL=<that URL>
 *    (and set the same env var wherever the site is deployed), then rebuild.
 *
 * Every signup appends a row: timestamp, email, comment, UTM fields,
 * referrer, landing time, client-side submit time, and page.
 *
 * Note: the URL is public (it ships in the client bundle), so treat rows as
 * untrusted input; the sheet is only writable through this script.
 */

const SHEET_NAME = "Waitlist";

const COLUMNS = [
  "Received at",
  "Email",
  "Comment",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "Referrer",
  "Landed at",
  "Submitted at (client)",
  "Page",
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try {
    const data = JSON.parse(e.postData.contents);
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = doc.getSheetByName(SHEET_NAME) || doc.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(COLUMNS);
    }
    const clean = function (value) {
      return String(value == null ? "" : value).slice(0, 1000);
    };
    sheet.appendRow([
      new Date(),
      clean(data.email),
      clean(data.note),
      clean(data.utm_source),
      clean(data.utm_medium),
      clean(data.utm_campaign),
      clean(data.utm_term),
      clean(data.utm_content),
      clean(data.referrer),
      clean(data.landed_at),
      clean(data.submitted_at),
      clean(data.page),
    ]);
    return ContentService.createTextOutput(
      JSON.stringify({ ok: true }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) }),
    ).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
