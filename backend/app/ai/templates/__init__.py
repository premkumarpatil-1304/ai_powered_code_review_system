from app.ai.templates.security import SECURITY_TEMPLATE
from app.ai.templates.performance import PERFORMANCE_TEMPLATE
from app.ai.templates.code_quality import CODE_QUALITY_TEMPLATE

# Single registry every part of the app reads from — adding a 4th template
# later means adding one dict + one line here, nothing else changes.
TEMPLATE_REGISTRY = {
    "security": SECURITY_TEMPLATE,
    "performance": PERFORMANCE_TEMPLATE,
    "code_quality": CODE_QUALITY_TEMPLATE,
}