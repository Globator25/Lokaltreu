# Basis-Image: Ubuntu mit Devcontainer-Kompatibilität
FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Installiere Terraform
RUN curl -fsSL https://apt.releases.hashicorp.com/gpg | gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
  | tee /etc/apt/sources.list.d/hashicorp.list \
  && apt-get update && apt-get install -y terraform

# Installiere Node.js (für Prettier, Markdownlint etc.)
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
  && apt-get install -y nodejs

# Installiere Prettier und Markdownlint global
RUN npm install -g prettier markdownlint-cli

# Installiere Shellcheck für Shell-Linting
RUN apt-get install -y shellcheck

# Optional: PowerShell (falls du es im Container brauchst)
RUN apt-get install -y wget apt-transport-https software-properties-common \
  && wget -q https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb \
  && dpkg -i packages-microsoft-prod.deb \
  && apt-get update \
  && apt-get install -y powershell

# Setze den Standardbenutzer
USER vscode
