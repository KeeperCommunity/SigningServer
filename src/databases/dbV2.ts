import mongoose, { Schema } from "mongoose";
import { PermittedAction, VerificationType } from "../interfaces/signer";
import config, { DATABASE_TYPE } from "../config";
import { fetchSecrets } from "../utilities/secretManager";

class DatabaseV2 {
  private signerV2 = new Schema({
    vaultId: String,
    appId: { type: String, required: false }, // for versions <= 1.0.1
    xIndex: Number,
    policy: {
      type: {
        verification: {
          type: {
            method: {
              type: String,
              enum: Object.values(VerificationType),
              required: true,
            },
            verifier: {
              type: {
                twoFAKey: String,
              },
              required: true,
            },
          },
          required: true,
        },
        restrictions: {
          type: {
            none: { type: Boolean, default: true },
            maxTransactionAmount: { type: Number }, // max amount for an outgoing transaction
          },
        },
        exceptions: {
          type: {
            none: { type: Boolean, default: true },
            transactionAmount: { type: Number }, // max tx amount till no verification is needed
          },
        },
      },
      required: true,
    },
  });

  private inheritanceKeyV2 = new Schema({
    vaultId: String,
    xIndex: Number,
    configuration: {
      type: {
        m: Number,
        n: Number,
        descriptors: [String],
        bsms: { type: String, required: false },
      },
      required: false,
    },
    policy: {
      type: {
        notification: {
          type: {
            targets: [String],
          },
          required: true,
        },
        alert: {
          type: {
            emails: [String],
          },
          required: false,
        },
      },
      required: false,
    },
  });

  private inheritanceKeyRequestV2 = new Schema({
    requestId: String,
    vaultId: String,
    arrivedAt: Number,
    status: {
      type: {
        isDeclined: Boolean,
        isApproved: Boolean,
      },
      required: true,
    },
  });

  private signerV3 = new Schema({
    id: String,
    xIndex: Number, // isBIP85? BIP-85 child index : child-index(xpriv)
    isBIP85: Boolean,
    policy: {
      type: {
        verification: {
          type: {
            method: {
              type: String,
              enum: Object.values(VerificationType),
              required: true,
            },
            verifier: {
              type: String,
              required: true,
            },
          },
          required: true,
        },
        restrictions: {
          type: {
            none: { type: Boolean, default: true },
            maxTransactionAmount: { type: Number }, // max amount for an outgoing transaction
            timeWindow: { type: Number }, // time period in milliseconds (e.g., 7 days = 7 * 24 * 60 * 60 * 1000)
            // note: if timeWindow is present, maxTransactionAmount turns into the aggregate maximum amount allowed in that time period
          },
          required: true,
        },
        secondaryVerification: {
          type: [
            {
              id: { type: String, required: true },
              method: {
                type: String,
                enum: Object.values(VerificationType),
                required: true,
              },
              label: { type: String, required: false },
              verifier: { type: String, required: true },
              permittedActions: {
                type: [String],
                enum: Object.values(PermittedAction),
                required: true,
              },
            },
          ],
          required: false,
        },
        signingDelay: { type: Number, required: false },
        backupDisabled: { type: Boolean, required: false },
        exceptions: {
          type: {
            none: { type: Boolean, default: true },
            transactionAmount: { type: Number },
          },
          required: false,  // exceptions are not available for new policy(time based spending limit)
        },
      },
      required: true,
    },
    credsVersion: {
      type: String,
      required: false, // not available when signer migrates from V2 to V3, which then allows other mechanisms to default to V2 creds
    },
  });

  private cosignersToSignerMapV3 = new Schema({
    cosignersId: {
      type: String,
      unique: true,
    },
    signerId: String,
  });

  private inheritanceKeyV3 = new Schema({
    id: String,
    xIndex: Number, // isBIP85? BIP-85 child index : child-index(xpriv)
    isBIP85: Boolean,
    configurations: {
      type: [
        {
          id: String,
          m: Number,
          n: Number,
          descriptors: [String],
          bsms: { type: String, required: false },
        },
      ],
      default: undefined,
    },
    policy: {
      type: {
        notification: {
          type: {
            targets: [String],
          },
          required: true,
        },
        alert: {
          type: String,
          required: false,
        },
      },
      required: false,
    },
    credsVersion: {
      type: String,
      required: false, // not available when IKS migrates from V2 to V3, which then allows other mechanisms to default to V2 creds
    },
  });

  private inheritanceKeyRequestV3 = new Schema({
    requestId: String,
    inheritanceKeyId: String,
    arrivedAt: Number,
    type: String,
    status: {
      type: {
        isDeclined: Boolean,
        isApproved: Boolean,
      },
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now, // Automatically set the field to the current date and time
      expires: config.INHERITANCE_KEY_REQUEST_TTL, // TTL index(in seconds) with an expiration time of 90(30*3) days on live and 15(5*3) mins on dev
    },
  });

