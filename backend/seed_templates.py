"""
Run this once after migrations to populate the review_templates table.
Safe to re-run — it upserts by slug instead of duplicating rows.

Usage:
    python -m app.seed_templates
"""
from app.database import SessionLocal
from app.models.review_template import ReviewTemplate
from app.ai.templates import TEMPLATE_REGISTRY


def run():
    db = SessionLocal()
    try:
        for slug, data in TEMPLATE_REGISTRY.items():
            existing = db.query(ReviewTemplate).filter(ReviewTemplate.slug == slug).first()
            if existing:
                # Update in place in case the prompt text changed since last seed
                existing.name = data["name"]
                existing.description = data["description"]
                existing.system_prompt = data["system_prompt"]
                existing.focus_areas = data["focus_areas"]
            else:
                db.add(ReviewTemplate(
                    name=data["name"],
                    slug=slug,
                    description=data["description"],
                    system_prompt=data["system_prompt"],
                    focus_areas=data["focus_areas"],
                ))
        db.commit()
        print(f"Seeded {len(TEMPLATE_REGISTRY)} review templates.")
    finally:
        db.close()


if __name__ == "__main__":
    run()