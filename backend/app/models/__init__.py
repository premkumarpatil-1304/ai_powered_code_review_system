# This file's ONLY job: import every model so that when something does
# `from app import models`, all tables get registered on Base.metadata.
# Alembic's autogenerate literally cannot see a model that isn't imported
# somewhere in this chain — this is the most common Alembic gotcha.
from app.models.user import User
from app.models.project import Project
from app.models.file import File
from app.models.ai_provider import AIProvider
from app.models.review_template import ReviewTemplate
from app.models.review import Review
from app.models.chat import ChatSession, Message

__all__ = [
    "User", "Project", "File", "AIProvider",
    "ReviewTemplate", "Review", "ChatSession", "Message",
]