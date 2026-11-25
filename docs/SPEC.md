# PROJECT: MY RECIPE BOOK – PERSONAL CREATIVE RECIPE APP

Act as a senior full-stack developer, software architect and UI/UX designer.

We are building a personal recipe management web application with a powerful visual recipe card editor.

This is a private application intended exclusively for my personal use.

It is NOT a SaaS product, NOT a commercial product and NOT a multi-user platform.

The goal is to create a beautiful, premium-quality digital cookbook where I can save recipes, organize them and design completely personalized recipe cards.

The application should combine the experience of:
- A personal digital cookbook.
- Pinterest-style visual organization.
- Canva-style design editing.
- A physical scrapbook or recipe notebook.

The visual experience is extremely important.

# 1. PROJECT PRINCIPLES

- Personal use only.
- Web application, not a native iOS application.
- Responsive design for desktop, tablet and mobile.
- Installable as a PWA on iPhone.
- No user registration or login.
- No subscription system.
- No backend unless genuinely necessary.
- Local-first architecture.
- All personal recipes, designs and uploaded assets should persist locally.
- Keep the architecture clean enough to support future cloud synchronization and multiple users, but do not implement them now.

IMPORTANT:

I do not own a Mac.

The entire application must be developed, tested and usable without macOS, Xcode or any Apple-specific development environment.

# 2. TECHNOLOGY STACK

Preferred technology:

- React.
- TypeScript.
- Vite.
- Tailwind CSS.
- IndexedDB for persistent local storage.
- Dexie.js for convenient IndexedDB management.
- Fabric.js for the visual recipe card editor.
- PWA support using a suitable Vite PWA plugin.

Use standard web technologies and avoid unnecessary dependencies.

The application must:
- Work in modern desktop browsers.
- Work in mobile Safari on iPhone.
- Work on tablets, including touchscreens and stylus input.
- Support PWA installation.
- Remain functional without an internet connection after initial installation.

Use a modular architecture.

Do not introduce a backend, database server or authentication system at this stage.

# 3. MAIN PRODUCT CONCEPT

The application is my personal digital recipe book.

Every recipe should have two separate aspects:

1. Recipe content – ingredients, instructions, photos and other information.
2. Recipe card design – the visual presentation of that recipe.

These two aspects must be completely independent.

I should be able to change a recipe's design without modifying its actual content.

I should also be able to save a design template and reuse it for completely different recipes.

# 4. RECIPE MANAGEMENT

Each recipe should support:

- Recipe name.
- Main photo.
- Short description.
- Ingredients.
- Ingredient quantities.
- Measurement units.
- Preparation instructions divided into steps.
- Preparation time.
- Cooking time.
- Total preparation time.
- Number of servings.
- Difficulty level.
- Category.
- Multiple tags.
- Personal notes.
- Creation date.
- Last modification date.

Actions:
- Create recipe.
- Edit recipe.
- Delete recipe.
- Duplicate recipe.
- Add to favorites.

Recipe entry should be simple and intuitive.

Allow users to add, remove and reorder ingredients and preparation steps.

# 5. CATEGORIES AND COLLECTIONS

Initial categories:

- Breakfast.
- Lunch.
- Dinner.
- Desserts.
- Snacks.
- Drinks.
- Soups.
- Salads.
- Bakery.
- Other.

Support custom categories.

Also support personal collections such as:
- My favorite recipes.
- Family recipes.
- Weekend cooking.
- Italian food.
- Quick meals.
- Recipes to try.

One recipe can belong to multiple collections.

Provide search, filtering and sorting.

# 6. RECIPE CARD DESIGNER – THE MOST IMPORTANT FEATURE

This is the central feature of the application.

I want to create visually unique recipe cards using a flexible, canvas-based editor.

Do not build a simple form that only changes colors and fonts.

Build a proper visual editor inspired by Canva, scrapbook design tools and physical recipe cards.

## A. Canvas and layouts

Support:
- Multiple canvas dimensions.
- Portrait and landscape layouts.
- Custom aspect ratios.
- Background colors.
- Background textures.
- Background images.
- Grid and alignment guides.
- Zoom in and zoom out.
- Live preview.

Provide several initial canvas presets suitable for:
- Digital recipe cards.
- Printable recipe cards.
- Larger recipe pages.

## B. Predefined templates

Create several attractive starter templates.

Examples:
- Minimalist.
- Vintage cookbook.
- Modern editorial.
- Rustic kitchen.
- Scrapbook.
- Elegant handwritten.
- Colorful playful design.

Templates should be editable.

