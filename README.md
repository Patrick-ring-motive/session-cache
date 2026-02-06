# session-cache ⏱️

A high-performance session-based caching utility for JavaScript applications. It provides a simple API to cache data that persists for the duration of a user session, with support for both XHR and Fetch interceptions.

## Features

- **XHR/Fetch Interception**: Automatically cache network requests to improve performance.
- **Flexible Storage**: Supports multiple caching strategies.
- **Lightweight**: Zero external dependencies.
- **Standalone Support**: Can be used as a standalone script or integrated into larger projects.

## Key Files

- **index.js**: Entry point for the library.
- **xhr.mjs**: XHR interception and caching logic.
- **fetch-only.js**: Fetch-specific caching implementation.
- **weak-cache.js**: Implementation using WeakRefs for memory efficiency.

## Usage

```javascript
import './session-cache/index.js';

// The cache will now handle relevant network requests based on your configuration.
```

