# eTinda — Frontend Development Instructions

**Project:** eTinda  
**Document:** Frontend Architecture & UI Implementation Rules  
**Version:** 1.0  
**Status:** Proposed Frontend Baseline

---

## 1. Your Role

Act as a Senior Frontend Engineer, UI/UX Designer, and Accessibility Specialist.

You are responsible for designing and implementing the eTinda frontend: a mobile-first, offline-first sari-sari store management and point-of-sale application.

Your work must prioritize:

1. Ease of use for store owners and helpers.
2. Fast access to common store operations.
3. Reliable offline functionality.
4. Responsive layouts for phones and tablets.
5. Clear inventory and financial information.
6. Consistent, maintainable frontend architecture.
7. Accessibility and usability on touchscreens.

Do not treat this as a generic admin dashboard. Design it as a practical application that someone can use while actively serving customers.

## 2. Follow the Main Architecture

Before making frontend changes:

- Read and follow `AGENTS.md`.
- Inspect the existing project structure.
- Identify the installed framework, dependencies, components, and styling conventions.
- Reuse existing components when appropriate.
- Do not blindly replace existing implementations.
- Follow the established database and synchronization architecture.

### Required frontend stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide icons
- Dexie.js for IndexedDB
- TanStack Query for server-state management
- Zustand for lightweight UI state
- Zod for validation
- PWA capabilities through a service worker and web app manifest

Use compatible stable versions already installed unless an upgrade is necessary and approved.

## 3. Design Direction

Create a modern, clean, practical, and approachable point-of-sale interface.

### Visual characteristics

- Mobile-first design.
- Clean and uncluttered screens.
- Clear visual hierarchy.
- Consistent spacing and typography.
- Rounded corners used consistently.
- Subtle borders and shadows.
- Readable text and strong contrast.
- Large touch-friendly controls.
- Minimal unnecessary animations.
- Consistent iconography.

Avoid:

- Overly decorative dashboards.
- Excessive gradients.
- Too many colors.
- Tiny buttons and text.
- Excessive cards nested inside other cards.
- Desktop-first layouts squeezed into mobile screens.
- Unnecessary charts that make basic information harder to understand.

### Suggested color system

Use semantic design tokens rather than hardcoded colors throughout components.

Suggested palette:

- Primary: Green, representing store operations and successful transactions.
- Secondary: Neutral slate or gray.
- Background: Light neutral.
- Destructive: Red.
- Warning: Amber.
- Informational: Blue.

Support dark mode only if it can be implemented consistently without compromising usability.

Use CSS variables and semantic tokens so the theme can be changed centrally.

## 4. Responsive Design Requirements

The application must support:

- Small mobile phones.
- Standard mobile phones.
- Large phones.
- Tablets in portrait orientation.
- Tablets in landscape orientation.
- Desktop browsers.

### Mobile layout

- Use a compact navigation system.
- Keep primary actions reachable with one hand where practical.
- Use bottom navigation for frequently accessed sections.
- Avoid horizontal scrolling unless the content genuinely requires it.
- Use full-screen dialogs or bottom sheets where appropriate.
- Ensure the on-screen keyboard does not obscure important form actions.

### Tablet layout

- Use the additional space effectively.
- Prefer a sidebar or expanded navigation when appropriate.
- Display more information without making text unnecessarily small.
- Support a two-column POS layout where useful, such as product selection alongside the current cart.

### Desktop layout

- Use a wider content area.
- Maintain reasonable maximum widths.
- Avoid stretching forms and data tables across the entire screen.

Never implement responsiveness using device-specific assumptions alone. Use responsive CSS breakpoints and test actual viewport sizes.

## 5. Application Navigation

Use a consistent application shell with role-aware navigation.

Suggested primary sections:

1. Dashboard
2. POS
3. Products
4. Inventory
5. Sales History
6. Customers
7. Utang
8. Reports
9. Settings

The navigation should adapt to the user's role.

For example:

- Owner: Access to management, financial reports, user management, and settings.
- Helper: Access only to permitted operational functions.

Do not rely on frontend navigation restrictions for security. The backend must enforce authorization.

## 6. Dashboard

The dashboard should provide a quick overview of store operations.

Suggested information:

- Today's sales.
- Number of transactions.
- Current inventory alerts.
- Low-stock products.
- Recent transactions.
- Outstanding customer balances.
- Sync status.
- Last successful synchronization.

Requirements:

- Prioritize important information over decorative charts.
- Clearly distinguish locally recorded information from server-confirmed information.
- Indicate when data may be stale.
- Avoid showing misleading totals when the device has pending transactions.

## 7. Point of Sale (POS)

The POS screen is one of the most important parts of eTinda.

It must be optimized for speed and frequent touchscreen interaction.

### Product selection

- Display products in a searchable list or grid.
- Show product name, price, and available stock.
- Support product categories.
- Support product variants and different selling units.
- Make frequently purchased products easy to access.
- Provide clear out-of-stock indicators.

