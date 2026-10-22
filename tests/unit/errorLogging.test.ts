jest.mock("../../src/routes/router", () => ({
  StatusCodes: { BAD_REQUEST: 400, INTERNAL_SERVER_ERROR: 500 },
}));

import { handleRouteError } from "../../src/middleware/errorHandling";
import { validateRequest } from "../../src/middleware/validation";
import { logger } from "../../src/utilities/logger";

describe("central error logging", () => {
  const canary = "synthetic-private-data-canary";

  afterEach(() => jest.restoreAllMocks());

  const response = () => {
    const res: any = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);
    return res;
  };

  it("keeps the route response contract without logging exception contents", () => {
    const log = jest.spyOn(logger, "error").mockImplementation(() => logger);
    const res = response();
    const err: any = new Error(canary);
    err.statusCode = 400;

    handleRouteError(err, {} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ err: canary });
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain(canary);
  });

  it("keeps generic validation failure response without logging exception contents", async () => {
    const log = jest.spyOn(logger, "error").mockImplementation(() => logger);
    const res = response();
    const schema: any = { parseAsync: jest.fn().mockRejectedValue(new Error(canary)) };

    await validateRequest(schema)({ body: {} } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ err: "An unexpected error occurred" });
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain(canary);
  });
});
