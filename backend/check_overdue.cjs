const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const inv = await db.collection("invoices").findOne({ invoiceNumber: "INV-202608-0005" });
  if (!inv) { console.log("NOT FOUND"); await mongoose.disconnect(); return; }

  console.log("=== OVERDUE INVOICE ===");
  console.log(JSON.stringify({
    invoiceNumber: inv.invoiceNumber, status: inv.status, issuedAt: inv.issuedAt,
    dueDate: inv.dueDate, remindersSent: inv.remindersSent || [],
    lastReminderAt: inv.lastReminderAt, customerId: inv.customerId,
    emailsSent: inv.emailsSent || [],
  }, null, 2));

  const customer = await db.collection("customers").findOne({ _id: inv.customerId });
  console.log("\n=== CUSTOMER ===");
  console.log(JSON.stringify({ name: customer?.name, email: customer?.email }, null, 2));

  const user = await db.collection("users").findOne({ _id: inv.userId });
  console.log("\n=== USER SETTINGS ===");
  console.log(JSON.stringify({ reminders: user?.settings?.reminders, lastSweptAt: user?.lastSweptAt }, null, 2));

  await mongoose.disconnect();
}
main().catch(console.error);
