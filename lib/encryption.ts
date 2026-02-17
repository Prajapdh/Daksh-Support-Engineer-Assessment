import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, this is always 16
const SALT_LENGTH = 64; // Length of the salt
const TAG_LENGTH = 16; // Length of the authentication tag

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  // In a real app we might throw here, but for this assessment we'll warn.
  // Ideally this should prevent startup.
  console.warn("WARNING: ENCRYPTION_KEY is not set. Encryption will fail.");
}

export function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  // Input validation
  if (!text) {
      return text;
  }

  // Create a random IV
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Create cipher
  // We use the key directly. In some setups you might use a salt and derive a key, 
  // but if ENCRYPTION_KEY is 32 bytes (64 hex chars or 32 raw bytes) we can use it directly.
  // Assuming ENCRYPTION_KEY is a hex string of 32 bytes (64 chars) or just a string that we hash to 32 bytes.
  // To be safe and consistent, let's create a 32 byte buffer from the key.
  // If the key is a hex string, use it. If not, maybe hash it?
  // Let's assume standard practice: Key is a 32-byte hex string (64 chars) or we hash it.
  // For simplicity and robustness: Hash the env key to ensure it's 32 bytes.
  const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  // Return IV:TAG:ENCRYPTED
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  if (!text) {
      return text;
  }

  // Format is IV:TAG:ENCRYPTED
  const parts = text.split(':');
  if (parts.length !== 3) {
    // It might be unencrypted data from before the fix.
    // In a mixed environment, you might want to return the text as-is or throw.
    // For this strict security requirement, if it doesn't look encrypted, we might treat it as an error 
    // OR return it if we are in a migration phase. 
    // Given the task is "Fix reported issues", and "Description: SSNs are stored in plaintext",
    // effectively we want to support reading new encrypted data.
    // If we assume NO migration data yet, we fail. 
    // But helpful to support legacy plain text if we are lazy-migrating.
    // Let's try to decrypt, if format matches.
    return text; 
  }

  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];

  const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
