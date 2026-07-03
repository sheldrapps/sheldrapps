# EPUB Fixer samples

Source: C:\Users\sheld\Downloads\el-gato-negro--3.epub

Generated samples:
- 01-crit-zip-001: Plain text EPUB placeholder; not a readable ZIP.
- 02-crit-zip-002: Truncated ZIP central directory.
- 03-crit-ocf-001: Missing mimetype entry.
- 04-crit-ocf-002: Mimetype moved out of the first ZIP slot.
- 05-crit-ocf-003: Mimetype stored with compression.
- 06-crit-ocf-004: Mimetype rewritten with invalid bytes.
- 07-crit-ocf-005: No META-INF directory remains.
- 08-crit-con-001: Missing META-INF/container.xml.
- 09-crit-con-002: Malformed container.xml.
- 10-crit-con-003: container.xml without a rootfile.
- 11-crit-con-004: rootfile path points to a missing OPF.
- 12-crit-con-005: Multiple OPF candidates with no clear winner.
- 13-crit-opf-001: No OPF is localizable from the container.
- 14-crit-opf-002: OPF is malformed XML.
- 15-crit-opf-003: manifest element removed.
- 16-crit-opf-004: spine element removed.
- 17-crit-opf-005: spine exists but is empty.
- 18-crit-spine-001: spine idref points to a missing manifest id.
- 19-crit-spine-002: Referenced chapter file removed from ZIP.
- 20-crit-spine-003: spine points at a non-reading resource.
- 21-crit-xhtml-001: Chapter XHTML is malformed.
- 22-crit-sec-001: DRM-style locked content placeholder.
- 23-high-opf-001: OPF version is invalid.
- 24-high-opf-002: unique-identifier removed.
- 25-high-opf-003: unique-identifier points to a missing id.
- 26-high-man-001: Physical orphan file added outside manifest.
- 27-high-man-002: Manifest references a missing image.
- 28-high-xhtml-001: Chapter XHTML has unclosed tags.
- 29-high-xhtml-002: Chapter XHTML uses invalid XML syntax.
- 30-high-xhtml-003: Chapter XHTML includes forbidden DOCTYPE/entity markup.
- 31-high-enc-001: Chapter bytes and XML declaration disagree.
- 32-high-enc-002: Chapter contains invalid XML control characters.
- 33-high-fallback-001: Scripted/foreign resource has no fallback.

Notes:
- The sample set is aligned to the 33 opening blocker cases in the EPUB Fixer repair matrix.
- Some blockers intentionally overlap in the underlying ZIP mutation, but each file is named and documented per matrix case.
- The DRM-style blocker is represented by a locked-content placeholder sample because the repo does not mint real DRM EPUBs.

