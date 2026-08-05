import mongoose from "mongoose";
import { User, Customer, Invoice, Counter } from "./models/index.js";
import { generateInvoiceNumber } from "../modules/invoices/invoices.numbering.js";
import { seedPlans } from "../modules/billing/plans.seed.js";
import { env } from "../config/env.js";

/**
 * Development seed. Wipes and repopulates the database with one demo tenant.
 *
 * Guarded against production so an accidental `npm run db:seed` against a live
 * connection string cannot destroy real data.
 */
async function seed() {
  if (env.NODE_ENV === "production") {
    console.error("Refusing to seed in production.");
    process.exit(1);
  }

  await mongoose.connect(env.MONGO_URI);
  console.log(`Connected to MongoDB (${env.NODE_ENV})`);

  await seedPlans();

  await Promise.all([
    User.deleteMany({}),
    Customer.deleteMany({}),
    Invoice.deleteMany({}),
    // Counters must reset too, otherwise invoice numbers keep climbing across reseeds.
    Counter.deleteMany({}),
  ]);

  const user = await User.create({
    clerkId: "user_demo123",
    email: "demo@invoicepilot.ai",
    name: "Demo User",
    company: "InvoicePilot Demo",
    role: "USER",
  });

  const admin = await User.create({
    clerkId: "user_admin123",
    email: "admin@invoicepilot.ai",
    name: "Admin User",
    role: "ADMIN",
  });

  const customer = await Customer.create({
    userId: user._id,
    name: "Acme Corp",
    email: "billing@acme.com",
    phone: "+1-555-0100",
    address: "123 Business St, San Francisco, CA 94105",
  });

  const items = [
    { description: "UI/UX Design", quantity: 40, unitPrice: 75, total: 3000 },
    { description: "Frontend Development", quantity: 20, unitPrice: 100, total: 2000 },
  ];

  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const taxComponents = [
    { name: "CGST", rate: 9, amount: parseFloat((subtotal * 0.09).toFixed(2)) },
    { name: "SGST", rate: 9, amount: parseFloat((subtotal * 0.09).toFixed(2)) },
  ];
  const tax = taxComponents.reduce((sum, tc) => sum + tc.amount, 0);

  // Uses the same counter the API uses, so the first invoice created through the
  // API after seeding continues the sequence instead of colliding with it.
  const invoiceNumber = await generateInvoiceNumber(user._id.toString());

  await Invoice.create({
    userId: user._id,
    customerId: customer._id,
    invoiceNumber,
    status: "DRAFT",
    currency: "USD",
    items,
    subtotal,
    taxComponents,
    tax,
    discount: 0,
    total: parseFloat((subtotal + tax).toFixed(2)),
    notes: "Website redesign project - Phase 1",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  console.log("Seed complete:");
  console.log(`  User:    ${user.email} (${user.clerkId})`);
  console.log(`  Admin:   ${admin.email} (${admin.clerkId})`);
  console.log(`  Invoice: ${invoiceNumber}`);

  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
