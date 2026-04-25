"""
Standalone test for the extraction service.

Usage (from repo root):
    # With Application Default Credentials (gcloud auth):
    python scripts/test_extraction.py

    # With a service account key file:
    GOOGLE_APPLICATION_CREDENTIALS=services/core-api/firebase-sa.json \
        python scripts/test_extraction.py

    # Override project/region if needed:
    PROJECT_ID=nectaid-dev REGION=asia-south1 python scripts/test_extraction.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Allow running from repo root without installing the package
sys.path.insert(0, str(Path(__file__).parent.parent / "services" / "core-api"))

from app.services.extraction import ExtractionError, extract_need

SAMPLE_TEXT = """\
Urgent situation in Kathlal village, Kheda district, Gujarat.
A family of 5 — two elderly parents and three children aged 4, 7, and 10 —
has been without food for two days after flooding destroyed their home.
The youngest child has a fever. They need immediate food supplies and a doctor.
Please send help as soon as possible.
"""


async def main() -> None:
    print("Running extraction on sample text...\n")
    print("Input:")
    print(SAMPLE_TEXT)
    print("-" * 60)

    try:
        result = await extract_need(SAMPLE_TEXT, images=[])
        print("Result:")
        print(result.model_dump_json(indent=2))
    except ExtractionError as exc:
        print(f"ExtractionError: {exc.reason}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
