import json
import re

from pydantic import ValidationError
from app.schemas.reviews import ReviewResultPayload


class ReviewParseError(Exception):
    pass


def _strip_code_fences(text: str) -> str:
    # Some models wrap JSON in ```json ... ``` even when told not to —
    # strip that defensively rather than failing the whole review.
    text = text.strip()
    match = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, flags=re.DOTALL)
    if match:
        return match.group(1)
    return text


def parse_review_response(raw_text: str) -> ReviewResultPayload:
    """
    Takes the LLM's raw text output and validates it against
    ReviewResultPayload (Pydantic). Raises ReviewParseError with a clear
    message if the model returned something unusable — the caller decides
    what to do with that (e.g. mark the review as 'failed').
    """
    cleaned = _strip_code_fences(raw_text)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ReviewParseError(f"AI response was not valid JSON: {e}")

    try:
        return ReviewResultPayload.model_validate(data)
    except ValidationError as e:
        raise ReviewParseError(f"AI response JSON did not match expected shape: {e}")