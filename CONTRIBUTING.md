# Contributing to sheet-db

Thank you for your interest in contributing to sheet-db! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/sheet-db.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development Setup

1. Set up your Google Sheets credentials (see QUICK_START.md)
2. Copy `.env.example` to `.env` and fill in your values
3. Run in development mode: `npm run dev`

## Code Style

- Use TypeScript for all new code
- Follow existing code formatting
- Use meaningful variable and function names
- Add comments for complex logic

## Building

```bash
npm run build
```

This will compile TypeScript to JavaScript in the `dist/` directory.

## Testing

Currently, the project doesn't have automated tests. When adding tests:
- Use Jest for testing
- Write tests for new features
- Ensure tests pass before submitting PR

## Submitting Changes

1. Commit your changes with clear commit messages
2. Push to your fork
3. Open a Pull Request with:
   - Clear description of changes
   - Any related issue numbers
   - Screenshots (if applicable)

## Pull Request Guidelines

- Keep changes focused and atomic
- Update documentation as needed
- Ensure code compiles without errors
- Follow existing code style

## Reporting Issues

When reporting issues, please include:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS, etc.)

## Feature Requests

We welcome feature requests! Please:
- Check if the feature already exists
- Describe the use case clearly
- Explain why it would be valuable

## Code of Conduct

- Be respectful and inclusive
- Accept constructive criticism gracefully
- Focus on what's best for the project

## Questions?

Feel free to open an issue for questions or discussions.

Thank you for contributing!
