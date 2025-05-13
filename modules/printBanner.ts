import figlet from 'figlet';
import { promisify } from 'util';

import si from 'systeminformation';


const figletAsync = promisify(figlet) as (text: string) => Promise<string>;

export async function printBanner() {
  const banner = await figletAsync('TelegramPlastic');
  // const systemInfo = await getSystemInfo();
  console.info(banner);
  // console.info(systemInfo);
}


async function getSystemInfo() {
  const cpu = await si.cpu();
  const mem = await si.mem();
  const disk = await si.fsSize();
  const os = await si.osInfo();

  return `
    🖥️ CPU: ${cpu.brand}
    🧠 RAM: ${(mem.used / 1024 ** 3).toFixed(2)} GB / ${(mem.total / 1024 ** 3).toFixed(2)} GB
    💾 Disk: ${(disk[0].used / 1024 ** 3).toFixed(2)} GB / ${(disk[0].size / 1024 ** 3).toFixed(2)} GB
    🌐 OS: ${os.distro} ${os.release}
  `;
}