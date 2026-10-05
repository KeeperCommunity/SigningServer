import crypto from "crypto";
import { authenticator } from 'otplib';

export default class TwoFactorAuthentication {
  constructor() {
    authenticator.options = { crypto, window: 1 }; // window 1: handles time-skew, of up to 30 seconds, between the server and the client
  }

  public generator = (): {
    secret: string;
  } => {
    return {
      secret: authenticator.generateSecret(), // base 32 encoded hex secret key
    };
  };

  public validator = (secret: string, token: string): boolean => {
    if(typeof token === 'number') token = (token as Number).toString(); // otplib v12.0 and above requires token to be a string(no implicit type casting)
    return authenticator.verify({ secret, token });
  }
}
