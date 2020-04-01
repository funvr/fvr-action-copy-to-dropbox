const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const axios = require('axios').default;

const srcPath = core.getInput('srcPath', { required: true });
const dstPath = core.getInput('dstPath', { required: true })
const dropboxToken = core.getInput('token', { required: true });
core.setSecret(dropboxToken);

// 150MB per upload limit on the Dropbox API
const MAX_UPLOAD_BYTES = 157286400;
var filesToUpload = [];

testAuthentication();
getDirFilesRecursive(srcPath);
console.log("Files: " + filesToUpload);

testUpload(filesToUpload);

function testAuthentication() {
  const url = "https://api.dropboxapi.com/2/check/user";
  const data = {
    query: "Test Authentication"
  }

  axios({
    url: url,
    method: 'post',
    headers: {
      'Authorization' : 'Bearer ' + dropboxToken,
      'Content-Type' : 'application/json'
    },
    data : JSON.stringify(data)
  }).then(function (response) {
    console.log('Auth response: ' + response.status);
    console.log('Auth response: ' + response.statusText);
  }).catch(function (error) {
    console.log(error);
    core.setFailed(error);
  });
}

function getDirFilesRecursive(rootPath) {
  fs.readdirSync(rootPath).forEach(item => {
    const fullPath = path.join(rootPath, item);
    if (fs.lstatSync(fullPath).isDirectory()) {
      getDirFilesRecursive(fullPath);
    } else {
      filesToUpload.push(fullPath);
    }
  });
}

function testUpload(files) {
  files.forEach(file => {
    setTimeout(() => {
      uploadFile(file);
    }, 2000);
  });
}

function uploadFile(filePath) {
  const fileDstPath = filePath.replace(srcPath, dstPath);
  console.log("Uploading to: " + fileDstPath);

  const fileContent = fs.readFileSync(filePath);
  const apiArgs = {
    path: fileDstPath,
    mute: true
  }

  const url = "https://content.dropboxapi.com/2/files/upload";
  axios({
    url: url,
    method: 'post',
    maxContentLength: MAX_UPLOAD_BYTES,
    headers: {
      'Authorization' : 'Bearer ' + dropboxToken,
      'Content-Type' : 'application/octet-stream',
      'Dropbox-API-Arg' : JSON.stringify(apiArgs)
    },
    data : fileContent
  }).then(function (response) {
    console.log(response.name + ' Uploaded Successfully');
  }).catch(function (error) {
    if (error.response) {
      // Try again if it's a rate limit error
      if (error.response.headers.retry-after) {
        let wait = error.response.headers.retry-after;
        setTimeout(() => {
          uploadFile(fileDstPath);
        }, wait * 2000);
      } else {
        console.log("Not rate-limit error: ");
        console.log(error.response);
      }
    } else {
      console.log("Unknown Error: " + error.message);
    }
    core.setFailed(error);
  });
}