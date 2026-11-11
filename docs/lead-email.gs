// Google Apps Script: saves every application to a Google Sheet and emails it to you.
// Setup is in the comment at the bottom. The site posts here via APPLICATION_WEBHOOK_URL.
const NOTIFY = "dan@danwilmott.com";

// A cell that starts with = + - or @ is read as a formula, so a mobile like "+61 4..." showed #ERROR!.
// A leading ' keeps it as plain text.
const asText = (v) => {
  const s = v == null ? "" : String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
};

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    // Booking notices from /api/book have no application in them: email only, no new row.
    if (d.booking || !d.email) {
      MailApp.sendEmail({ to: NOTIFY, subject: d.text || "ProfitX notice", body: d.text || JSON.stringify(d, null, 2) });
      return ContentService.createTextOutput("ok");
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000); // two people applying at the same moment shouldn't collide
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["Received", "Name", "Email", "Mobile", "Business", "Revenue", "Video work", "Blocker", "Leads from", "12-mo goal", "Urgency", "Source", "$10K+"]);
      }
      sheet.appendRow([
        new Date(), asText(d.name), asText(d.email), asText(d.phone), asText(d.business),
        asText(d.revenueLabel), asText(d.workLabel), asText(d.blockerLabel), asText(d.leadsLabel), asText(d.goalLabel), asText(d.urgencyLabel),
        asText(d.source), d.qualified ? "Yes" : "No",
      ]);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    // The row is saved. A failed email must not make the site think the save failed (it would retry and duplicate the row).
    try {
      MailApp.sendEmail({
        to: NOTIFY,
        replyTo: d.email || NOTIFY,
        subject: "New application: " + d.name + " (" + (d.revenueLabel || "no revenue given") + ")",
        body: d.text || JSON.stringify(d, null, 2),
      });
    } catch (mailError) {
      console.error("email failed", mailError);
    }
    return ContentService.createTextOutput("ok");
  } catch (err) {
    // Reply with the error as text (not "ok") so the site knows the lead did not reach the sheet.
    console.error(err);
    return ContentService.createTextOutput("error: " + err);
  }
}

/*
SETUP (about 5 minutes)
1. Go to sheets.google.com, create a blank sheet named "ProfitX Applications".
2. Extensions -> Apps Script. Delete the sample code, paste this whole file, click Save.
3. Deploy -> New deployment -> type "Web app".
   Execute as: Me.  Who has access: Anyone.  Click Deploy and approve the permissions.
4. Copy the Web app URL (ends in /exec).
5. In Vercel -> profitx-apply -> Settings -> Environment Variables, add
   APPLICATION_WEBHOOK_URL = that URL, then redeploy.

UPDATING THE SCRIPT LATER (keeps the same URL)
Paste the new code over the old, Save, then Deploy -> Manage deployments -> pencil icon ->
Version: New version -> Deploy. Creating a brand new deployment would give a new URL.
*/
