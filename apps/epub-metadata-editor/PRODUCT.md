# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

People working with EPUB files who need to inspect or update their embedded metadata. This audience description is inferred from the app's name and implemented workflows; more specific user groups have not been confirmed.

## Product Purpose

EPUB Metadata Editor (EME) lets people inspect and edit publication metadata such as title, authors, language, identifier, publisher, description, subjects, and rights. Success means the user can review the proposed changes and deliberately apply them to the EPUB in the EME library.

## Positioning

No distinct competitive position or unique claim has been confirmed. Keep future copy focused on the verified metadata editing workflow.

## Operating Context

The app runs as a native Android utility. The workflow moves from choosing single- or multiple-file mode, to editing metadata in the shared form, to reviewing the filename and proposed changes in EME. The EPUB picker opens directly from the mode choice; there is no separate file-selection step. Form Done only advances to review, where a separate Apply changes action commits the metadata. Back from review reopens the form with the proposed values; Back from the form returns to the mode choice.

## Capabilities and Constraints

- The shared editor supports EPUB 2 and EPUB 3 metadata fields.
- The workflow supports single-file editing and a multiple-file mode gated by the app's existing Pro access.
- Form completion and saving are separate actions. Do not treat Done as permission to write changes.
- The app uses the native Android EPUB picker and rewrite flow.

## Evidence on Hand

- Implemented workflow: `src/app/pages/edit/` and `src/app/services/epub-metadata-workflow.service.ts`.
- Shared metadata editor: `packages/ui-theme/src/lib/components/epub-metadata-editor/`.
- No customer research, testimonials, or market claims were supplied; do not invent them.

## Product Principles

- Make the proposed metadata changes reviewable before applying them.
- Keep review and persistence as separate, clearly labeled actions.
- Keep the selected EPUB's filename visible through review.
- Explain failures in terms of the affected file and a useful recovery action.
