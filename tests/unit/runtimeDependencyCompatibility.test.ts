const { createRequire } = require("module");
import { createServer } from "http";
import { AddressInfo } from "net";
import { formatDuration } from "../../src/services/mailing/mailer";

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("patched runtime dependency compatibility", () => {
  for (const dependency of ["aws-sdk", "google-gax", "node-cron", "teeny-request"]) {
    it(`${dependency} resolves the patched CommonJS UUID without changing v4 output`, () => {
      const load = createRequire(require.resolve(dependency));
      expect(load("uuid/package.json").version).toBe("11.1.1");
      expect(load("uuid").v4()).toMatch(uuidV4);
    });
  }

  it("preserves the UUID helpers called by AWS and Google clients", () => {
    expect(require("aws-sdk").util.uuid.v4()).toMatch(uuidV4);
    expect(require("google-gax/build/src/util").makeUUID()).toMatch(uuidV4);
  });

  it("preserves cron registration and manual execution without starting a timer", () => {
    const cron = require("node-cron");
    const callback = jest.fn();
    const task = cron.schedule("*/10 * * * *", callback, { scheduled: false });
    try {
      expect(task.options.name).toMatch(uuidV4);
      task.now();
      expect(callback).toHaveBeenCalledTimes(1);
    } finally {
      task.stop();
    }
  });

  it("preserves the Google HTTP client's multipart UUID boundary on loopback", async () => {
    let contentType = "";
    const server = createServer((req, res) => {
      contentType = req.headers["content-type"] || "";
      req.resume();
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end('{"ok":true}');
      });
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const { teenyRequest } = require("teeny-request");
      const result = await new Promise<any>((resolve, reject) => teenyRequest({
        uri: `http://127.0.0.1:${(server.address() as AddressInfo).port}/synthetic`,
        method: "POST",
        headers: {},
        multipart: [{ "Content-Type": "application/json", body: "synthetic-metadata" }, { "Content-Type": "application/octet-stream", body: require("stream").Readable.from(["synthetic-ciphertext"]) }],
      }, (error, response, body) => error ? reject(error) : resolve({ response, body })));
      expect(result.response.statusCode).toBe(200);
      expect(contentType.replace("multipart/related; boundary=", "")).toMatch(uuidV4);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it.each([[0, "0:00:00"], [59999, "0:00:59"], [3600000, "1:00:00"], [176400000, "49:00:00"]])(
    "keeps email duration formatting for %i milliseconds",
    (milliseconds, expected) => expect(formatDuration(milliseconds)).toBe(expected)
  );
});
