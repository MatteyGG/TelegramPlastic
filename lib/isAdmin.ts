import { Context } from "grammy";
import { prisma } from "../modules/database";

export async function verifyAdmin(ctx: Context): Promise<boolean> {
  const userId = ctx.from?.id.toString();
  if (!userId) return false;

  // Главный админ из .env
  if (userId === process.env.ADMIN_ID) {
    return true;
  }

  // Проверяем в базе данных
  try {
    const admin = await prisma.admin.findUnique({
      where: { userId: userId }
    });
    return !!admin;
  } catch (error) {
    console.error("Error checking admin in database:", error);
    return false;
  }
}