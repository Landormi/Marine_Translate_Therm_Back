import express, { json, response } from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import { Octokit } from "octokit";
import { parse, stringify } from "yaml";
import { diffLines } from "diff";

dotenv.config();

const app = express();
const port = 5000;

app.use(cors());
app.use(json());

app.post('/api/github/token', async (req, res) => {
  const { code } = req.body;
  console.log(req)
  console.log('code : '+ code)
  const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
  const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
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
    console.log(response.data)
    res.json(response.data);
  } catch (error) {
    console.error('Error while retrieving the token:', error);
    res.status(500).send(`CLIENT_ID = ${CLIENT_ID} or ${process.env.GITHUB_CLIENT_ID} Server internal error`);
  }
});

app.post('/api/github/content', async (req, res) => {
  const { token, repo, path } = req.body;
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

app.post('/api/github/list', async (req, res) => {
  const { token, repo, path } = req.body;
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
    const files = response.data.filter(item => item.type === 'file' && item.name.endsWith('.yml'));
    res.json(files);
  }catch (error){
    console.error('Error while retrieving file list', error);
    res.status(500).send('Server internal error');
  }

});

app.post('/api/github/update', async (req, res) => {
  const { token, repo, path, translations, language} = req.body;
  try{
    const octokit = new Octokit({
      auth: token
    });
    const response = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: process.env.GITHUB_OWNER,
      repo,
      path,
      ref: process.env.GITHUB_BRANCH
    });
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
    const updatedContent = stringify(contentObj,{ quotingType: '"', prettyErrors: true });
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
    })
    res.json(response2);
  }catch (error){
    console.error('Error while updating the file', error);
    res.status(500).send('Server internal error');
  }

});


app.post('/api/github/changed', async (req, res) => {
  const { token, repo } = req.body;
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
    // console.log(files);


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
    // console.log(commentsResponse.data);

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

app.post('/api/github/pull', async (req, res) => {
  const { token, repo, pullnumber } = req.body;
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
    // console.log("______________________________________");
    // console.log("response :");
    // console.log(response);
    // console.log("______________________________________");
    // console.log("response data :");
    // console.log(response.data);
    // console.log("______________________________________");
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
      // console.log(responserfr);
      // console.log("______________________________________");
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
      // console.log("margeble : \n" + response.data.mergeable);
      // console.log("______________________________________");
    }
    // console.log(response.data)
    // console.log("______________________________________");
    // res.json(response.data);
  } catch (error) {
    console.error('Error during merge:', error);
    console.log("______________________________________");
    res.status(500).send('Server internal error');
  }
});



app.listen(port, () => {
  console.log(`Serveur backend en écoute sur http://localhost:${port}`);
});
