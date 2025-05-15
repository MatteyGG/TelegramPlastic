// logger.ts
import path from "path";
import pino from "pino";
import pretty from "pino-pretty";

const logLevel = process.env.LOG_LEVEL || "info";

export const LOGGER_DIR = path.join(__dirname, '../../logs');


// Форматтер для консоли без форматирования даты
// Формат времени в читаемом виде
const timestamp = () => `,"time":"${new Date().toISOString()}"`;

// Форматтер для консоли
const prettyStream = pretty({
  colorize: true,           // Цветной вывод
  crlf: false,              // Отключаем перенос строк
  errorLikeObjectKeys: ["err", "error"], // Логирование ошибок
  levelFirst: true,         // Уровень лога в начале строки
  translateTime: "SYS:yyyy-mm-dd HH:MM:ss", // Читаемый формат времени
  ignore: "pid,hostname",   // Исключаем стандартные поля
});

// Общий логгер (консоль + файл)
const mainLogger = pino(
  {
    level: logLevel,
    timestamp, // Добавляем время в JSON
    base: { host: "TelegramBot" }, // Добавляем хост
  },
  pino.multistream([
    { 
      stream: prettyStream,
    },
    { 
      level: "info",
      stream: pino.destination(LOGGER_DIR + "/bot.log" ) // Запись в файл
    },
  ])
);

// Логгер для запросов (консоль + файл)
const requestLogger = pino({
  base: { host: "TelegramBot" },
  timestamp, 
  formatters: {
    level: (label) => ({ level: label }), // Уровень лога (info/warn/error)
  },
}, pino.destination(LOGGER_DIR + "/requests.log")); // Запись в файл


export { mainLogger, requestLogger };