I should be able to save my own designs as reusable templates.

## C. TEXT ELEMENTS

Allow me to add multiple independent text elements.

Each text element should support:
- Custom text.
- Font family.
- Font size.
- Font weight.
- Text color.
- Alignment.
- Letter spacing.
- Line height.
- Rotation.
- Position and dimensions.

Support text placeholders connected to recipe data.

For example:
- {{recipe.name}}
- {{recipe.description}}
- {{recipe.ingredients}}
- {{recipe.preparationTime}}

When I apply a template to another recipe, the placeholders should automatically display the new recipe's information.

## D. EXTERNAL ELEMENTS AND PERSONAL DRAWINGS

THIS IS A CRITICAL REQUIREMENT.

I want to use my tablet to create drawings and illustrations externally and then import them into the recipe card editor.

For example:
1. I draw a small illustration on my tablet using a drawing application.
2. I export the drawing as a PNG with a transparent background.
3. I import it into my recipe card.
4. I can freely position, resize and rotate it.

Support importing:
- PNG images.
- JPG images.
- SVG illustrations, with appropriate validation and sanitization.
- Transparent PNG drawings.
- Handwritten illustrations.
- Stickers.
- Icons.
- Decorative graphics.
- Food illustrations.
- Custom background images.

Support uploading multiple assets and keeping them in a personal asset library.

The asset library should allow me to reuse previously imported illustrations across different recipe cards.

## E. FREEHAND DRAWING

Additionally, consider a simple built-in drawing tool.

It should support:
- Freehand drawing.
- Different brush sizes.
- Different colors.
- Eraser.
- Undo and redo.
- Transparent background.
- Exporting the drawing as an image.

This feature is useful for quickly adding handwritten notes, arrows, small illustrations and decorations.

Make it work with touch input and stylus input where supported.

Do not compromise the main editor to implement this feature.

## F. OBJECT MANIPULATION

Every element on the canvas should be independently selectable and editable.

Support:
- Drag and drop.
- Resize.
- Rotate.
- Duplicate.
- Delete.
- Lock and unlock.
- Change layer order.
- Bring to front.
- Send to back.
- Align objects.
- Multi-select where practical.

Include a layers panel showing all elements on the card.

Support undo and redo.

## G. PHOTOS

Allow me to:
- Upload photos from my devices.
- Add multiple photos.
- Crop photos.
- Resize and reposition them.
- Apply rounded corners.
- Use photos as backgrounds.
- Combine photos with illustrations and text.

## H. DESIGN MANAGEMENT

I want to:
- Save a design.
- Save a design as a reusable template.
- Duplicate an existing design.
- Edit an existing design.
- Apply an existing template to another recipe.
- Create several different designs for the same recipe.

A template should contain visual structure and styling, not the actual recipe content.

# 7. MAIN APPLICATION SCREENS

## Home / My Cookbook

The home screen should feel like opening a beautiful personal cookbook.

Include:
- Recipe card grid.
- Large food photography.
- Recently added recipes.
- Favorite recipes.
- Collections.
- Categories.
- Search.
- Quick add recipe button.

## Recipe details

Show:
- Main image.
- Recipe name.
- Ingredients.
- Preparation instructions.
- Preparation time.
- Personal notes.
- Current recipe card design.

## Recipe creation

A clean and easy-to-use form for entering recipes.

## Design Studio

A dedicated visual workspace for designing cards.

This should have:
- Main canvas.
- Editing toolbar.
- Properties panel.
- Layers panel.
- Asset library.
- Template selection.
- Save and export actions.

The editor should adapt to screen size.

On desktop, use a spacious editing workspace.

On mobile, prioritize the canvas and use compact toolbars or collapsible panels.

# 8. EXPORT AND PRINTING

Support:
- Export recipe cards as PNG.
- Export recipe cards as PDF.
- High-resolution export suitable for printing.
- Correct preservation of fonts, images, transparency and positioning.
- Downloading exported files.
- Browser-native sharing where supported.

The exported result should look identical to the editor preview.

Do not rely on low-resolution screenshots of the canvas for exports.

# 9. DATA STORAGE AND BACKUP

Use IndexedDB for local persistence.

Store:
- Recipes.
- Categories.
- Collections.
- Templates.
- Design documents.
- Uploaded images and illustrations.
- Asset library.

Important requirements:
- Data must persist after closing the browser.
- Images must not disappear after refreshing.
- Avoid unnecessary duplication of uploaded assets.
- Deleting a recipe must not accidentally delete assets used elsewhere.
- Handle storage errors gracefully.

Implement local backup and restore.

