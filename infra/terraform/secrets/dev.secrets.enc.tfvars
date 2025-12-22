# Beispielhafte (nicht nutzbare) SOPS-Datei – Werte austauschen und per SOPS/age neu verschlüsseln.
fly_token             = "ENC[AES256_GCM,data:MIhAXGsifIdbyoK-,iv:EcCFxBT2Fi0hRClS,tag:yZ0UrQZwMg0ufab9,type:str]"
neon_api_key          = "ENC[AES256_GCM,data:CIQUW7kXLJQtmb0O,iv:DuT71ufnBkgreAf1,tag:YjjATUH7R4CgO3kV,type:str]"
upstash_api_key       = "ENC[AES256_GCM,data:YpjiETgt2Od-FAwy,iv:GkoKpq9lzCu430k-,tag:GM8P8wqm-Zn_yXyO,type:str]"
upstash_email         = "ENC[AES256_GCM,data:VPIVzVCJTdgFfZrY,iv:QSsiTTI6j6VM7HGr,tag:zTe6t3FsjotNWgn0,type:str]"
cloudflare_api_token  = "ENC[AES256_GCM,data:BoW92Yjm9TXzBPq0,iv:eloWATsqjZ-NHCJk,tag:tKYv3eyboMohS6cX,type:str]"
mail_provider         = "ENC[AES256_GCM,data:7iOT7eBbqM78JqMn,iv:Gf5wB_SzccGEnciT,tag:j95e1kX3BXjjN6WJ,type:str]"
mail_api_key          = "ENC[AES256_GCM,data:zhGYDSdz7k9NN9ed,iv:5AUNnTlDvmCKJQaS,tag:gJuweoP4XB2dPzkg,type:str]"
mail_from_name        = "ENC[AES256_GCM,data:Tkb1XGqcW0aYDUBB,iv:UlDnucHIK_l7kOA9,tag:JvQObuSTEyQloR_E,type:str]"
mail_from_address     = "ENC[AES256_GCM,data:FWzXmPKfJunp8RHo,iv:mdnQd_Gxss1xdGpe,tag:L_tdt9qpm4VvP0Cn,type:str]"
firebase_admin_salt   = "ENC[AES256_GCM,data:jandaLAyBqGHhXnv,iv:r02hovhofqLq48DU,tag:05lsAx5pbjHTPcgg,type:str]"

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
YWdlLXBsaGFjZWhvbGRlci1zYW1wbGUtc2Vzc2lvbi10ZXh0
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
