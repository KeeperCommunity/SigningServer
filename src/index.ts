import bodyParser from "body-parser";
import express, { Express } from "express";
import morgan from "morgan";

import config from "./config";
import { logger, unhandledLogger} from "./utilities/logger"
import { initializeCrons } from "./utilities/crons";
import { initializeRoutes } from "./routes/router";

class SigningServer {
  private app: Express;

  constructor() {
    this.app = express();
    this.configure();
    this.invoke();
    initializeCrons();
    config.initRSAKeys();
  }

  private configure(): void {
    this.app.set("router", express.Router());
    this.app.set("config", config);
    this.app.use(morgan("combined", { stream: { write: message => logger.info(message.trim()) } }));
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use(initializeRoutes(this.app));
  }

  private invoke(): void {
    const PORT = config.PORT;

    this.app.listen(PORT, () => {
      logger.info(`Signing Server, ${Date()}, listening on port: ${config.PORT} version: ${config.VERSION} env: ${config.ENVIRONMENT} DB: ${config.DB_MODE}`)
    });

    unhandledLogger(); // logs unhandled rejections and uncaught exceptions
  }
}
new SigningServer();

