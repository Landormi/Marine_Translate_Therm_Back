import express, { json, response } from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import { Octokit } from "octokit";
import { parse, stringify } from "yaml";
import { diffLines } from "diff";

import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

dotenv.config();

const app = express();
const port = 5000;

app.use(cors());
app.use(json());

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Marine_Translate_Therm Github\'s API',
      version: '1.0.0',
      description: 'API for interacting with GitHub repositories for Marine_Translate_Therm',
    },
  },
  apis: ['./server.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 * /api/github/token:
 *   post:
 *     summary: Exchange GitHub OAuth code for an access token
 *     description: This endpoint exchanges the OAuth authorization code for a GitHub access token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 description: The OAuth authorization code received from GitHub.
 *                 example: 'abc123'
 *     responses:
 *       200:
 *         description: Successfully retrieved the access token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                   description: The GitHub access token.
 *                   example: 'gho_1234567890abcdef'
 *                 token_type:
 *                   type: string
 *                   description: The type of the token.
 *                   example: 'bearer'
 *                 scope:
 *                   type: string
 *                   description: The scopes granted to the token.
 *                   example: 'repo,user'
 *       500:
 *         description: Internal server error.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'Server internal error'
 */
app.post('/api/github/token', async (req, res) => {
  const { code } = req.body;
  const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
  const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
  // console.log("CLIENT_ID"+CLIENT_ID);
  // console.log("CLIENT_SECRET"+CLIENT_SECRET);
  try {
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
      }),
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Error while retrieving the token:', error);
    res.status(500).send(`CLIENT_ID = ${CLIENT_ID} or ${process.env.GITHUB_CLIENT_ID} Server internal error`);
  }
});

app.get('/api/github/branch', async (req, res) => {
  const {repo, path} = req.query;
  const token = req.headers.authorization;
  try{
    const octokit = new Octokit({
      auth: token
    });
    const response = await octokit.request('GET /repos/{owner}/{repo}/branches', {
      owner: 'OWNER',
      repo: 'REPO',
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    const branchs = response.data.filter(branche => branche.name.startsWith(process.env.GITHUB_KEY_BRANCH));
    res.json(branchs);
  }catch(error){
    console.error('Error while retrieving the file count', error);
    res.status(500).send('Server internal error');
  }
});


/**
 * @swagger
 * /api/github/content:
 *   get:
 *     summary: Retrieve the content of a file from a GitHub repository
 *     description: This endpoint retrieves the content of a specific file/folder from a GitHub repository.
 *     parameters:
 *       - name: repo
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           description: The name of the GitHub repository.
 *           example: 'my-repo'
 *       - name: path
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           description: The path of the file within the repository.
 *           example: 'path/to/file.yml'
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved the file content.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               description: The content of the file in UTF-8 encoding.
 *       401:
 *         description: Unauthorized. The token is missing or invalid.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'Unauthorized'
 *       500:
 *         description: Internal server error.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'Server internal error'
 *     components:
 *       securitySchemes:
 *         BearerAuth:
 *           type: http
 *           scheme: bearer
 *           bearerFormat: JWT
 */
app.get('/api/github/content', async (req, res) => {
  const { repo, path } = req.query;
  const token = req.headers.authorization;
  // console.log(token);
  try{
    const octokit = new Octokit({
      auth: token
    });
    const response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: process.env.GITHUB_OWNER,
      repo,
      path: path,
      ref: process.env.GITHUB_BRANCH
    });
    res.json(Buffer.from(response.data.content, 'base64').toString('utf-8'));
  }catch (error){
    console.error('Error while retrieving the file count', error);
    res.status(500).send('Server internal error');
  }

});

/**
 * @swagger
 * /api/github/list:
 *   get:
 *     summary: Retrieve a list of YAML files from a GitHub repository directory
 *     description: This endpoint retrieves a list of files with a `.yml` extension from a specified directory in a GitHub repository.
 *     parameters:
 *       - name: repo
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           description: The name of the GitHub repository.
 *           example: 'my-repo'
 *       - name: path
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           description: The directory path within the repository to list files from.
 *           example: 'path/to/directory'
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved the list of YAML files.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     description: The name of the file.
 *                     example: 'config.yml'
 *                   path:
 *                     type: string
 *                     description: The path of the file within the repository.
 *                     example: 'path/to/directory/config.yml'
 *                   type:
 *                     type: string
 *                     description: The type of the item (should be 'file').
 *                     example: 'file'
 *       401:
 *         description: Unauthorized. The token is missing or invalid.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'Unauthorized'
 *       500:
 *         description: Internal server error.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'Server internal error'
 *     components:
 *       securitySchemes:
 *         BearerAuth:
 *           type: http
 *           scheme: bearer
 *           bearerFormat: JWT
 */
