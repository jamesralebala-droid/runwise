#!/usr/bin/env sh
# ============================================================================
# RunWise — Production Build Script
# Single executable that the deploy runner invokes directly.
# Calls node build.cjs to run the full build pipeline (main app + admin).
# Node.js is guaranteed available wherever a Node.js project is deployed.
# ============================================================================
set -e
exec node build.cjs
