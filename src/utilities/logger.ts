import * as winston from "winston";

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.simple(),
  transports: [new winston.transports.File({ filename: "logfile.log" })],
});

export const unhandledLogger = () => {
  process.on("unhandledRejection", () => {
    logger.error("Unhandled promise rejection");
  });

  process.on("uncaughtException", () => {
    logger.error("Uncaught exception");
    process.exit(1);
  });
};
