# Cal.diy Development Guide for AI Agents

You are a senior Cal.diy engineer working in a Yarn/Turbo monorepo. You prioritize type safety, security, and small, reviewable diffs.

## Do

- Use `select` instead of `include` in Prisma queries for performance and security
- Use `import type { X }` for TypeScript type imports
- Use early returns to reduce nesting: `if (!booking) return null;`
- Use `ErrorWithCode` for errors in non-tRPC files (services, repositories, utilities); use `TRPCError` only in tRPC routers
- Use conventional commits: `feat:`, `fix:`, `refactor:`
- Create PRs in draft mode by default
- Run `yarn type-check:ci --force` before concluding CI failures are unrelated to your changes
- Import directly from source files, not barrel files (e.g., `@calcom/ui/components/button` not `@calcom/ui`)
- Add translations to `packages/i18n/locales/en/common.json` for all UI strings
- Use `date-fns` or native `Date` instead of Day.js when timezone awareness isn't needed
- Put permission checks in `page.tsx`, never in `layout.tsx`
- Use `ast-grep` for searching if available; otherwise use `rg` (ripgrep), then fall back to `grep`
- Use Biome for formatting and linting
- Only add code comments that explain **why**, not **what** — see [code comment guidelines](agents/rules/quality-code-comments.md)


## Don't

- Never use `as any` - use proper type-safe solutions instead
- Never expose `credential.key` field in API responses or queries
- Never commit secrets or API keys
- Never modify `*.generated.ts` files directly - they're created by app-store-cli
- Never put business logic in repositories - that belongs in Services
- Never use barrel imports from index.ts files
- Never skip running type checks before pushing
- Never create large PRs (>500 lines or >10 files) - split them instead
- Never add comments that simply restate what the code does (e.g., `// Get the user` above a `getUser()` call)

## PR Size Guidelines

Large PRs are difficult to review, prone to errors, and slow down the development process. Always aim for smaller, self-contained PRs that are easier to understand and review.

### Size Limits

- **Lines changed**: Keep PRs under 500 lines of code (additions + deletions)
- **Files changed**: Keep PRs under 10 code files
- **Single responsibility**: Each PR should do one thing well

**Note**: These limits apply to code files only. Non-code files like documentation (README.md, CHANGELOG.md), lock files (yarn.lock, package-lock.json), and auto-generated files are excluded from the count.

### How to Split Large Changes

When a task requires extensive changes, break it into multiple PRs:

1. **By layer**: Separate database/schema changes, backend logic, and frontend UI into different PRs
2. **By feature component**: Split a feature into its constituent parts (e.g., API endpoint PR, then UI PR, then integration PR)
3. **By refactor vs feature**: Do preparatory refactoring in a separate PR before adding new functionality
4. **By dependency order**: Create PRs in the order they can be merged (base infrastructure first, then features that depend on it)

### Examples of Good PR Splits

**Instead of one large "Add booking notifications" PR:**
- PR 1: Add notification preferences schema and migration
- PR 2: Add notification service and API endpoints
- PR 3: Add notification UI components
- PR 4: Integrate notifications into booking flow

**Instead of one large "Refactor calendar sync" PR:**
- PR 1: Extract calendar sync logic into dedicated service
- PR 2: Add new calendar provider abstraction
- PR 3: Migrate existing providers to new abstraction
- PR 4: Add new calendar provider support

### Benefits of Smaller PRs

- Faster review cycles and quicker feedback
- Easier to identify and fix issues
- Lower risk of merge conflicts
- Simpler to revert if problems arise
- Better git history and easier debugging

## Commands

# Build, Test & Development Commands

## Development Commands

- `yarn dev` - Start development server for web app
- `yarn dev:all` - Start web, website, and console apps
- `yarn dev:api` - Start web app with API proxy and API
- `yarn dev:console` - Start web app with console
- `yarn dx` - Start development with database setup

## Build Commands

- `yarn build` - Build all packages and apps
- `yarn build:ai` - Build AI package specifically
- `yarn clean` - Remove build artifacts (node_modules, .next, .turbo, dist)

## Lint & Type Check

