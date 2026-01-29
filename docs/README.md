# Mockzilla Documentation

Welcome to the Mockzilla documentation! This project is a Chrome Extension (Manifest V3) designed for client-side request interception and mocking, primarily utilizing `@mswjs/interceptors` to patch `fetch` and `XMLHttpRequest` in the browser's "Main World."

This documentation aims to provide a clear and concise understanding of the project's architecture, coding standards, and data flow.

## Table of Contents

- [Architectural Discovery Strategy](architecture.md)
- [Coding Standards & Conventions](coding-standards.md)
- [Core Functional Patterns (Data Flow & Storage)](data-flow.md)

## Project Identity

- **Project Name:** Mockzilla
- **Type:** Chrome Extension (Manifest V3)
- **Core Purpose:** Client-side request interception and mocking.
- **Key Mechanism:** Uses `@mswjs/interceptors` to reliably patch global `fetch` and `XMLHttpRequest` in the browser's "Main World" (page context).

## How to Navigate This Documentation

Each section above links to a more detailed document. Start with the "Architectural Discovery Strategy" to understand how the extension components are structured and discovered. Refer to "Coding Standards & Conventions" for development guidelines, and "Core Functional Patterns" for insights into data handling and the interception process.
