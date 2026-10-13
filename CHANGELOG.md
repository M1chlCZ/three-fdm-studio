# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `hotspots` prop for interactive annotation markers that follow the model in
  presentation coordinates.
- `onHotspotClick` callback for marker activation with pointer, `Enter` or
  `Space`.
- `StudioHotspot` and `StudioHotspotProjection` types plus the
  `projectStudioHotspot` helper.
- Default marker styles and `--studio-hotspot-*` theme variables in
  `styles.css`.

## [0.2.0] - 2026-10-12

### Added

- `StudioViewerHandle` with `captureThumbnail` for imperative thumbnail export.
- `StudioCaptureOptions` with size, MIME type, quality and transparency options.
- Ref forwarding on `StudioViewer` so consumers can attach the handle.
