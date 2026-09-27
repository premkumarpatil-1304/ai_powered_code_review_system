# AI Usage Documentation

## AI-Powered Code Review Assistant

This document describes how AI tools were used during the development of
this project, what responsibilities remained with me as the developer,
and the engineering decisions I made while building and integrating the
application.

AI was used as a development aid and pair-programming resource
throughout the project. I remained responsible for deciding the
architecture, selecting the technologies, integrating the generated
code, testing the application, debugging issues, and making the final
implementation decisions.

------------------------------------------------------------------------

## 1. AI Tools Used

  -----------------------------------------------------------------------
  Tool                                How I Used It
  ----------------------------------- -----------------------------------
  **ChatGPT (OpenAI)**                Architecture planning, requirement
                                      breakdown, AI-provider design,
                                      implementation guidance, debugging,
                                      prompt creation, and reasoning
                                      through engineering decisions

  **Claude (Anthropic)**              Primary backend development
                                      assistance, FastAPI architecture,
                                      SQLAlchemy/PostgreSQL
                                      implementation, API design,
                                      authentication, file processing, AI
                                      provider abstraction, and review
                                      engine

  **Manus AI**                        Frontend implementation using
                                      Next.js, TypeScript, and Tailwind
                                      CSS based on the backend/API
                                      contract and UI requirements

  **Trae**                            Connecting the frontend and
                                      backend, debugging integration
                                      issues, fixing runtime/API issues,
                                      and refining the final working
                                      application
  -----------------------------------------------------------------------

The tools were used at different stages rather than relying on a single
AI system to generate the complete application.

------------------------------------------------------------------------

# 2. My Role in the Development

AI tools generated suggestions and implementation drafts, but the
project was developed through an iterative process in which I made the
final technical decisions and integrated the different parts.

My responsibilities included:

-   Understanding the assessment requirements.
-   Choosing **FastAPI + PostgreSQL** for the backend.
-   Choosing **Next.js + TypeScript + Tailwind CSS** for the frontend.
-   Defining the overall modular-monolith architecture.
-   Deciding how projects, files, reviews, providers, and chat sessions
    should relate to each other.
-   Deciding that the AI layer should use a generic **OpenAI-compatible
    provider abstraction** rather than being coupled to one vendor.
-   Reviewing and integrating AI-generated code.
-   Running the backend and frontend locally.
-   Testing API endpoints through Swagger/curl and the application UI.
-   Debugging integration issues.
-   Testing file upload and project/file relationships.
-   Testing the AI provider configuration.
-   Fixing issues discovered during integration.
-   Making trade-offs based on the two-day assessment timeline.
-   Preparing the final documentation and project structure.

The AI tools were therefore used as development assistants rather than
as an autonomous replacement for the development process.

------------------------------------------------------------------------

# 3. How ChatGPT Was Used

ChatGPT was mainly used for architecture, planning, reasoning, and
debugging support.

### Architecture and planning

I used ChatGPT to break the assessment into implementable parts and
decide how to structure:

-   FastAPI backend
-   PostgreSQL database
-   Next.js frontend
-   Authentication
-   Project management
-   ZIP upload
-   Code Explorer
-   AI Review Engine
-   Review Templates
-   AI Provider configuration
-   Review History
-   AI Chat

A major architectural discussion was how to support multiple AI
providers without writing a separate review implementation for every
vendor.

The resulting design was:

``` text
Review Engine
      |
      v
AI Provider Factory
      |
      v
OpenAI-Compatible Provider
      |
      +---- OpenAI
      +---- LM Studio
      +---- OpenRouter
      +---- Other compatible endpoints
```

This allowed the review engine to remain independent from the selected
AI provider.

### Debugging and problem solving

ChatGPT was also used to reason through issues encountered during
development, including:

-   AI provider configuration
-   OpenAI-compatible API behavior
-   LM Studio integration
-   FastAPI architecture
-   PostgreSQL configuration
-   API contracts
-   frontend/backend integration
-   structured AI responses

For example, when the application initially attempted to use the OpenAI
API and returned a `401 invalid_api_key` response, ChatGPT helped
identify that the architecture could be reused with a local
OpenAI-compatible provider such as LM Studio instead of requiring a paid
OpenAI API.

### Prompt and documentation assistance

