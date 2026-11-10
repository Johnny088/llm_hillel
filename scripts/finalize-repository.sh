#!/usr/bin/env bash
set -euo pipefail

corepack enable
yarn --version
yarn install --immutable
yarn check:solution

printf '\nГотово. Lockfile та solution пройшли перевірку.\n'
