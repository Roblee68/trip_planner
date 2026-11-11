#!/bin/zsh
set -e

# Close an already running Android Studio before using this launcher.
# macOS Dock launches can omit Homebrew/Node paths needed by Expo autolinking.
PBB_PROJECT_DIR="$(cd -- "$(dirname -- "$0")/.." && pwd)"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if ! command -v node >/dev/null; then
  print -u2 'Node is required to open this Expo Android project.'
  exit 1
fi
if PBB_JAVA_HOME=$(/usr/libexec/java_home -v 21 2>/dev/null); then
  export JAVA_HOME="$PBB_JAVA_HOME"
  mkdir -p "$PBB_PROJECT_DIR/android/.gradle"
  print -r -- "java.home=$PBB_JAVA_HOME" > "$PBB_PROJECT_DIR/android/.gradle/config.properties"
fi
exec '/Applications/Android Studio.app/Contents/MacOS/studio' "$PBB_PROJECT_DIR/android"
