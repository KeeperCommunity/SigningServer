
## How a spend actually works

**The Hardware never talks to the server. It has no networking - no WiFi, no Bluetooth, nothing
that reaches the internet.** It only ever talks to whatever taps it: your phone over NFC, or a
card reader plugged into a computer. Every "HARDWARE + SERVER" spend is really two separate,
disconnected steps stitched together by a PSBT file that your wallet app carries between them -
never a live connection between the card and this service.

The server never signs the moment you ask, either way. It queues, it tells you, it waits, and
only then does it sign - so a signature is never the first you hear about a transaction.

```mermaid
sequenceDiagram
    participant SC as Your Hardware
    participant You as Your wallet app
    participant CS as Cosigner
    participant Node as Your bitcoind
    participant N as Notification

    Note over SC,You: Tap to phone / card reader - purely local, no network
    SC->>You: Partial signature (HARDWARE's share)
    You->>CS: POST /sign_psbt (HARDWARE's signature already attached)
    CS->>Node: Are these coins real? Whose are they?
    Node-->>CS: UTXO details
    Note over CS: Re-derives every address itself.<br/>Never trusts what the PSBT claims.
    CS->>CS: Check against policy
    alt Over your limits
        CS-->>You: 422 denied — nothing queued, nothing signed
    else Allowed
        CS->>N: "Pending spend: 50,000 sat to bc1q… — signs in 15 min"
        CS-->>You: 202 Accepted + id
        Note over CS: Holding. You can POST /veto/{id}
        alt You veto
            CS->>CS: Cancelled permanently
        else Hold elapses
            CS->>CS: Re-check policy against live state
            CS->>CS: Add the SERVER signature
            CS-->>You: PSBT with both signatures — 2 of 3, spendable
        end
    end
    Note over You: You broadcast. The server never does.<br/>Notice the Hardware only ever appears in the top line.
```

The cosigner never talks to the Hardware either — as far as this service is concerned, "HARDWARE
signed" just means *a PSBT arrived with a valid signature under HARDWARE's key already in it*. It
has no way to reach the card, ask it to sign, or know it exists except through that signature.
Your wallet app (Bitcoin Keeper, or Sparrow with a card reader) is the only thing that talks to
both sides — locally to the Hardware, over the network to the cosigner — and a PSBT file is the
only thing that ever crosses between them.

