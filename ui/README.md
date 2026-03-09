# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/65e63550-1ddb-41ca-9b98-cb63cea1baf2

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/65e63550-1ddb-41ca-9b98-cb63cea1baf2) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## Configuration

### Environment Variables

The application connects to a backend API. The base URL for this API can be configured using an environment variable.

Create a `.env` file in the root of the `ui` directory (e.g., `ui/.env`) and add the following line:

```
VITE_API_BASE_URL=http://your-api-host:port
```

Replace `http://your-api-host:port` with the actual URL of your backend API. For local development, this typically defaults to `http://localhost:8000` if the backend is running on port 8000.

This `.env` file is ignored by Git (as specified in `ui/.gitignore`), so each developer can set their own local API endpoint without affecting others. If the `VITE_API_BASE_URL` is not set in the `.env` file, the application will fall back to a default URL specified in `ui/src/utils/api.ts` (currently `http://localhost:8000`).

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/65e63550-1ddb-41ca-9b98-cb63cea1baf2) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
