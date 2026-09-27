import uuid
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.review import Review
from app.repositories import review_repo, review_template_repo, provider_repo
from app.services import project_service
from app.ai import context_builder, prompt_builder, response_parser
from app.ai.factory import AIProviderFactory
from app.ai.base import ChatMessage
from app.schemas.reviews import ReviewCreate, ReviewScope


def get_templates(db: Session):
    return review_template_repo.list_all(db)


def create_review(db: Session, user_id: uuid.UUID, project_id: uuid.UUID, payload: ReviewCreate) -> Review:
    # 1. Ownership checks — project must belong to the user, provider must too
    project = project_service.get_project_or_404(db, user_id, project_id)

    template = review_template_repo.get_by_slug(db, payload.template_slug)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No review template found for slug '{payload.template_slug}'.",
        )

    provider_row = provider_repo.get_for_user(db, user_id, payload.provider_id)
    if provider_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI provider not found.",
        )

    if payload.scope in (ReviewScope.FILE, ReviewScope.FILES) and not payload.file_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="file_ids is required when scope is 'file' or 'files'.",
        )

    # 2. ContextBuilder — gather the actual source code to review
    if payload.scope == ReviewScope.PROJECT:
        context_files = context_builder.build_context_for_project(db, project.id)
    else:
        context_files = context_builder.build_context_for_files(db, payload.file_ids)

    if not context_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No readable file content was found for the given scope.",
        )

    # 3. PromptBuilder — turn template + context into the actual prompt text
    system_message, user_message = prompt_builder.build_review_prompt(
        project_name=project.name,
        template_system_prompt=template.system_prompt,
        template_name=template.name,
        focus_areas=template.focus_areas,
        context_files=context_files,
    )

    # Create the review row up front as 'pending' so it's visible in
    # history even if the LLM call fails partway through.
    review = Review(
        project_id=project.id,
        template_id=template.id,
        provider_id=provider_row.id,
        scope=payload.scope.value,
        target_file_ids=[str(fid) for fid in payload.file_ids],
        status="pending",
    )
    review = review_repo.create(db, review)

    # 4. AIProviderFactory -> LLM call
    try:
        client = AIProviderFactory.create(provider_row)
        result = client.chat_completion(
            messages=[
                ChatMessage(role="system", content=system_message),
                ChatMessage(role="user", content=user_message),
            ],
            temperature=0.2,
            max_tokens=4000,
        )
    except RuntimeError as e:
        review.status = "failed"
        review.error_message = str(e)
        return review_repo.update(db, review)

    # 5. ResponseParser -> validate structured JSON
    try:
        parsed = response_parser.parse_review_response(result.content)
    except response_parser.ReviewParseError as e:
        review.status = "failed"
        review.error_message = str(e)
        return review_repo.update(db, review)

    # 6. ReviewRepository -> persist final structured result
    review.status = "completed"
    review.summary = parsed.summary
    review.issues = [issue.model_dump() for issue in parsed.issues]
    review.recommendations = parsed.recommendations
    return review_repo.update(db, review)


def list_reviews(
    db: Session,
    user_id: uuid.UUID,
    project_id: uuid.UUID,
    status_filter: str | None,
    template_slug: str | None,
    search_query: str | None,
) -> list[Review]:
    project_service.get_project_or_404(db, user_id, project_id)  # ownership check
    return review_repo.list_for_project(db, project_id, status_filter, template_slug, search_query)


def get_review_or_404(db: Session, user_id: uuid.UUID, review_id: uuid.UUID) -> Review:
    review = review_repo.get_by_id_for_project_owner(db, user_id, review_id)
    if review is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found.",
        )
    return review