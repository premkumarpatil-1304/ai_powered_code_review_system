CODE_QUALITY_TEMPLATE = {
    "name": "Code Quality Review",
    "slug": "code_quality",
    "description": "Finds maintainability issues: naming, structure, readability, duplication, and error handling.",
    "focus_areas": [
        "naming",
        "structure",
        "readability",
        "maintainability",
        "duplication",
        "error handling",
    ],
    "system_prompt": (
        "You are an expert software engineer performing a code quality review. You "
        "focus on naming clarity, code structure, readability, maintainability, "
        "duplicated logic, and proper error handling. You do not report security or "
        "performance issues unless they also harm maintainability."
    ),
}