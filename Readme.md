# Backend Server

This project is a backend server using Express, Axios, CORS, Dotenv, and Octokit to interact with the GitHub API. The server provides several endpoints for managing GitHub OAuth tokens, retrieving file content, listing YAML files, updating translations, and managing pull requests.

## Prerequisites

Ensure you have the following installed on your machine:

- [Node.js v20.15.0](https://nodejs.org/)
## Endpoints
### POST /api/github/token

Retrieves a GitHub OAuth token.

-  Body: { "code": "auth_code" }
-  Response: { "access_token": "token", ... }

### POST /api/github/content

Retrieves the content of a file in a GitHub repository.

- Body: { "token": "github_token", "repo": "repository_name", "path": "file_path" }
- Response: { "content": "file_content" }

### POST /api/github/list

Lists all YAML files in a given directory of a GitHub repository.

- Body: { "token": "github_token", "repo": "repository_name", "path": "directory_path" }
- Response: [ { "name": "file1.yml", ... }, ... ]

### POST /api/github/update

Updates translations in a YAML file.

- Body: { "token": "github_token", "repo": "repository_name", "path": "file_path", "translations": { "key": "value" }, "language": "language_code" }
- Response: { "message": "success", ... }

### POST /api/github/changed

Checks for changes in files of a pull request.

- Body: { "token": "github_token", "repo": "repository_name" }
- Response: { "diffsData": [ ... ], "commentsData": [ ... ], "pullnumber": pull_number }

### POST /api/github/pull

Marks a pull request as "ready for review" and merges it if possible.

- Body: { "token": "github_token", "repo": "repository_name", "pullnumber": pull_number }
- Response: { "mergeResult": "success", ... }