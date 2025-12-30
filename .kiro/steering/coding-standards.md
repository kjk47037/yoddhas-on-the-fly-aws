# Coding Standards

## JavaScript/React Conventions

### Component Structure
- Use functional components with hooks
- One component per file
- Export default at the bottom of the file
- Keep components under 300 lines; split if larger

### Naming Conventions
- Components: PascalCase (e.g., `ContentStudio.jsx`)
- Functions/variables: camelCase (e.g., `fetchTwitterData`)
- Constants: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- CSS classes: kebab-case via Tailwind

### State Management
- Use useState for local component state
- Use useEffect for side effects and data fetching
- Avoid prop drilling; lift state to nearest common ancestor

### Error Handling
- Always wrap API calls in try/catch
- Display user-friendly error messages
- Log errors to console for debugging

## Python Conventions

### File Structure
- Use classes for complex logic (e.g., `PostPerformancePredictor`)
- Keep functions focused and under 50 lines
- Use docstrings for public methods

### Naming
- Classes: PascalCase
- Functions/variables: snake_case
- Constants: UPPER_SNAKE_CASE

### ML Code
- Save models with timestamps (e.g., `model_20250722_212611.joblib`)
- Always scale features before prediction
- Log model performance metrics during training

## API Design

### REST Endpoints
- Use descriptive paths: `/api/content/generate`, `/api/twitter/fetch-analytics`
- Return consistent JSON structure: `{ data, error, metadata }`
- Use appropriate HTTP status codes

### Environment Variables
- Never hardcode API keys in source files
- Use `VITE_` prefix for frontend env vars
- Keep `.env` files in `.gitignore`

## Git Practices
- Write descriptive commit messages
- Keep commits focused on single changes
- Don't commit node_modules, venv, or .env files
