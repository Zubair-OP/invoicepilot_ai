import { User } from "../../database/models/index.js";
import { NotFoundError } from "../../common/errors/index.js";
import { invalidateAuthUser } from "../../common/cache/redis.js";

export async function getOrCreateUser(clerkId: string, email: string, name: string, avatar?: string) {
  let user = await User.findOne({ clerkId, deletedAt: { $exists: false } });

  if (!user) {
    user = await User.create({
      clerkId,
      email,
      name,
      avatar,
    });
  }

  return user;
}

export async function getProfile(clerkId: string) {
  const user = await User.findOne({ clerkId, deletedAt: { $exists: false } }).lean();
  if (!user) throw new NotFoundError("User");
  return user;
}

export async function updateProfile(clerkId: string, data: { name?: string; company?: string; avatar?: string }) {
  const user = await User.findOne({ clerkId, deletedAt: { $exists: false } });
  if (!user) throw new NotFoundError("User");

  Object.assign(user, data);
  await user.save();
  await invalidateAuthUser(clerkId);
  return user;
}

export async function deleteAccount(clerkId: string) {
  const user = await User.findOne({ clerkId, deletedAt: { $exists: false } });
  if (!user) throw new NotFoundError("User");
  user.deletedAt = new Date();
  await user.save();
  await invalidateAuthUser(clerkId);
}