I want to be able to export my complete cookbook, including recipes, designs, templates and uploaded assets, into a backup file.

I should be able to import that backup later.

IMPORTANT MULTI-DEVICE LIMITATION:

Local IndexedDB storage is separate on each device and browser.

Do not pretend that data automatically synchronizes between my iPhone, tablet and desktop.

Design the storage layer so cloud synchronization can be introduced later, but for now provide a reliable export/import backup mechanism.

# 10. PWA AND IPHONE EXPERIENCE

The application should be installable on iPhone using Safari's Add to Home Screen functionality.

Implement:
- Web app manifest.
- Application icons.
- Appropriate theme colors.
- Standalone display mode.
- Service worker.
- Offline caching of application resources.
- Responsive touch interactions.

Pay special attention to:
- iOS Safari compatibility.
- Touch gestures.
- File uploads from Photos.
- Safe-area spacing.
- Mobile keyboard behavior.
- Canvas performance on mobile.
- PWA storage persistence limitations.

The application should feel like a real personal app, not a website squeezed into a phone screen.

# 11. VISUAL IDENTITY

Design quality is a major priority.

The application should feel like a premium creative lifestyle product.

Inspiration:
- Pinterest.
- Canva.
- Apple Journal.
- Minimalist editorial magazines.
- Physical recipe notebooks.
- Vintage cookbooks.
- Digital scrapbooks.

Desired style:
- Warm.
- Elegant.
- Creative.
- Personal.
- Minimalist but visually rich.
- Beautiful typography.
- Thoughtful spacing.
- High-quality food photography.

Avoid generic admin dashboards.

Avoid excessive UI elements.

The recipe cards should be the visual center of the application.

# 12. FUTURE FEATURES – DO NOT IMPLEMENT YET

Keep the architecture flexible for:
- AI recipe recognition from photos.
- Handwritten recipe recognition.
- Import recipes from websites.
- AI recipe suggestions.
- Automatic shopping lists.
- Weekly meal planner.
- Cloud backup.
- iCloud or other cloud synchronization.
- Multiple users.
- Shared family cookbooks.
- Public recipe collections.

Do not implement these features in the MVP.

# 13. DEVELOPMENT PHASES

Work incrementally.

PHASE 1 – Architecture and technical blueprint.

PHASE 2 – Visual design system and application navigation.

PHASE 3 – Local storage and recipe data models.

PHASE 4 – Recipe management.

PHASE 5 – Recipe Card Designer foundations.

PHASE 6 – External asset importing and asset library.

PHASE 7 – Object manipulation, layers and freehand drawing.

PHASE 8 – Templates and reusable designs.

PHASE 9 – Export, backup and restore.

PHASE 10 – PWA installation, mobile optimization and testing.

Complete and verify each phase before continuing.

# 14. TOKEN EFFICIENCY AND DEVELOPMENT RULES

Token efficiency is important.

Follow these rules:

1. Be concise and technical.
2. Do not repeat established requirements.
3. Do not explain basic programming concepts unless requested.
4. Inspect the existing project before making changes.
5. Work on one feature at a time.
6. Modify only relevant files.
7. Reuse existing components.
8. Avoid unnecessary dependencies.
9. Do not rewrite working code.
10. Identify root causes when debugging.
11. Run relevant tests and build checks.
12. Do not output entire files when a summary is sufficient.
13. Report modified files, important decisions and remaining issues.
14. Maintain a concise PROJECT_STATE.md.
15. Keep documentation updated only when meaningful decisions or progress occur.

If a task is too large, split it into smaller implementation steps.

Never implement several major features simultaneously without approval.

# 15. FIRST TASK – NO CODING YET

Before writing any application code:

1. Analyze the complete product concept.
2. Propose the simplest appropriate architecture.
3. Confirm the technology stack.
4. Define the data models.
5. Explain how recipe data and card designs will be separated.
6. Propose the architecture of the visual editor.
7. Explain how Fabric.js will handle imported assets and canvas objects.
8. Define how external drawings and transparent PNG files will be imported.
9. Explain local storage and backup architecture.
10. Propose the main application screens.
11. Identify iPhone and tablet compatibility challenges.
12. Define a realistic MVP.
13. Propose the development sequence.

Present a concise technical blueprint.

Do not write application code until I approve the architecture.

FINAL PRODUCT PRIORITY:

The most important thing is the Recipe Card Designer.

I want to create beautiful, unique recipe cards using my own drawings, illustrations, photographs, typography and decorative elements.

The application should feel like my own personal creative cookbook, not a generic recipe database.