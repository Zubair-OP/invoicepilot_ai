import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { User } from "../../database/models/index.js";
import { NotFoundError } from "../../common/errors/index.js";
import * as settingsService from "./settings.service.js";

const PREFIX = "iso_settings";

describe("settings tenant isolation", () => {
  let ownerId: string;
  let otherId: string;

  beforeAll(async () => {
    await mongoose.connect(env.MONGO_URI);
  });

  afterAll(async () => {
    await User.deleteMany({ clerkId: { $regex: `^${PREFIX}` } });
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({ clerkId: { $regex: `^${PREFIX}` } });
  });

  it("returns each user's own settings, never another tenant's", async () => {
    const owner = await User.create({
      clerkId: `${PREFIX}_owner`,
      email: "set-owner@example.com",
      name: "Owner",
      settings: { defaultCurrency: "USD", invoicePrefix: "ACME" },
    });
    const other = await User.create({
      clerkId: `${PREFIX}_other`,
      email: "set-other@example.com",
      name: "Other",
      settings: { defaultCurrency: "INR", invoicePrefix: "OTHER" },
    });
    ownerId = owner._id.toString();
    otherId = other._id.toString();

    const ownerSettings = await settingsService.getSettings(ownerId);
    const otherSettings = await settingsService.getSettings(otherId);

    expect(ownerSettings.defaultCurrency).toBe("USD");
    expect(ownerSettings.invoicePrefix).toBe("ACME");
    expect(otherSettings.defaultCurrency).toBe("INR");
    expect(otherSettings.invoicePrefix).toBe("OTHER");
  });

  it("updating one tenant's settings does not change another's", async () => {
    const owner = await User.create({
      clerkId: `${PREFIX}_owner2`,
      email: "set-owner2@example.com",
      name: "Owner 2",
      settings: { defaultCurrency: "USD", invoicePrefix: "ACME" },
    });
    const other = await User.create({
      clerkId: `${PREFIX}_other2`,
      email: "set-other2@example.com",
      name: "Other 2",
      settings: { defaultCurrency: "USD", invoicePrefix: "OTHER" },
    });
    ownerId = owner._id.toString();
    otherId = other._id.toString();

    await settingsService.updateSettings(ownerId, { defaultCurrency: "EUR" });

    const ownerSettings = await settingsService.getSettings(ownerId);
    const otherSettings = await settingsService.getSettings(otherId);
    expect(ownerSettings.defaultCurrency).toBe("EUR");
    expect(otherSettings.defaultCurrency).toBe("USD");
  });

  it("does not expose settings for a soft-deleted account", async () => {
    const user = await User.create({
      clerkId: `${PREFIX}_deleted`,
      email: "set-deleted@example.com",
      name: "Deleted",
      deletedAt: new Date(),
    });
    await expect(settingsService.getSettings(user._id.toString())).rejects.toBeInstanceOf(NotFoundError);
  });
});
