#!/usr/bin/env bash
# Regenerates the Arabic page from the English one.
#
#   bash i18n/build-ar.sh
#
# Never edit site/ar/index.html directly — it is overwritten every run.
# To change Arabic wording, edit i18n/ar.tsv. To change anything structural
# (a new section, a new field), edit site/index.html and then run this.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
perl "$root/i18n/build-ar.pl" "$root"
