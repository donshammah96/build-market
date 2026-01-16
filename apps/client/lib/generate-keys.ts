import { randomBytes } from 'crypto';

interface keyConfig {
    byteLength: number;
    encoding: BufferEncoding;
    label: string;
}

/**
 * Generates a cryptographically secure key.
 * @param length - The number of bytes of entropy (Not the final string length)
 * @param encoding - The output encoding  ('hex', 'base64', 'base64url').
 * @returns - The generated key as a string
 */

const generateKey = (length: number  = 32, encoding: BufferEncoding = 'hex') : string => {
    // randomBytes provides cryptographically strong pseudo-random data
    return randomBytes(length).toString(encoding);
};

const configs: keyConfig[] = [
    {
        label: "JWT Secret (HS256)",
        byteLength: 32, // 256 bits
        encoding: 'base64url'
    },
    {
        label: "Secure API Key",
        byteLength: 48, // 256 bits
        encoding: 'hex'
    },
    {
        label: "Session Secret (High Entropy)",
        byteLength: 64, // 512 bits
        encoding: 'base64'
    }
]

configs.forEach((config) => {
    const key = generateKey(config.byteLength, config.encoding);
    console.log(`${config.label}`);
    console.log(`Length: ${config.byteLength} bytes (${config.byteLength * 8} bits)`);
    console.log(`Key: ${key}`);
    console.log('');
})