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
    { level: "info", stream: createLogStream("bot.log") }
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

// Корректное закрытие логгеров при завершении процесса
const handleExit = async () => {
    await Promise.all([
        (mainLogger as any).flush(),
        (requestLogger as any).flush()
    ]);
    process.exit(0);
};

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);

export { mainLogger, requestLogger };