ChatGPT was also used to create development prompts for Claude and Trae
and to help structure documentation such as:

-   `README.md`
-   `ARCHITECTURE.md`
-   `AI_Usage.md`

The final project decisions and implementation were still reviewed and
integrated by me.

------------------------------------------------------------------------

# 4. How Claude Was Used

Claude was the primary AI development assistant for the backend.

The backend was developed incrementally rather than asking Claude to
generate the complete application in one step.

## Phase 1 --- Architecture, Database and Authentication

Claude was used to help implement:

-   FastAPI project structure
-   SQLAlchemy models
-   PostgreSQL integration
-   Alembic migrations
-   User model
-   Registration
-   Login
-   JWT authentication
-   Protected routes
-   Password hashing

Before implementation, the architecture and database relationships were
discussed so that the generated code followed a consistent structure.

------------------------------------------------------------------------

## Phase 2 --- Projects and ZIP Upload

Claude assisted with:

-   Project CRUD
-   Project/file relationships
-   ZIP upload handling
-   ZIP extraction
-   File metadata storage
-   File filtering
-   Binary file detection
-   Security checks for uploaded archives

One important security consideration was ZIP path traversal / ZIP Slip.

The extraction process was designed to ensure that paths such as:

``` text
../../../../tmp/pwned.txt
```

could not escape the project's intended storage directory.

This was not treated as a feature that should simply exist in the code;
it was tested as part of the implementation.

------------------------------------------------------------------------

## Phase 3 --- Code Explorer

Claude helped implement the backend support for:

-   File listing
-   File metadata
-   Folder hierarchy
-   Parent/child file relationships
-   File content preview
-   Language/file-extension handling

The backend stores file metadata in PostgreSQL while the actual uploaded
project files are handled through the project's file storage mechanism.

------------------------------------------------------------------------

## Phase 4 --- Configurable AI Providers

One of the most important backend design decisions was the AI provider
abstraction.

Instead of implementing:

``` text
OpenAIReviewService
LMStudioReviewService
OpenRouterReviewService
OllamaReviewService
```

the project uses a generic OpenAI-compatible provider approach.

The design is approximately:

``` text
AI Provider
     |
     v
Provider Factory
     |
     v
OpenAI-Compatible Provider
     |
     +---- Base URL
     +---- API Key
     +---- Model Name
```

This means the review engine does not need to know which vendor is being
used.

Claude assisted with:

-   AI provider models
-   Provider configuration
-   Provider factory
-   OpenAI-compatible client
-   API endpoints
-   API key handling
-   Provider testing
-   Model configuration
-   Integration with the review engine

This design also makes it possible to use local models through LM Studio
without changing the core review logic.

------------------------------------------------------------------------

# 5. AI Review Engine

Claude assisted with implementing the review pipeline:

``` text
Review Request
      |
      v
Review Service
      |
      v
Context Builder
      |
      v
Review Template
      |
      v
Prompt Builder
      |
      v
AI Provider Factory
      |
      v
OpenAI-Compatible Provider
      |
      v
AI Model
      |
      v
Response Parser
      |
      v
Validated Review
      |
      v
PostgreSQL
```

The review engine supports:

-   Single-file review
-   Multiple-file review
-   Project-level review
-   Security review
-   Performance review
-   Code quality review
-   Structured issues
-   Severity levels
-   Recommendations
-   Review history

Pydantic validation is used to keep the AI output structured rather than
treating the model response as unrestricted text.

------------------------------------------------------------------------

# 6. Review Templates

The review modes were designed as reusable templates rather than placing
large prompts directly inside API controllers.

The implemented review modes include:

### Security Review

Focus areas include:

-   Hardcoded credentials
-   Authentication
-   Authorization
-   Input validation
-   Injection risks
-   Sensitive information

### Performance Review

Focus areas include:

-   Slow operations
-   Inefficient algorithms
-   Unnecessary database queries
-   Inefficient rendering
-   Resource usage

### Code Quality Review

Focus areas include:

-   Naming
-   Structure
-   Readability
-   Maintainability
-   Duplication
-   Error handling

This makes the review engine reusable for additional review modes later.

------------------------------------------------------------------------

# 7. How Manus AI Was Used

Manus AI was used primarily for the frontend implementation.

Once the backend API structure and expected data flow were established,
the frontend requirements were provided to Manus.

