import {
    CosignersMapUpdateAction,
    PermittedAction,
    VerificationType,
} from "../interfaces/signer";
import { z } from "zod";

// --- Helper Schemas ---
export const SingerVerificationSchema = z.object({
    method: z.nativeEnum(VerificationType),
    // verifier is handled server-side, not expected in input
});

export const SignerRestrictionSchema = z.object({
    none: z.boolean(),
    maxTransactionAmount: z.number().int().nonnegative().nullable(),
    timeWindow: z.number().int().nonnegative().nullable(),
});

export const SignerPolicySchema = z.object({
    verification: SingerVerificationSchema,
    restrictions: SignerRestrictionSchema,
    signingDelay: z.number().int().nonnegative().nullable(),
    // exceptions are deprecated/removed from new policy
    // secondaryVerification is added/removed via specific endpoints
});

export const VerificationOptionSchema = z.object({
    id: z.string().min(1),
    method: z.nativeEnum(VerificationType),
    label: z.string().optional(),
    permittedActions: z.array(z.nativeEnum(PermittedAction)).min(1),
    // verifier is handled server-side, exclude server-generated field
});

export const CosignersMapUpdateSchema = z.object({
    cosignersId: z.string().min(1),
    signerId: z.string().min(1),
    action: z.nativeEnum(CosignersMapUpdateAction),
});

export const ChangeSchema = z.object({
    address: z.string().min(1).optional(),
    index: z.number().int().nonnegative().optional(),
}).nullable(); // Allow null for transactions without change

export const signerIdentifierSchema = z.string().min(1);
export const verificationTokenSchema = z.union([
    z.string().length(6),
    z.number().int().nonnegative().refine((num) => num.toString().length === 6, {
        message: "VerificationToken must be of length 6",
    }),
]);

// --- Route Schemas ---

// export const setupSignerSchema = z.object({
//   body: z.object({
//     policy: SignerPolicySchema.omit({ signingDelay: true, restrictions: true }).extend({ // Initial setup might have different requirements
//         verification: SingerVerificationSchema,
//         restrictions: SignerRestrictionSchema.pick({ maxTransactionAmount: true }).extend({ // Only max amount initially? Adjust as needed.
//             none: z.boolean().optional(), // Keep if applicable
//             timeWindow: z.null().default(null) // Default timeWindow to null on setup?
//         }),
//     }),
//   }),
// });

export const setupSignerSchema = z.object({
    body: z.object({
        policy: SignerPolicySchema,
    }),
});

export const validateSignerSetupSchema = z.object({
    body: z.object({
        id: signerIdentifierSchema,
        verificationToken: verificationTokenSchema,
    }),
});

export const addSecondaryVerificationOptionSchema = z.object({
    body: z.object({
        id: signerIdentifierSchema,
        verificationToken: verificationTokenSchema,
        newOption: VerificationOptionSchema
    }),
});

export const removeSecondaryVerificationOptionSchema = z.object({
    body: z.object({
        id: signerIdentifierSchema,
        verificationToken: verificationTokenSchema,
        optionId: z.string().min(1),
    }),
});

export const fetchSignerSetupSchema = z.object({
    body: z.object({
        id: signerIdentifierSchema,
        verificationToken: verificationTokenSchema,
    }),
});

export const fetchSignerSetupViaCosignersSchema = z.object({
    body: z.object({
        cosignersId: z.string().min(1),
        verificationToken: verificationTokenSchema,
    }),
});

export const updateBackupSettingSchema = z.object({
    body: z.object({
        id: signerIdentifierSchema,
        verifierDigest: z.string().min(1),
        disable: z.boolean(),
    }),
});

export const fetchBackupSchema = z.object({
    body: z.object({
        id: signerIdentifierSchema,
        verificationToken: verificationTokenSchema,
        publicKey: z.string().min(1),
    }),
});

export const checkSignerHealthSchema = z.object({
    body: z.object({
        id: signerIdentifierSchema,
        verificationToken: verificationTokenSchema,
    }),
});

export const updateSignerPolicySchema = z.object({
    body: z.object({
        id: signerIdentifierSchema,
        verificationToken: verificationTokenSchema,
        updates: z.object({
            restrictions: SignerRestrictionSchema,
            signingDelay: z.number().int().nonnegative().nullable(),
        }),
        FCM: z.string().optional(),
    }),
});

export const updateCosignersToSignerMapSchema = z.object({
    body: z.object({
        id: signerIdentifierSchema.optional(),
        cosignersMapUpdates: z.array(CosignersMapUpdateSchema).min(1),
    }),
});

export const signTransactionSchema = z.object({
    body: z.object({
        id: signerIdentifierSchema,
        serializedPSBT: z.string().min(1), // can add base64 validation if needed
        verificationToken: verificationTokenSchema,
        change: ChangeSchema.optional(), // optional because it can be null/undefined for transaction with no change
        descriptor: z.string().min(1),
        FCM: z.string().optional(),
    }),
});

export const cancelDelayedTransactionSchema = z.object({
    body: z.object({
        signerId: signerIdentifierSchema,
        txid: z.string().min(1), // can add specific format validation if needed (e.g., hex length)
        verificationToken: verificationTokenSchema,
    }),
});

export const fetchSignedDelayedTransactionSchema = z.object({
    body: z.object({
        txid: z.string().min(1),
        verificationToken: verificationTokenSchema,
    }),
});

export const fetchDelayedPolicyUpdateSchema = z.object({
    body: z.object({
        policyId: z.string().min(1),
        verificationToken: verificationTokenSchema,
    }),
});

export const migrateSignerPolicySchema = z.object({
    body: z.object({
        id: signerIdentifierSchema,
        oldPolicy: z.any(),
    }),
});

export const migrateSignersV2ToV3Schema = z.object({
    body: z
        .object({
            vaultId: z.string().min(1).optional(),
            appId: z.string().min(1).optional(),
            cosignersMapUpdates: z.array(CosignersMapUpdateSchema).min(1),
        })
});

export const enrichCosignersToSignerMapSchema = z.object({
    body: z.object({
        id: signerIdentifierSchema,
        cosignersMapUpdates: z.array(CosignersMapUpdateSchema).min(1),
    }),
});

