import { Context } from "grammy";

export async function verifyAdmin(ctx: Context): Promise<boolean> {
  return ctx.from?.id.toString() === process.env.ADMIN_ID;
}