Manus assisted with building the:

-   Next.js application structure
-   TypeScript components
-   Tailwind CSS styling
-   Dashboard
-   Authentication pages
-   Project pages
-   Code Explorer
-   File tree
-   Code viewer
-   Review interface
-   Provider configuration interface
-   Review history interface
-   Chat interface

The frontend was then connected to the actual FastAPI backend rather
than being treated as an independent mock UI.

I reviewed the generated frontend and worked on the integration and
behavior of the application.

------------------------------------------------------------------------

# 8. How Trae Was Used

Trae was used mainly during the integration and debugging stage.

After the backend and frontend were available, Trae was used to help:

-   Inspect the existing project
-   Understand the frontend/backend connection
-   Connect API calls to the FastAPI endpoints
-   Debug request/response issues
-   Fix integration problems
-   Identify incorrect API configurations
-   Debug AI provider behavior
-   Refine the final working implementation

A key example was the AI provider issue.

The application initially attempted to call:

``` text
https://api.openai.com/v1
```

with an OpenAI API key and returned:

``` text
401 invalid_api_key
```

The provider architecture was then adjusted/configured so that an
OpenAI-compatible local provider such as:

``` text
http://localhost:1234/v1
```

could be used with LM Studio.

This allowed the same review engine to work without requiring a paid
OpenAI API during local development.

Trae was therefore primarily used as an integration and debugging
assistant rather than as the original source of the entire application.

------------------------------------------------------------------------

# 9. AI-Generated vs. Developer-Reviewed Work

AI was involved in generating portions of the implementation, but
generated code was not treated as automatically correct.

  ------------------------------------------------------------------------
  Area                     AI Assistance           My Responsibility
  ------------------------ ----------------------- -----------------------
  Architecture             Suggested and discussed Selected the final
                           with AI                 architecture

  Database schema          AI-assisted             Reviewed relationships
                                                   and selected final
                                                   schema

  FastAPI                  AI-assisted/generated   Integrated, tested, and
  models/services/routes                           modified

  Authentication           AI-assisted/generated   Tested the
                                                   authentication flow

  ZIP processing           AI-assisted/generated   Reviewed security
                                                   behavior and tested it

  AI provider abstraction  AI-assisted/generated   Selected the generic
                                                   provider approach and
                                                   integrated it

  Review engine            AI-assisted/generated   Reviewed the flow and
                                                   tested actual reviews

  Review templates         AI-assisted/generated   Selected the review
                                                   modes and requirements

  Next.js frontend         Primarily generated     Reviewed and integrated
                           with Manus              with the backend

  Frontend/backend         AI-assisted through     Tested and fixed actual
  integration              Trae                    integration behavior

  Debugging                ChatGPT, Claude and     Reproduced problems and
                           Trae                    applied/finalized fixes

  Documentation            AI-assisted             Reviewed and adapted to
                                                   the actual
                                                   implementation
  ------------------------------------------------------------------------

------------------------------------------------------------------------

# 10. Testing and Verification

AI-generated code was not accepted solely because an AI tool produced
it.

The application was run and tested during development.

Testing included:

### Backend API testing

-   Authentication endpoints
-   Project CRUD
-   File upload
-   File retrieval
-   Provider configuration
-   Review endpoints
-   Chat endpoints

### Database testing

-   PostgreSQL connection
-   Table creation/migrations
-   Foreign-key relationships
-   Stored project/file/review data

### File security testing

ZIP extraction was tested with a malicious path such as:

``` text
../../../../tmp/pwned.txt
```

to verify that the extraction logic prevents files from being written
outside the intended project directory.

### AI integration testing

The provider flow was tested using an OpenAI-compatible endpoint and
then adjusted to support local LM Studio usage.

### Frontend testing

The Next.js application was tested against the running FastAPI backend
to verify that the frontend was using actual API responses rather than
only mocked data.

------------------------------------------------------------------------

# 11. Key Engineering Decisions

## Modular Monolith

I chose a modular monolith instead of microservices because the
assessment had a short implementation window and the project did not
require independently deployed services.

The backend is organized into logical modules while remaining a single
FastAPI application.

This provides simpler development and deployment while keeping the code
organized.

------------------------------------------------------------------------

## Generic AI Provider

