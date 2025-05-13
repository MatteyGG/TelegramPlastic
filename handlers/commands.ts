import { bot } from "../lib/context";
import { getResponse } from "../modules/getConfig";
import { verifyAdmin } from "../modules/isAdmin";

export function register_commands() {
  console.log("Registering commands...");
  bot.command("start", async (ctx) => {
    const message = (await verifyAdmin(ctx)) ? getResponse("startAdmin") : getResponse("start");
    ctx.reply(message);
  });

  bot.command("help", (ctx) =>
    ctx.reply(
      getResponse("help")
    )
  );
}
