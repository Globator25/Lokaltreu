declare module "libsodium-wrappers" {
  type SodiumKeyPair = {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  };

  type Sodium = {
    ready: Promise<void>;
    base64_variants: {
      ORIGINAL: number;
    };
    from_base64: (input: string, variant: number) => Uint8Array;
    from_string: (input: string) => Uint8Array;
    to_base64: (input: Uint8Array, variant: number) => string;
    crypto_sign_keypair: () => SodiumKeyPair;
    crypto_sign_detached: (message: Uint8Array, privateKey: Uint8Array) => Uint8Array;
    crypto_sign_verify_detached: (
      signature: Uint8Array,
      message: Uint8Array,
      publicKey: Uint8Array,
    ) => boolean;
  };

  const sodium: Sodium;
  export default sodium;
}

declare module "libsodium-wrappers/dist/modules/libsodium-wrappers.js" {
  type SodiumKeyPair = {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  };

  type Sodium = {
    ready: Promise<void>;
    base64_variants: {
      ORIGINAL: number;
    };
    from_base64: (input: string, variant: number) => Uint8Array;
    from_string: (input: string) => Uint8Array;
    to_base64: (input: Uint8Array, variant: number) => string;
    crypto_sign_keypair: () => SodiumKeyPair;
    crypto_sign_detached: (message: Uint8Array, privateKey: Uint8Array) => Uint8Array;
    crypto_sign_verify_detached: (
      signature: Uint8Array,
      message: Uint8Array,
      publicKey: Uint8Array,
    ) => boolean;
  };

  const sodium: Sodium;
  export default sodium;
}
