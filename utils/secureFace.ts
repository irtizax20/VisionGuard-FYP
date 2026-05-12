// Encryption utilities are temporarily disabled in this project.
// These stubs allow the codebase to compile without bringing in native crypto.

export const encryptFaceForUser = async (plainText: string, _uid: string): Promise<string> => {
  return plainText; // no-op
};

export const decryptFaceForUser = async (cipherText: string, _uid: string): Promise<string> => {
  return cipherText; // no-op
};

