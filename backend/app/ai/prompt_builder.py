def build_review_prompt(
    project_name: str,
    template_system_prompt: str,
    template_name: str,
    focus_areas: list[str],
    context_files: list[dict],
) -> tuple[str, str]:
    """
    Builds the SYSTEM and USER prompt text sent to the LLM, following the
    exact structure specified: SYSTEM / REVIEW MODE / FOCUS AREAS / PROJECT
    / FILES / TASK / RULES.

    Returns (system_message, user_message) — kept as two separate strings
    since chat-completion APIs expect a system role and a user role.
    """
    focus_list = "\n".join(f"- {area}" for area in focus_areas)

    files_block = "\n\n".join(
        f"### FILE: {f['path']}\n```\n{f['content']}\n```"
        for f in context_files
    )

    if not files_block:
        files_block = "(no readable files were provided)"

    system_message = (
        f"{template_system_prompt}\n\n"
        "You must respond with VALID JSON ONLY, matching exactly this shape:\n"
        '{\n'
        '  "summary": "string",\n'
        '  "issues": [\n'
        '    {\n'
        '      "title": "string",\n'
        '      "severity": "critical|high|medium|low",\n'
        '      "file_path": "string",\n'
        '      "line_start": 10,\n'
        '      "line_end": 15,\n'
        '      "description": "string",\n'
        '      "recommendation": "string"\n'
        '    }\n'
        '  ],\n'
        '  "recommendations": ["string"]\n'
        '}\n'
        "Do not include markdown code fences, explanations, or any text outside this JSON object."
    )

    user_message = (
        f"REVIEW MODE:\n{template_name}\n\n"
        f"FOCUS AREAS:\n{focus_list}\n\n"
        f"PROJECT:\n{project_name}\n\n"
        f"FILES:\n{files_block}\n\n"
        "TASK:\n"
        "Review the supplied code.\n\n"
        "RULES:\n"
        "- Only report issues supported by the supplied code.\n"
        "- Do not invent files or vulnerabilities.\n"
        "- Give exact file paths as shown above.\n"
        "- Give line numbers when possible.\n"
        "- Assign a severity to every issue.\n"
        "- Return valid JSON only, no other text."
    )

    return system_message, user_message