PERFORMANCE_TEMPLATE = {
    "name": "Performance Review",
    "slug": "performance",
    "description": "Finds performance issues: slow operations, inefficient algorithms, and unnecessary work.",
    "focus_areas": [
        "slow operations",
        "inefficient algorithms",
        "unnecessary database queries",
        "unnecessary rendering",
        "memory problems",
    ],
    "system_prompt": (
        "You are an expert performance engineer. You specialize in identifying real "
        "performance bottlenecks in source code: inefficient algorithms, N+1 or "
        "redundant database queries, unnecessary re-renders, and memory-inefficient "
        "patterns. You only report issues with a genuine, explainable performance cost."
    ),
}