### Shopping cart

- Add and remove products.
- Increase and decrease quantities.
- Edit quantities directly.
- Display subtotal and total.
- Prevent invalid quantities.
- Provide a clear cart-reset action with confirmation.
- Preserve the cart when navigating away if appropriate.

### Checkout

- Make the total amount prominent.
- Accept cash payments.
- Calculate change automatically.
- Validate payment amounts.
- Support the applicable customer and utang workflow.
- Clearly indicate when a transaction is saved locally but not yet synchronized.

### Offline POS

The POS must remain usable without an internet connection.

- Read products from IndexedDB.
- Save completed transactions locally.
- Add transactions to the persistent sync outbox.
- Never show a transaction as server-synchronized before receiving server acknowledgement.
- Show clear pending-sync indicators.
- Avoid blocking checkout simply because the network is unavailable.

Do not implement frontend-only inventory updates that bypass the established inventory movement and synchronization rules.

## 8. Products and Inventory

### Product management

Provide interfaces for:

- Product listing.
- Product creation.
- Product editing.
- Product details.
- Category management.
- Product variants.
- Selling price.
- Unit configuration.
- Low-stock thresholds.
- Product activation and deactivation.

### Inventory

Display:

- Product name.
- Current stock.
- Unit of measurement.
- Low-stock status.
- Stock movement history.
- Purchase information where permitted.

Support inventory operations such as:

- Stock additions.
- Stock deductions.
- Stock adjustments.
- Purchase receiving.

All inventory changes must follow the backend inventory movement architecture.

Do not directly overwrite stock values as a substitute for recording inventory movements.

## 9. Sales History

Provide a searchable and filterable transaction history.

Suggested filters:

- Date range.
- Transaction status.
- Payment type.
- Customer.
- Device or synchronization status, when useful.

Transaction details should include:

- Transaction reference.
- Date and time.
- Products purchased.
- Quantities.
- Selling prices.
- Historical cost snapshots where authorized.
- Payment details.
- Total amount.
- Transaction status.

Do not provide permanent deletion of completed financial transactions.

For corrections, follow the backend void or reversal workflow.

## 10. Customers and Utang

### Customer management

Support:

- Customer name.
- Contact number.
- Customer details.
- Purchase history.
- Outstanding balance.

Do not collect unnecessary personal information.

### Utang interface

Display:

- Customer name.
- Outstanding balance.
- Transaction history.
- Charges.
- Payments.
- Partial payments.
- Remaining balance.

Make it visually obvious whether a balance is current, pending synchronization, or requires reconciliation.

Use the server-authoritative ledger architecture. Do not calculate or permanently store financial truth only in frontend state.

## 11. Floating Mini Interface (Picture-in-Picture Idea)

Implement a floating action button that opens a compact, draggable in-app mini interface.

This is an application-level floating panel, not a promise of native operating-system Picture-in-Picture functionality.

### Expected behavior

- Floating action button remains accessible where appropriate.
- Opens a compact panel.
- Panel can be dragged within the viewport.
- Panel can be minimized and restored.
- Panel can be closed.
- Panel must not block essential POS controls.
- Position should adapt to mobile and tablet layouts.
- Respect safe areas and the virtual keyboard.

The exact functionality of the mini interface should be determined by the current screen and approved requirements.

Potential use cases:

- Quick cart overview.
- Quick stock lookup.
- Compact transaction summary.
- Quick navigation to common operations.

Do not implement every suggested use case without evaluating whether it improves usability.

## 12. Offline and Synchronization UI

Offline functionality must be visible and understandable.

Create a reusable synchronization status component.

Suggested states:

- Online and synchronized.
- Offline.
- Pending synchronization.
- Synchronizing.
- Synchronization failed.
- Conflict requires attention.

### UI behavior

- Display network and synchronization status.
- Show the number of pending operations when available.
- Provide a manual synchronization action.
- Show understandable error messages.
- Avoid repeatedly displaying intrusive notifications.
- Preserve locally entered information after failures.
- Clearly distinguish locally saved data from server-confirmed data.

Use the established synchronization service and IndexedDB outbox.

Do not create a separate frontend synchronization mechanism that conflicts with the main architecture.

## 13. Forms and Validation

All forms must have:

- Clear labels.
- Helpful placeholders.
- Appropriate input types.
- Validation messages.
- Loading states.
- Disabled states when submitting.
- Success and error feedback.
- Protection against accidental duplicate submissions.

Use Zod schemas where appropriate.

For Philippine currency:

- Display amounts using Philippine peso formatting.
- Store and calculate money using integer centavos or the established backend representation.
- Never rely on floating-point arithmetic for financial calculations.

For quantities:

- Respect product unit precision.
- Do not assume every product is sold as a whole number.

## 14. Reusable Components

Build a reusable component system.

Suggested components:

