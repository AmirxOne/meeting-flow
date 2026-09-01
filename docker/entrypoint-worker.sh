#!/bin/sh
set -e
exec ./node_modules/.bin/tsx src/worker/index.ts
