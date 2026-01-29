# Project Context & Agent Guide

> **Note to Agents:** This document is your primary source of truth for understanding the architectural decisions, discovery patterns, and functional core of this project. Use this to orient yourself before making changes.

## 1. Project Identity

- **Project Name:** Mockzilla
- **Type:** Chrome Extension (Manifest V3)
- **Core Purpose:** Client-side request interception and mocking.
- **Key Mechanism:** Uses [`@mswjs/interceptors`](https://github.com/mswjs/interceptors) to reliably patch global `fetch` and `XMLHttpRequest` in the browser's "Main World" (page context).

## 2. Documentation

For detailed information about the project's architecture, coding standards, and data flow, please refer to the [main documentation](docs/README.md).

