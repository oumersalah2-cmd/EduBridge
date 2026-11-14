#!/usr/bin/env python3
"""
EduBridge faster-whisper Audio Transcription Worker
Takes a 16 kHz mono WAV file and outputs JSON segments:
[ {"start": 0.0, "end": 2.5, "text": "..."} ]
"""

import sys
import os
import json
import argparse

def main():
    parser = argparse.ArgumentParser(description="Transcribe audio file using faster-whisper")
    parser.add_argument("wav_path", help="Path to 16 kHz mono WAV audio file")
    parser.add_argument("--model", default=os.environ.get("WHISPER_MODEL", "base"), help="Whisper model name (base, small)")
    parser.add_argument("--language", default="en", help="Target transcription language (en, am)")
    parser.add_argument("--device", default="cpu", help="Device (cpu, cuda)")
    parser.add_argument("--compute_type", default="int8", help="Compute type (int8, float32)")
    args = parser.parse_args()

    if not os.path.exists(args.wav_path):
        sys.stderr.write(f"Error: WAV file not found at '{args.wav_path}'\n")
        sys.exit(1)

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.stderr.write("Error: 'faster-whisper' package is not installed in this Python environment.\n")
        sys.exit(2)

    cache_dir = os.environ.get("HF_HOME", os.path.expanduser("~/.cache/huggingface"))

    try:
        model = WhisperModel(
            args.model,
            device=args.device,
            compute_type=args.compute_type,
            download_root=cache_dir
        )

        segments, info = model.transcribe(
            args.wav_path,
            language=args.language,
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )

        results = []
        for segment in segments:
            results.append({
                "start": round(segment.start, 3),
                "end": round(segment.end, 3),
                "text": segment.text.strip()
            })

        output = {
            "segments": results,
            "detected_language": info.language,
            "duration": round(info.duration, 2)
        }

        print(json.dumps(output, ensure_ascii=False))

    except Exception as e:
        sys.stderr.write(f"Transcription error: {str(e)}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
