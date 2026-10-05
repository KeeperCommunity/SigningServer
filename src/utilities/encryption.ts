import crypto from "crypto";
import config from "../config";
import NodeRSA from 'node-rsa';

export const hash256 = (data) => {
  const hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

export const asymmetricDecrypt = (encryptedData: string, privateRSAKey: string =  config.RSA_PRV_KEY) => {
  const key = new NodeRSA(privateRSAKey);
  return key.decrypt(encryptedData, 'utf8');
};

export const asymmetricEncrypt = (data: string, publicRSAKey: string = config.RSA_PUB_KEY): string => {
  const key = new NodeRSA(publicRSAKey);
  return key.encrypt(data, 'base64');
};

export const generateRSAKeyPair = (keySize: number = 2048) => {
  const key = new NodeRSA({ b: keySize });
  return {
    publicKey: key.exportKey('public'),
    privateKey: key.exportKey('private'),
  };
};

