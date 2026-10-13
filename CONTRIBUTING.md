# Contributing to Little Zen

Thank you for your interest in contributing to **Little Zen**! This is a tranquil, minimalist digital sanctuary, and we welcome contributions that preserve its calm essence, improve performance, or fix issues.

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/<your-username>/little-zen.git
   cd little-zen
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Start the local dev server**:
   ```bash
   npm run dev
   ```

## Development Guidelines

- **Minimalist Aesthetic**: Keep the UI clean, subdued, and quiet. Avoid bright neon accents, gamification, popups, or unnecessary complexity.
- **TypeScript**: Ensure strict typing is maintained. Run `npx tsc --noEmit` to verify type safety.
- **Offline First**: All sand rendering and MediaPipe hand tracking assets are designed to work locally and offline. Do not introduce dependencies that require remote network requests or accounts.
- **Audio Integrity**: Soundscapes and rake audio are procedurally generated with the Web Audio API.

## Submitting Pull Requests

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Commit your changes:
   ```bash
   git commit -m "Add descriptive commit message"
   ```
3. Push to your branch and open a Pull Request against `main`.

## License

By contributing to Little Zen, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
