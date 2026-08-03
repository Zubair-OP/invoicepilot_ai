import { User } from "../../database/models/index.js";
import { NotFoundError } from "../../common/errors/index.js";

export async function getOrCreateUser(clerkId: string, email: string, name: string, avatar?: string) {
  let user = await User.findOne({ clerkId });

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
  const user = await User.findOne({ clerkId }).lean();
  if (!user) throw new NotFoundError("User");
  return user;
}

export async function updateProfile(clerkId: string, data: { name?: string; company?: string; avatar?: string }) {
  const user = await User.findOne({ clerkId });
  if (!user) throw new NotFoundError("User");

  Object.assign(user, data);
  await user.save();
  return user;
}

export async function deleteAccount(clerkId: string) {
  const user = await User.findOne({ clerkId });
  if (!user) throw new NotFoundError("User");
  await user.deleteOne();
}
