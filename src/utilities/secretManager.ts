import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import config from '../config';

export const fetchSecrets = async (secretIdentifiers: string[], shouldParse: Boolean = false) => {
  const client = new SecretManagerServiceClient();
  const projectId = config.PROJECT_ID; 

  const secretsPromises = secretIdentifiers.map(async (identifier) => {
    const [version] = await client.accessSecretVersion({
      name: `projects/${projectId}/secrets/${identifier}/versions/latest`,
    });
    const payload = version.payload.data.toString();
    return { [identifier]: shouldParse? JSON.parse(payload): payload };
  });
  
  const secrets = await Promise.all(secretsPromises);
  return secrets;
}