  private cosignersToSignerMapIKSV3 = new Schema({
    cosignersId: {
      type: String,
      unique: true,
    },
    inheritanceKeyId: String,
  });

  private delayedTransactionV3 = new Schema({
    txid: String,
    serializedPSBT: String,
    signerId: String,
    outgoing: Number,
    verificationToken: String,
    timestamp: Number,
    delayUntil: Number,
    FCM: String,
    signedPSBT: String,
  });

  private transactionLogV3 = new Schema({
    signerId: { type: String, required: true },
    txid: { type: String, required: true },
    amount: { type: Number, required: true },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      expires: 0, // TTL index, removes document when expiresAt is reached
    },
  });

  private delayedPolicyUpdateSchema = new Schema({
    policyId: { type: String, required: true },
    signerId: { type: String, required: true },
    policyUpdates: { type: Object, required: true },
    verificationToken: { type: String, required: true },
    timestamp: { type: Number, required: true },
    delayUntil: { type: Number, required: true },
    FCM: { type: String },
    isApplied: { type: Boolean },
  });

  private connection;
  constructor() {
    this.initializeConnection();
  }

  public initializeConnection = async () => {
    const [response] = await fetchSecrets(
      [config.DATABASE_SECRET_IDENTIFIER_V2],
      true
    );
    const databaseCreds = response[config.DATABASE_SECRET_IDENTIFIER_V2];
    let databaseURL: string;
    console.log("Connected to:", databaseCreds.name);
    if (config.DB_MODE === DATABASE_TYPE.DEV)
      databaseURL = `mongodb+srv://${databaseCreds.name}:${databaseCreds.password}@development.razn9q8.mongodb.net/?retryWrites=true&w=majority`;
    else
      databaseURL = `mongodb+srv://${databaseCreds.name}:${databaseCreds.password}@live.jfby42q.mongodb.net/?retryWrites=true&w=majority`;

    mongoose.Promise = global.Promise;
    this.connection = mongoose.createConnection(databaseURL, {
      dbName: config.DATABASE_NAME_V2,
      autoIndex: config.DB_MODE === DATABASE_TYPE.DEV, 
    });
  };

  public getSignerV2Model = (): mongoose.Model<mongoose.Document, {}> => {
    return this.connection.model("Signer", this.signerV2);
  };

  public getInheritanceKeyV2Model = (): mongoose.Model<
    mongoose.Document,
    {}
  > => {
    return this.connection.model("Inheritance Key", this.inheritanceKeyV2);
  };

  public getInheritanceKeyRequestV2Model = (): mongoose.Model<
    mongoose.Document,
    {}
  > => {
    return this.connection.model(
      "Inheritance Key Request",
      this.inheritanceKeyRequestV2
    );
  };

  public getSignerV3Model = (): mongoose.Model<mongoose.Document, {}> => {
    return this.connection.model("Signer V3", this.signerV3);
  };

  public getCoSignersToSignerMapV3Model = (): mongoose.Model<
    mongoose.Document,
    {}
  > => {
    return this.connection.model(
      "CosignersToSigner V3",
      this.cosignersToSignerMapV3
    );
  };

  public getInheritanceKeyV3Model = (): mongoose.Model<
    mongoose.Document,
    {}
  > => {
    return this.connection.model("Inheritance Key V3", this.inheritanceKeyV3);
  };

  public getInheritanceKeyRequestV3Model = (): mongoose.Model<
    mongoose.Document,
    {}
  > => {
    return this.connection.model(
      "Inheritance Key Request V3",
      this.inheritanceKeyRequestV3
    );
  };

  public getCoSignersToSignerMapIKSV3Model = (): mongoose.Model<
    mongoose.Document,
    {}
  > => {
    return this.connection.model(
      "CosignersToSigner IKS V3",
      this.cosignersToSignerMapIKSV3
    );
  };

  public getDelayedTransactionModel = (): mongoose.Model<
    mongoose.Document,
    {}
  > => {
    return this.connection.model(
      "DelayedTransaction V3",
      this.delayedTransactionV3
    );
  };

  public getTransactionLogModel = (): mongoose.Model<mongoose.Document, {}> => {
    return this.connection.model("TransactionLog V3", this.transactionLogV3);
  };

  public getDelayedPolicyUpdateModel = (): mongoose.Model<
    mongoose.Document,
    {}
  > => {
    return this.connection.model(
      "DelayedPolicyUpdate V3",
      this.delayedPolicyUpdateSchema
    );
  };
}

export default new DatabaseV2();
