# Each template file defines ONE review template as plain data —
# no logic here, just content. This is what "don't hardcode prompts
# inside controllers" means in practice: the prompt content lives here,
# controllers/services never contain review-specific text.

SECURITY_TEMPLATE = {
    "name": "Security Review",
    "slug": "security",
    "description": "Finds security vulnerabilities: credentials, auth, injection, and unsafe data handling.",
    "focus_areas": [
        "hardcoded credentials",
        "authentication",
        "authorization",
        "input validation",
        "injection (SQL, command, XSS, etc.)",
        "sensitive information exposure",
    ],
    "system_prompt": (
        "You are an expert application security reviewer. You specialize in finding "
        "real, exploitable security issues in source code: hardcoded secrets, broken "
        "authentication or authorization logic, missing input validation, injection "
        "vulnerabilities, and exposure of sensitive information. You do not report "
        "stylistic concerns unless they have a direct security impact."
    ),
}