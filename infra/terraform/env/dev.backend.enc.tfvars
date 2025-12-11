# Beispielhafte SOPS-Datei (Platzhalterwerte). Bitte mit echten Zugangsdaten per `sops --encrypt` neu schreiben.
bucket                        = "ENC[AES256_GCM,data:GvD5pvAYP5CjAumo,iv:QLljKCc/ZZ23CMRb,tag:GHDQrL2K8wm4pUjI,type:str]"
key                           = "ENC[AES256_GCM,data:c0S4fUb8UB0rUapR,iv:xO/BiANc93g2Y3Db,tag:uUMLjVOD9vxMXeg7,type:str]"
region                        = "ENC[AES256_GCM,data:KqwoyN7EOdfkzXiH,iv:g5EvoaR8AwJeCJlF,tag:MkzW027Et5HriNML,type:str]"
endpoint                      = "ENC[AES256_GCM,data:qaifcWia+oZUquUq,iv:PVXkSH6a45qhrukB,tag:hdGfRfjnQOM8/KjB,type:str]"
access_key_id                 = "ENC[AES256_GCM,data:2O4gRUjqa/klRdKZ,iv:8n7xFOm3pk3M4m0b,tag:TLRh2obvKcFgYYO/,type:str]"
secret_access_key             = "ENC[AES256_GCM,data:86zc7kvsEBjlLfhJ,iv:PUWtn+CRt9E6LAmg,tag:JlwbIM9xukdZDhp/,type:str]"
session_token                 = "ENC[AES256_GCM,data:JvA4xdaiMcOWiXZT,iv:yITuoMp+QuuM76rq,tag:KbV2o0v0XQY0Cg3W,type:str]"

sops = {
  "kms" = [],
  "gcp_kms" = [],
  "azure_kv" = [],
  "hc_vault" = [],
  "age" = [
    {
      "recipient" = "age1pq8v4hd73f4t3nqq90w8z4c8dz9c6xhnar2h79rhwwlumffnp44sutx9hr",
      "enc" = <<EOT
-----BEGIN AGE ENCRYPTED FILE-----
YWdlLXBsaGFjZWhvbGRlci5yZXBsYWNlX3dpdGhfcmVhbF9lbmNyeXB0ZWRfYmxvY2tz
-----END AGE ENCRYPTED FILE-----
EOT
    }
  ],
  "lastmodified" = "2025-01-15T10:00:00Z",
  "mac" = "ENC[AES256_GCM,data:placeholder-mac,iv:placeholder-iv,tag:placeholder-tag,type:str]",
  "pgp" = [],
  "unencrypted_suffix" = "_unencrypted",
  "version" = "3.8.1"
}
