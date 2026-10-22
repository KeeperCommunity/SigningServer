import * as crypto from "crypto";
import * as bip39 from "bip39";

// Published BIP39 English test vector; this mnemonic never held funds.
const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("BIP39 seed compatibility after PBKDF2 patch", () => {
  it("matches the published passphrase vector", () => {
    expect(bip39.mnemonicToSeedSync(mnemonic, "TREZOR").toString("hex")).toBe(
      "c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e534955" +
      "31f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04"
    );
  });

  it("matches Node crypto with a long synthetic passphrase", () => {
    const passphrase = "keeper-disposable-test-".repeat(12);
    const expected = crypto.pbkdf2Sync(
      mnemonic.normalize("NFKD"),
      `mnemonic${passphrase}`.normalize("NFKD"),
      2048,
      64,
      "sha512"
    );
    expect(bip39.mnemonicToSeedSync(mnemonic, passphrase)).toEqual(expected);
  });
});
