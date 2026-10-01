// Google Apps Script: saves every application to a Google Sheet and emails it to you.
// Setup is in the comment at the bottom. The site posts here via APPLICATION_WEBHOOK_URL.
const NOTIFY = "dan@danwilmott.com";

function doPost(e) {
  const d = JSON.parse(e.postData.contents || "{}");
  const row = [
    new Date(), d.name, d.email, d.phone, d.business,
    d.revenueLabel, d.workLabel, d.blockerLabel, d.leadsLabel, d.goalLabel, d.urgencyLabel,
    d.source, d.qualified ? "Yes" : "No",
  ];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Received", "Name", "Email", "Mobile", "Business", "Revenue", "Video work", "Blocker", "Leads from", "12-mo goal", "Urgency", "Source", "$10K+"]);
  }
  sheet.appendRow(row);
  MailApp.sendEmail({
    to: NOTIFY,
    replyTo: d.email || NOTIFY,
    subject: "New application: " + d.name + " (" + (d.revenueLabel || "no revenue given") + ")",
    body: d.text || JSON.stringify(d, null, 2),
  });
  return ContentService.createTextOutput("ok");
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
*/
