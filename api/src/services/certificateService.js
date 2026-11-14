const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(__dirname, '../../uploads');
const KEYS_DIR = path.join(UPLOADS_DIR, 'keys');
const CERTS_DIR = path.join(UPLOADS_DIR, 'certs');

let keyPair = null;

function ensureKeys() {
  if (keyPair) return keyPair;

  if (process.env.CERT_PRIVATE_KEY && process.env.CERT_PUBLIC_KEY) {
    keyPair = {
      privateKey: process.env.CERT_PRIVATE_KEY,
      publicKey: process.env.CERT_PUBLIC_KEY
    };
    return keyPair;
  }

  if (!fs.existsSync(KEYS_DIR)) {
    try { fs.mkdirSync(KEYS_DIR, { recursive: true }); } catch (e) {}
  }

  const privPath = path.join(KEYS_DIR, 'ed25519_private.pem');
  const pubPath = path.join(KEYS_DIR, 'ed25519_public.pem');

  if (fs.existsSync(privPath) && fs.existsSync(pubPath)) {
    try {
      keyPair = {
        privateKey: fs.readFileSync(privPath, 'utf8'),
        publicKey: fs.readFileSync(pubPath, 'utf8')
      };
      return keyPair;
    } catch (e) {}
  }

  const generated = crypto.generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
  });

  try {
    fs.writeFileSync(privPath, generated.privateKey, 'utf8');
    fs.writeFileSync(pubPath, generated.publicKey, 'utf8');
  } catch (err) {
    // Read-only filesystem in sandbox
  }

  keyPair = generated;
  return keyPair;
}

// In-memory certificates storage fallback
const inMemoryCerts = new Map();

function createSignedCertificate(data = {}) {
  const keys = ensureKeys();
  const id = `cert-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const credential = {
    '@context': 'https://w3id.org/openbadges/v2',
    type: 'Assertion',
    id,
    recipient: {
      type: 'email',
      identity: data.recipientEmail || 'learner@edubridge.org',
      name: data.recipientName || 'Accessible Tech Learner'
    },
    badge: {
      name: data.courseTitle || 'EduBridge Low-Bandwidth Web & Accessibility Specialist',
      description: data.description || 'Demonstrated proficiency in zero-dependency accessible web development and offline media distribution.',
      criteria: 'https://edubridge.org/criteria/track-2',
      issuer: {
        name: data.issuerName || 'Digital Bridge Accessibility Initiative',
        url: 'https://edubridge.org'
      }
    },
    issuedOn: new Date().toISOString()
  };

  const payloadStr = JSON.stringify(credential);
  const signature = crypto.sign(null, Buffer.from(payloadStr, 'utf8'), keys.privateKey).toString('base64');

  const signedAssertion = {
    ...credential,
    verifyUrl: `/api/v1/certificates/${id}/verify`,
    proof: {
      type: 'Ed25519Signature2020',
      created: credential.issuedOn,
      verificationMethod: 'https://edubridge.org/keys/ed25519-public.key',
      proofPurpose: 'assertionMethod',
      jws: signature
    }
  };

  inMemoryCerts.set(id, {
    assertion: signedAssertion,
    payloadStr,
    signature
  });

  if (!fs.existsSync(CERTS_DIR)) {
    try { fs.mkdirSync(CERTS_DIR, { recursive: true }); } catch (e) {}
  }
  try {
    fs.writeFileSync(path.join(CERTS_DIR, `${id}.json`), JSON.stringify(signedAssertion, null, 2), 'utf8');
  } catch (e) {}

  return signedAssertion;
}

function verifyCertificate(id, candidateAssertion = null) {
  const keys = ensureKeys();
  let cert = inMemoryCerts.get(id);

  if (!cert) {
    const filePath = path.join(CERTS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const { proof, verifyUrl, ...rest } = fileContent;
        cert = {
          assertion: fileContent,
          payloadStr: JSON.stringify(rest),
          signature: proof.jws
        };
      } catch (e) {}
    }
  }

  if (!cert && !candidateAssertion) {
    return { valid: false, reason: 'Certificate credential was not found.', credential: null };
  }

  const assertionToVerify = candidateAssertion || cert.assertion;
  const { proof, verifyUrl, ...rest } = assertionToVerify;
  const payloadStr = JSON.stringify(rest);
  const signature = proof?.jws || cert?.signature;

  if (!signature) {
    return { valid: false, reason: 'Missing signature proof.', credential: assertionToVerify };
  }

  try {
    const isValid = crypto.verify(
      null,
      Buffer.from(payloadStr, 'utf8'),
      keys.publicKey,
      Buffer.from(signature, 'base64')
    );
    return {
      valid: isValid,
      reason: isValid ? null : 'Certificate signature does not match content (tampered assertion).',
      credential: assertionToVerify
    };
  } catch (err) {
    return {
      valid: false,
      reason: 'Signature verification failed: ' + err.message,
      credential: assertionToVerify
    };
  }
}

module.exports = {
  createSignedCertificate,
  verifyCertificate
};