app.get('/api/github/list', async (req, res) => {
  const { repo, path, branch} = req.query;
  const token = req.headers.authorization;
  try{
    const octokit = new Octokit({
      auth: token
    });
    const response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: process.env.GITHUB_OWNER,
      repo,
      path: path,
      ref: branch
    });
    const files = response.data.filter(item => item.type === 'file' && item.name.endsWith('.yml'));
    res.json(files);
  }catch (error){
    console.error('Error while retrieving file list', error);
    res.status(500).send('Server internal error');
  }
});

/**
 * @swagger
 * /api/github/update:
 *   put:
 *     summary: Update a file's content in a GitHub repository
 *     description: This endpoint updates the content of a file in a GitHub repository by modifying translations based on the provided data. It requires authorization and performs a series of operations including fetching the current file content, updating it, and pushing the changes back to the repository.
 *     parameters:
 *       - name: repo
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           description: The name of the GitHub repository.
 *           example: 'my-repo'
 *       - name: path
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           description: The path to the file in the repository.
 *           example: 'path/to/file.yml'
 *       - name: translations
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           description: An object containing translation keys and their corresponding values.
 *           properties:
 *             [key]:
 *               type: string
 *               description: Translation key.
 *               example: 'greeting'
 *             [value]:
 *               type: string
 *               description: Translation value.
 *               example: 'Hello'
 *       - name: language
 *         in: body
 *         required: true
 *         schema:
 *           type: string
 *           description: The language code for the translations (e.g., 'en', 'fr').
 *           example: 'en'
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully updated the file content.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 content:
 *                   type: string
 *                   description: The updated file content.
 *                   example: 'Updated content of the file'
 *       400:
 *         description: Bad Request. Invalid input or missing parameters.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'Bad Request'
 *       401:
 *         description: Unauthorized. The token is missing or invalid.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'Unauthorized'
 *       500:
 *         description: Internal server error.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'Server internal error'
 *     components:
 *       securitySchemes:
 *         BearerAuth:
 *           type: http
 *           scheme: bearer
 *           bearerFormat: JWT
 */
app.put('/api/github/update', async (req, res) => {
  // console.log("update");
  const { repo, path, translations, language } = req.body;
  const token = req.headers.authorization;
  try{
    // console.log("1");
    const octokit = new Octokit({
      auth: token
    });
    // console.log(token);
    // console.log(repo);
    // console.log(path);
    const response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: process.env.GITHUB_OWNER,
      repo,
      path,
      ref: process.env.GITHUB_BRANCH
    });
    // console.log("2");
    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
    const contentObj = parse(content);
    contentObj.labels.forEach(label => {
      const translationKey = label.name;
      if (translations.hasOwnProperty(translationKey)) {
        const translationObj = label.translations.find(t => t.hasOwnProperty(language));
        if (translationObj) {
          translationObj[language] = translations[translationKey];
        }else{
          console.error("there is no " + language + " in the translation proposal ")
        }
      }
      
    });
    // console.log("3");
    const updatedContent = stringify(contentObj,{ quotingType: '"', prettyErrors: true });
    // console.log("4");
    const response2 = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
      owner: process.env.GITHUB_OWNER,
      repo,
      path,
      branch: process.env.GITHUB_BRANCH,
      message: `Update translations for ${path}`,
      content: Buffer.from(updatedContent).toString('base64'),
      sha : response.data.sha,
      headers :{
        'Content-Type':'application/json',
        'Authorization': 'token %s' % octokit.auth,
      }
    });
    // console.log("5");
    // console.log(response2);
    res.json(response2);
  }catch (error){
    console.error('Error while updating the file', error);
    res.status(500).send('Server internal error');
  }

});

