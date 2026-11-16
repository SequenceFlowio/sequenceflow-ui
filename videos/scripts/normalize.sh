#!/bin/sh
# Zet het geluid van alle video's in out/ op social-niveau (-14 LUFS), beeld blijft onaangeroerd.
set -e
cd "$(dirname "$0")/../out"
for f in *.mp4; do
  case "$f" in *.tmp.mp4) continue;; esac
  ffmpeg -y -loglevel error -i "$f" -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k "${f%.mp4}.tmp.mp4"
  mv "${f%.mp4}.tmp.mp4" "$f"
done
