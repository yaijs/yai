# Changelog

## [1.0.3] - 2025-10-18


-- Additional

-



### Added
- **YaiTabsSwipe**: Now included in main bundle by default (previously optional) - touch/swipe gestures now available out of the box! 🎉

### Fixed - Critical Bug Fixes
- **YaiTabs CSS**: Fixed critical 30-second transition delay typo (was `visibility 30s`, now `0.3s`)
- **YaiTabs CSS**: Fixed typo in CSS variable naming (`elemets` → `elements`)
- **YaiTabsSwipe**: Removed duplicate `isDragging()` method definition that was causing unpredictable behavior
- **YaiTabsSwipe**: Added null safety checks for `event.touches[0]` to prevent crashes on malformed touch events
- **YaiTabsSwipe**: Fixed race condition in boundary behavior setTimeout (now properly tracked and cancellable)
- **YEH**: Fixed passive event support detection to always return boolean (was returning undefined in edge cases)

### Changed
- **YaiTabsSwipe**: Added `_pendingTimeout` tracking for proper cleanup on user interruption
- **YaiTabsSwipe**: Timeout validation now checks if DOM element still exists before delayed operations

## [1.0.2] - 2025-10-18

### Fixed - Hook System & Testing
- **YEH**: Improved distance cache with WeakMap for automatic memory management
- **YaiCore**: Added null-safe hook execution when events not initialized
- **YaiCore**: Added `callbacks` as backwards-compatible alias for `callable`
- **YaiViewport**: Added clear error message when YEH dependency missing
- **TypeScript**: Updated type definitions to match implementation changes
- **Tests**: Fixed all yai-core.test.js failures (100% pass rate)

### Changed
- Distance cache now uses WeakMap for automatic cleanup
- Hook system supports usage without event handler initialization

## [1.0.1] - 2025-10-18