I chose an OpenAI-compatible provider abstraction instead of tightly
coupling the application to OpenAI.

This allows the same review engine to work with:

-   OpenAI
-   LM Studio
-   OpenRouter
-   Other OpenAI-compatible endpoints

The provider configuration controls:

``` text
Base URL
API Key
Model Name
```

This was especially useful because local development can use LM Studio
without requiring a paid OpenAI API.

------------------------------------------------------------------------

## PostgreSQL

PostgreSQL was selected because it was one of the required/ preferred
database options in the assessment and fits the relational relationships
between:

``` text
Users
Projects
Files
Providers
Reviews
Chat Sessions
Messages
```

------------------------------------------------------------------------

## Local File Storage

For the assessment MVP, uploaded project files are handled using local
storage rather than introducing cloud object storage.

This keeps the implementation simple and allows the code review workflow
to be demonstrated without additional infrastructure.

------------------------------------------------------------------------

## Simple Context Retrieval

The AI chat does not use a vector database.

The project uses a simpler context retrieval approach based on the
uploaded project files and relevant file/content selection.

This was chosen because the assessment explicitly allows simple context
retrieval and because a full embedding/vector-search system would add
complexity without being necessary for the core demonstration.

------------------------------------------------------------------------

## Synchronous Review Generation

Reviews are generated during the API request instead of introducing a
background job system.

A queue such as Redis/Celery could be introduced for a larger production
system, but it was intentionally avoided for this assessment to keep the
implementation focused.

------------------------------------------------------------------------

## API Key Protection

Provider API keys are not intended to be exposed through normal frontend
responses.

Where provider keys are persisted, the implementation uses encryption
rather than storing the key as ordinary plaintext.

Actual API keys and secrets are kept outside the repository.

------------------------------------------------------------------------

# 12. Known Limitations

The project was implemented as an assessment/MVP within a limited
development period.

Known limitations include:

### AI response time

Review generation is currently synchronous. A production-scale system
could move long-running reviews to a background job/queue.

### Chat retrieval

The chat system uses simple context retrieval rather than
semantic/vector search.

### Authentication

JWT authentication is implemented, but a complete production
refresh-token/revocation system could be added later.

### Key management

Application-level encryption is used for stored provider credentials. A
production deployment could use a dedicated secrets manager/KMS.

### Local AI

LM Studio is intended primarily for local development/demo usage. A
deployed application would require an accessible AI endpoint or hosted
provider.

These are conscious scope decisions rather than attempts to hide missing
production infrastructure.

------------------------------------------------------------------------

# 13. Why AI Was Used

The purpose of using AI tools was not simply to generate as much code as
possible.

They were useful for:

-   Exploring architecture options quickly
-   Reducing repetitive implementation work
-   Reviewing approaches before implementation
-   Debugging unfamiliar errors
-   Generating initial implementation drafts
-   Comparing possible designs
-   Producing documentation
-   Accelerating frontend development
-   Testing alternative solutions

The important part of the process was understanding the generated
implementation, integrating it into the project, testing it, and making
the final engineering decisions.

------------------------------------------------------------------------

# 14. Development Workflow

The overall workflow was approximately:

``` text
Assessment Requirements
        |
        v
Architecture & Planning
        |
        v
Backend Development
   Claude + ChatGPT
        |
        v
Backend Testing
        |
        v
Frontend Development
       Manus
        |
        v
Frontend/Backend Integration
        |
        v
Debugging & Refinement
        |
       Trae
        |
        v
AI Provider Testing
        |
        v
Final Testing
        |
        v
Documentation
```

AI tools were used at different points for different purposes rather
than relying on one generated codebase without verification.

------------------------------------------------------------------------

# 15. Final Reflection

Using multiple AI development tools was itself part of the engineering
workflow for this project.

The most useful outcome was not simply the amount of code generated. It
was being able to use different AI systems for different stages:

-   **ChatGPT** --- architecture, reasoning, planning and debugging
-   **Claude** --- backend implementation and backend architecture
-   **Manus AI** --- frontend implementation
-   **Trae** --- integration and debugging

I was responsible for bringing those pieces together into one working
application, deciding which suggestions to use, testing the
implementation, resolving integration problems, and making the final
engineering trade-offs.

The project therefore represents an AI-assisted development workflow
with human-led architecture, integration, verification, and
decision-making.