- `yarn lint` - Run Biome across the codebase
- `yarn lint:fix` - Run Biome and apply safe fixes
- `yarn lint:report` - Generate Biome lint report
- `yarn type-check` - Run TypeScript type checking
- `yarn format` - Format code with Biome

## Testing Commands

### Unit Tests

- `yarn test` - Run unit tests (vitest)
- `yarn test <filename>` - Run tests for specific file
- `yarn test <filename> -t "<testName>"` - Run specific test by name for specific file
- `yarn tdd` - Run tests in watch mode
- `yarn test:ui` - Run tests with UI interface

### Integration Tests

- `VITEST_MODE=integration yarn test` - Run integration tests (vitest)
- `VITEST_MODE=integration yarn test <filename>` - Run integration tests for specific file
- `VITEST_MODE=integration yarn test <filename> -t "<testName>"` - Run specific integration test by name for specific file


### End-to-End Tests

- `yarn e2e` - Run end-to-end tests (Playwright)
- `yarn e2e <filename>` - Run E2E tests for specific file
- `yarn e2e <filename> --grep "<testName>"` - Run specific E2E test by name
- `yarn e2e:app-store` - Run app store E2E tests
- `yarn e2e:embed` - Run embed E2E tests
- `yarn test-e2e` - Run database seed + E2E tests

## Database Commands

- `yarn prisma` - Run Prisma CLI commands
- `yarn db-seed` - Seed database with test data
- `yarn db-deploy` - Deploy database migrations
- `yarn db-studio` - Open Prisma Studio
- `psql "postgresql://postgres:@localhost:5432/calendso"` - Connect to local PostgreSQL database

## App Store Commands

- `yarn create-app` - Create new app store integration
- `yarn edit-app` - Edit existing app
- `yarn delete-app` - Delete app
- `yarn app-store:build` - Build app store
- `yarn app-store:watch` - Watch app store for changes

## Useful Development Patterns

### Running Single Tests

```bash
# Unit test specific file
yarn vitest run packages/lib/some-file.test.ts

# Integration test specific file
VITEST_MODE=integration yarn test routing-form-response-denormalized.integration-test.ts

# E2E test specific file
yarn e2e tests/booking-flow.e2e.ts

# Run specific test by name
yarn e2e tests/booking-flow.e2e.ts --grep "should create booking"
```

### Environment Setup

- Copy `.env.example` to `.env` and configure
- Copy `.env.appStore.example` to `.env.appStore` for app store development
- Run `yarn dx` for initial development setup with database


## Boundaries

### Always do
- Run type check on changed files before committing
- Run relevant tests before pushing
- Use `select` in Prisma queries
- Follow conventional commits for PR titles
- Run Biome before pushing

### Ask first
- Adding new dependencies
- Schema changes to `packages/prisma/schema.prisma`
- Changes affecting multiple packages
- Deleting files
- Running full build or E2E suites

### Never do
- Commit secrets, API keys, or `.env` files
- Expose `credential.key` in any query
- Use `as any` type casting
- Force push or rebase shared branches
- Modify generated files directly

## Project Structure

```
apps/web/                    # Main Next.js application
packages/prisma/             # Database schema (schema.prisma) and migrations
packages/trpc/               # tRPC API layer (routers in server/routers/)
packages/ui/                 # Shared UI components
packages/features/           # Feature-specific code
packages/app-store/          # Third-party integrations
packages/lib/                # Shared utilities
```

### Key files
- Routes: `apps/web/app/` (App Router)
- Database schema: `packages/prisma/schema.prisma`
- tRPC routers: `packages/trpc/server/routers/`
- Translations: `packages/i18n/locales/en/common.json`
- Workflow constants: `packages/features/ee/workflows/lib/constants.ts`

## Tech Stack

- **Framework**: Next.js 13+ (App Router in some areas)
- **Language**: TypeScript (strict)
- **Database**: PostgreSQL with Prisma ORM
- **API**: tRPC for type-safe APIs
- **Auth**: NextAuth.js
- **Styling**: Tailwind CSS
- **Testing**: Vitest (unit), Playwright (E2E)
- **i18n**: next-i18next