/**
 * @swagger
 * /api/github/changed:
 *   get:
 *     summary: Get details of changes in the latest pull request or create a new one
 *     description: Retrieves information about changes in the latest pull request, or creates a new pull request if none exists. It compares the current branch with the main branch and provides a detailed diff of the changes along with any comments on the pull request.
 *     parameters:
 *       - name: repo
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           description: The name of the GitHub repository.
 *           example: 'my-repo'
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved the pull request details, including diffs and comments.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 diffsData:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       filename:
 *                         type: string
 *                         description: The name of the file.
 *                         example: 'path/to/file.yml'
 *                       before:
 *                         type: string
 *                         description: The content of the file before changes.
 *                         example: 'Old content'
 *                       after:
 *                         type: string
 *                         description: The content of the file after changes.
 *                         example: 'New content'
 *                       filesha:
 *                         type: string
 *                         description: SHA of the file.
 *                         example: 'abc123'
 *                       diff:
 *                         type: string
 *                         description: The diff between the old and new file contents.
 *                         example: '--- old\n+++ new\n@@ -1,2 +1,2 @@\n-Old content\n+New content'
 *                 commentsData:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       path:
 *                         type: string
 *                         description: The path of the file where the comment was made.
 *                         example: 'path/to/file.yml'
 *                       line:
 *                         type: integer
 *                         description: The line number of the comment.
 *                         example: 5
 *                       body:
 *                         type: string
 *                         description: The content of the comment.
 *                         example: 'This is a comment'
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         description: The timestamp when the comment was created.
 *                         example: '2024-08-13T12:34:56Z'
 *                 pullnumber:
 *                   type: integer
 *                   description: The number of the pull request.
 *                   example: 42
 *       400:
 *         description: Bad Request. Invalid or missing parameters.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'Bad Request'
 *       401:
 *         description: Unauthorized. Invalid or missing authorization token.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'Unauthorized'
 *       500:
 *         description: Internal server error.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'Server internal error'
 *     components:
 *       securitySchemes:
 *         BearerAuth:
 *           type: http
 *           scheme: bearer
 *           bearerFormat: JWT
 */
app.get('/api/github/changed', async (req, res) => {
  const { repo } = req.query;
  const token = req.headers.authorization;
  try {
    let pullnumber;
    const octokit = new Octokit({ auth: token });

    const response = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
      owner: process.env.GITHUB_OWNER,
      repo,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      },
      direction: process.env.GITHUB_BRANCH,
    });
    // console.log(response.data);
    if(!response.data[0]){
      const responseCompare = await octokit.request('GET /repos/{owner}/{repo}/compare/{base}...{head}', {
        owner: process.env.GITHUB_OWNER,
        repo,
        base: process.env.GITHUB_BRANCH,
        head: 'main'
      });
      if (responseCompare.data.behind_by == 0){
        res.json({compare: true});
        return;
      }
      const responseCreate = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
        owner: process.env.GITHUB_OWNER,
        repo,
        title: 'Amazing new translate',
        body: 'Please pull these awesome changes in!',
        head: process.env.GITHUB_BRANCH,
        base: 'main',
        draft : true,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      pullnumber = responseCreate.data.number;
    }else{
      pullnumber = response.data[0].number;
    }
    

    const { data: files } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
      owner: process.env.GITHUB_OWNER,
      repo,
      pull_number: pullnumber,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });


    const diffsData = await Promise.all(files.map(async file => {
      const beforeResponse = await octokit.request(`GET /repos/{owner}/{repo}/contents/{path}`, {
        owner: process.env.GITHUB_OWNER,
        repo,
        path: file.filename,
      });
      const beforeContent = Buffer.from(beforeResponse.data.content, 'base64').toString('utf-8');

      const afterResponse = await octokit.request(`GET ${file.contents_url}`);
      const afterContent = Buffer.from(afterResponse.data.content, 'base64').toString('utf-8');

      const diff = diffLines(beforeContent, afterContent);

      return {
        filename: file.filename,
        before: beforeContent,
        after: afterContent,
        filesha : file.sha,
        diff: diff
      };
    }));


    const commentsResponse = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/comments', {
      owner: process.env.GITHUB_OWNER,
      repo,
      pull_number: pullnumber,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    const commentsData = commentsResponse.data.map(comment => ({
      path: comment.path,
      line: comment.position,
      body: comment.body,
      created_at: comment.created_at,
    }));
    res.json({ diffsData, commentsData, pullnumber });
  } catch (error) {
    console.error('Aïe', error);
    res.status(500).send('Error while retrieving data.');
  }
});

/**
 * @swagger
 * /api/github/pull:
 *   put:
 *     summary: Merge a pull request if it's ready
 *     description: Checks if the specified pull request is mergeable. If it is, marks the pull request as ready for review and attempts to merge it into the base branch. Requires the pull request number and repository details.
 *     parameters:
 *       - name: repo
 *         in: body
 *         required: true
 *         schema:
 *           type: string
 *           description: The name of the GitHub repository.
 *           example: 'my-repo'
 *       - name: pullnumber
 *         in: body
 *         required: true
 *         schema:
 *           type: integer
 *           description: The number of the pull request.
 *           example: 42
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully merged the pull request.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sha:
 *                   type: string
 *                   description: The SHA of the commit created by the merge.
 *                   example: 'abc123def456'
 *                 merged:
 *                   type: boolean
 *                   description: Whether the pull request was successfully merged.
 *                   example: true
 *                 message:
 *                   type: string
 *                   description: A message describing the result of the merge.
 *                   example: 'Pull request successfully merged.'
 *       400:
 *         description: Bad Request. Invalid or missing parameters.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'Bad Request'
 *       401:
 *         description: Unauthorized. Invalid or missing authorization token.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'Unauthorized'
 *       500:
 *         description: Internal server error.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'Server internal error'
 *     components:
 *       securitySchemes:
 *         BearerAuth:
 *           type: http
 *           scheme: bearer
 *           bearerFormat: JWT
 */
