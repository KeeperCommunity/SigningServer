// Disposable unit-test configuration; never load a developer or production .env.
process.env.ENVIRONMENT = "TEST";
process.env.BIT_ADMIN_KEY = "unit-test-only";
process.env.PROJECT_ID = "unit-test-project";
process.env.MNEMONIC_IDENTIFIER_V2 = "unit-v2";
process.env.MNEMONIC_IDENTIFIER_V3 = "unit-v3";
process.env.INHERITANCE_MNEMONIC_IDENTIFIER_V2 = "unit-inheritance-v2";
process.env.INHERITANCE_MNEMONIC_IDENTIFIER_V3 = "unit-inheritance-v3";
jest.mock("dotenv", () => ({ config: () => ({ parsed: {} }) }));
jest.mock("../src/utilities/secretManager", () => ({
  fetchSecrets: jest.fn(async (identifiers: string[]) => {
    const { generateMnemonic } = require("bip39");
    return identifiers.map((identifier) => ({ [identifier]: generateMnemonic() }));
  }),
}));
jest.mock("@google-cloud/secret-manager", () => ({
  SecretManagerServiceClient: jest.fn(() => {
    throw new Error("Unit tests must not contact cloud Secret Manager");
  }),
}));
