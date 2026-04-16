// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026 100monkeys.ai
import { ed25519 } from "@noble/curves/ed25519.js";

/**
 * Manages ephemeral Ed25519 cryptographic keys for the SEAL protocol.
 * Keys are generated dynamically and stored only in memory per execution
 * for high security according to the SEAL spec.
 */
export class Ed25519Key {
  private privateKey: Uint8Array | null = null;
  private publicKey: Uint8Array | null = null;

  private constructor() {}

  /**
   * Generate a new ephemeral Ed25519 keypair.
   */
  public static generate(): Ed25519Key {
    const key = new Ed25519Key();
    key.privateKey = ed25519.utils.randomSecretKey();
    key.publicKey = ed25519.getPublicKey(key.privateKey);
    return key;
  }

  /**
   * Produce an Ed25519 signature of the given canonical message bytes.
   */
  public sign(message: Uint8Array): Uint8Array {
    if (!this.privateKey) {
      throw new Error("Private key has been erased or is not initialized.");
    }
    return ed25519.sign(message, this.privateKey);
  }

  /**
   * Produce a base64-encoded Ed25519 signature.
   */
  public signBase64(message: Uint8Array): string {
    return Buffer.from(this.sign(message)).toString("base64");
  }

  /**
   * Return the public key in raw 32-byte format.
   */
  public getPublicKeyBytes(): Uint8Array {
    if (!this.publicKey) {
      throw new Error("Public key has been erased or is not initialized.");
    }
    return this.publicKey;
  }

  /**
   * Return the public key encoded in base64.
   */
  public getPublicKeyBase64(): string {
    return Buffer.from(this.getPublicKeyBytes()).toString("base64");
  }

  /**
   * Zero out key bytes in memory.
   */
  public erase(): void {
    if (this.privateKey) {
      this.privateKey.fill(0);
      this.privateKey = null;
    }
    if (this.publicKey) {
      this.publicKey.fill(0);
      this.publicKey = null;
    }
  }
}