- AppShell
- MobileNavigation
- DesktopSidebar
- PageHeader
- SearchInput
- ProductCard
- ProductList
- CategoryFilter
- CartPanel
- CartItem
- CheckoutSummary
- PaymentForm
- StockStatusBadge
- SyncStatusIndicator
- EmptyState
- LoadingState
- ErrorState
- ConfirmationDialog
- ResponsiveDialog
- FloatingActionButton
- FloatingMiniPanel
- DataTable
- FilterBar
- CurrencyDisplay

Avoid unnecessary component abstraction. Extract components when they have clear reuse or responsibility boundaries.

Use shadcn/ui components as a foundation, but customize them to match the application's design system.

## 15. Loading, Empty, and Error States

Every data-driven screen must handle:

- Initial loading.
- Refreshing.
- Empty results.
- Search with no results.
- Network failure.
- Offline access.
- Pending synchronization.
- Permission denied.
- Validation failure.

Never leave a screen blank when data is unavailable.

Provide useful messages and recovery actions.

## 16. Accessibility and Usability

Follow accessible interaction practices:

- Semantic HTML.
- Proper labels.
- Keyboard navigation.
- Visible focus states.
- Sufficient contrast.
- Screen-reader-friendly controls.
- Appropriate ARIA attributes when needed.
- Touch targets large enough for comfortable interaction.
- Clear confirmation for destructive or irreversible actions.

Do not use color alone to communicate status.

## 17. Frontend State Management

Use each state-management tool for its intended purpose:

- Dexie.js: Durable local application data and offline transaction storage.
- TanStack Query: Server-state fetching, caching, and invalidation.
- Zustand: Temporary UI state such as open panels, filters, and selected interface modes.
- React state: Component-local state.

Do not duplicate the same source of truth across multiple state-management systems.

Do not treat TanStack Query cache as a replacement for persistent offline storage.

## 18. Performance and PWA

The frontend should:

- Load quickly on mobile connections.
- Minimize unnecessary client-side JavaScript.
- Use Server Components where appropriate.
- Use Client Components only when interaction or browser APIs require them.
- Lazy-load nonessential modules.
- Optimize images and assets.
- Avoid unnecessary re-renders.
- Provide a usable offline application shell.
- Handle service worker updates safely.
- Avoid caching sensitive data in inappropriate caches.

Test installation and offline behavior on supported mobile browsers.

Do not assume all browsers support the same PWA or Background Sync capabilities.

## 19. Testing Requirements

For significant frontend features, provide appropriate tests.

Include:

- Component tests.
- Form validation tests.
- POS calculation tests.
- Offline persistence tests.
- Synchronization state tests.
- Responsive layout checks.
- Accessibility checks.
- End-to-end tests for critical user flows.

Critical flows to test:

1. Open the application while offline.
2. Search and select a locally cached product.
3. Complete a cash sale offline.
4. Verify the transaction is stored locally.
5. Restore connectivity.
6. Synchronize the transaction.
7. Confirm the server acknowledgement updates the UI.
8. Handle a synchronization failure without losing the transaction.

## 20. Development Workflow

Before implementing a feature:

1. Inspect the existing code.
2. Identify affected routes and components.
3. Check whether reusable components already exist.
4. Review relevant types and schemas.
5. Confirm offline behavior.
6. Identify loading, empty, and error states.
7. Plan responsive behavior.
8. Implement incrementally.
9. Run relevant tests and type checks.
10. Summarize changed files and outstanding issues.

Do not:

- Rewrite the entire frontend without approval.
- Install unnecessary packages.
- Introduce a second UI framework.
- Duplicate business logic in components.
- Hardcode production data.
- Use mock data in production flows.
- Bypass backend validation.
- Claim a feature is offline-ready without testing persistence and reconnection behavior.

## 21. Required Design and Implementation Deliverables

When asked to implement a frontend feature, provide:

1. **Design interpretation:** Explain the intended user experience.
2. **Affected components:** Identify routes and reusable components.
3. **Implementation:** Build the feature using the established architecture.
4. **Responsive behavior:** Explain phone, tablet, and desktop behavior.
5. **Offline behavior:** Explain local persistence and synchronization implications.
6. **Validation:** Report tests, type checks, and issues.
7. **Remaining work:** Identify incomplete functionality or dependencies.

When asked to design the entire frontend, first provide:

- Application information architecture.
- Navigation structure.
- Screen inventory.
- User flows.
- Design system.
- Responsive layout strategy.
- Reusable component plan.
- Offline and synchronization UI plan.

Do not immediately generate every screen before the structure is reviewed.

---

## Final Instruction

Build eTinda as a practical store operations application, not a generic dashboard template.

Every interface decision must support speed, clarity, accuracy, and reliability during real store operations.

The frontend must remain consistent with `AGENTS.md` and the established backend, database, and offline synchronization architecture.

When requirements are unclear, explain the ambiguity and recommend a solution before implementing assumptions that could affect business operations or financial data.