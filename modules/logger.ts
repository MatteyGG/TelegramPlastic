// logger.ts
import * as path from "path";
import * as fs from "fs";
import pino from "pino";
import pretty from "pino-pretty";
import type { DestinationStream } from "pino";

const logLevel = process.env.LOG_LEVEL || "info";

export const LOGGER_DIR = path.join(process.cwd(), 'logs');

// Создаем директорию для логов, если её нет
if (!fs.existsSync(LOGGER_DIR)) {
    fs.mkdirSync(LOGGER_DIR, { recursive: true });
}

const timestamp = () => {
    const date = new Date();
    const month = `0${date.getMonth() + 1}`.slice(-2);
    const day = `0${date.getDate()}`.slice(-2);
    const hour = `0${date.getHours()}`.slice(-2);
    const minutes = `0${date.getMinutes()}`.slice(-2);
    const seconds = `0${date.getSeconds()}`.slice(-2);

    return `,"time":"${hour}:${minutes}:${seconds} ${day}-${month}-${date.getFullYear()}"`;
};

const prettyStream = pretty({
    colorize: true,
    crlf: true,
    errorLikeObjectKeys: ["err", "error"],
    levelFirst: true,
    translateTime: "SYS:HH:MM:ss dd-mm-yyyy",
    ignore: "pid,hostname",
});

// Функция для создания безопасного потока записи
const createLogStream = (filename: string): DestinationStream => {
    return pino.destination({
        dest: path.join(LOGGER_DIR, filename),
        mkdir: true,
        sync: true
    });
};

const mainStreams = [
    { stream: prettyStream },
    { level: "debug", stream: createLogStream("bot.log") }
];

const mainLogger = pino(
    {
        timestamp,
        base: { host: "TelegramBot" },
    },
    pino.multistream(mainStreams)
);

const requestLogger = pino({
    base: { host: "TelegramBot" },
    timestamp,
    formatters: {
        level: (label) => ({ level: label }),
    },
}, createLogStream("requests.log"));


export const flushLogger = async (): Promise<void> => {
  try {
    if (typeof (mainLogger as any).flush === 'function') {
      await (mainLogger as any).flush();
    }
    if (typeof (requestLogger as any).flush === 'function') {
      await (requestLogger as any).flush();
    }
    // Принудительное завершение записи
    await new Promise(resolve => setTimeout(resolve, 200));
  } catch (error) {
    console.error('Logger flush error:', error);
  }
};

// Корректное закрытие логгеров при завершении процесса
const handleExit = async (signal: string) => {
  console.log(`🔄 Received ${signal}, flushing logs...`);
  await flushLogger();
  process.exit(0);
};

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));
process.on('beforeExit', async () => {
  await flushLogger();
});
export { mainLogger, requestLogger };