app.put('/api/github/pull', async (req, res) => {
  const {repo, pullnumber } = req.body;
  const token = req.headers.authorization;
  try {
    const octokit = new Octokit({ auth: token });
    const response = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner: process.env.GITHUB_OWNER,
      repo,
      pull_number : pullnumber,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      },
      direction: process.env.GITHUB_BRANCH,
    });
    if(response.data.mergeable){
      const markReadyQuery = `
        mutation($pullRequestId: ID!) {
          markPullRequestReadyForReview(input: {pullRequestId: $pullRequestId}) {
            pullRequest {
              id
              number
              state
            }
          }
        }
      `;

      const pullRequestId = response.data.node_id;

      const responserfr = await octokit.graphql(markReadyQuery, {
        pullRequestId
      });
      const mergeResponse = await octokit.request('PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge', {
        owner: process.env.GITHUB_OWNER,
        repo,
        pull_number: pullnumber,
        commit_title: 'Merge pull'+pullnumber,
        commit_message: 'Add a new value to the merge_method',
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      })
      res.json(mergeResponse.data)
    }else{
    }
  } catch (error) {
    console.error('Error during merge:', error);
    // console.log("______________________________________");
    res.status(500).send('Server internal error');
  }
});

/**
 * @swagger
 * /api/github/comment:
 *   post:
 *     summary: Add a comment to a pull request
 *     description: Adds a comment to a specific line of a file in a pull request. Requires pull request number, repository, and comment details.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: The GitHub authentication token.
 *                 example: 'ghp_12345abcdeFGHIJ67890KLMNOP'
 *               pull_number:
 *                 type: integer
 *                 description: The number of the pull request where the comment will be added.
 *                 example: 42
 *               repo:
 *                 type: string
 *                 description: The name of the GitHub repository.
 *                 example: 'my-repo'
 *               comment:
 *                 type: string
 *                 description: The comment text to be added.
 *                 example: 'Great job on this section!'
 *               path:
 *                 type: string
 *                 description: The path to the file where the comment should be added.
 *                 example: 'src/index.js'
 *               sha:
 *                 type: string
 *                 description: The SHA of the commit in which the file is located.
 *                 example: 'abc123def456'
 *               line:
 *                 type: integer
 *                 description: The line number where the comment will be added.
 *                 example: 10
 *               side:
 *                 type: string
 *                 description: The side of the file to comment on ('RIGHT' or 'LEFT').
 *                 example: 'RIGHT'
 *             required:
 *               - token
 *               - pull_number
 *               - repo
 *               - comment
 *               - path
 *               - sha
 *               - line
 *               - side
 *     responses:
 *       200:
 *         description: Successfully added the comment.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: The ID of the comment.
 *                   example: 123456789
 *                 body:
 *                   type: string
 *                   description: The content of the comment.
 *                   example: 'Great job on this section!'
 *                 path:
 *                   type: string
 *                   description: The path to the file where the comment was added.
 *                   example: 'src/index.js'
 *                 line:
 *                   type: integer
 *                   description: The line number where the comment was added.
 *                   example: 10
 *       400:
 *         description: Bad Request. Invalid or missing parameters.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'Bad Request'
 *       401:
 *         description: Unauthorized. Invalid or missing authentication token.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'Unauthorized'
 *       500:
 *         description: Internal server error.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: 'Server internal error'
 *     components:
 *       securitySchemes:
 *         BearerAuth:
 *           type: http
 *           scheme: bearer
 *           bearerFormat: JWT
 */
app.post('/api/github/comment', async (req, res) => {
  const { token, pull_number, repo, comment, path, sha, line, side } = req.body;

  try {
    const octokit = new Octokit({ auth: token });
    const response = await octokit.request('POST /repos/{owner}/{repo}/pulls/{pull_number}/comments', {
      owner: process.env.GITHUB_OWNER,
      repo,
      pull_number,
      body: comment,
      commit_id: sha,
      path,
      line,
      side,
    })
    res.json(response.data);
  } catch (error) {
    console.error('Error while retrieving the token:', error);
    res.status(500).send(`CLIENT_ID = ${CLIENT_ID} or ${process.env.GITHUB_CLIENT_ID} Server internal error`);
  }
});

app.listen(port, () => {
  console.log(`Serveur backend en écoute sur http://localhost:${port}`);
  console.log(`Domain's name is : ${process.env.DOMAIN_NAME}`);
});
