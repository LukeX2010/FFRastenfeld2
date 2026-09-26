#!/usr/bin/env bash
set -euo pipefail
if ! command -v dotnet >/dev/null 2>&1; then
  curl --fail --silent --show-error --location https://dot.net/v1/dotnet-install.sh -o /tmp/ffr-dotnet-install.sh
  bash /tmp/ffr-dotnet-install.sh --channel 8.0 --install-dir /tmp/ffr-dotnet
  export PATH="/tmp/ffr-dotnet:$PATH"
fi
dotnet publish FFRastenfeld.csproj -c Release -o .publish
