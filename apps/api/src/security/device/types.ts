// DeviceProof repräsentiert den Nachweis, dass die Anfrage von einem bekannten Gerät kommt.
// Ed25519-Signatur über Request-spezifische Daten.
// Header-Name später: "X-Device-Proof".
export interface DeviceProof {
  deviceId: string;   // stabile pseudonyme Geräte-ID
  publicKey: string;  // Ed25519 Public Key (Base64)
  signature: string;  // Signatur (Base64) über Nonce+Method+Path+Body-Hash
  nonce: string;      // Einmalwert zum Schutz vor Replay
}
