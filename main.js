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
testUpload(filesToUpload, 0);

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

function testUpload(files, fileIndex) {
  uploadFile(files[fileIndex], () => {
    fileIndex++;
    if (fileIndex >= files.length) {
      console.log("All files uploaded");
      return;
    }
    testUpload(files, fileIndex);
  });
}

function uploadFile(filePath, callback) {
  console.log("File: " + filePath);
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
    console.log('Upload Successful: ' + filePath);
    callback();
  }).catch(function (error) {
    if (error.response) {
      // Try again if it's a rate limit error
      if (error.response.headers['retry-after']) {
        console.log("Hit rate limit");
      } else {
        console.log("Not rate-limit error: ");
        console.log(error.response);
      }
    } else {
      console.log("Unknown Error: " + error);
    }
    core.setFailed(error);
  });
}