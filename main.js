const core = require('@actions/core');
const github = require('@actions/github');
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
var directoriesToUpload = [];

testAuthentication();
listDirContents(srcPath);

console.log("Files: " + filesToUpload);
console.log("Dirs: " + directoriesToUpload);

testUpload();

function testAuthentication() {
  const url = "https://api.dropboxapi.com/2/check/user";
  const data = {
    query: "Test Authentication"
  }

  axios({
    url: url,
    method: 'post',
    maxContentLength: Infinity,
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

function listDirContents(rootPath) {
  fs.readdirSync(rootPath).forEach(item => {
    const fullPath = path.join(rootPath, item);
    if (fs.lstatSync(fullPath).isDirectory()) {
      directoriesToUpload.push(fullPath);
      listDirContents(fullPath);
    } else {
      filesToUpload.push(fullPath);
    }
  });
}

function testUpload() {
  for (var i = 0; i < filesToUpload.length; i++) {
    uploadFile(filesToUpload[i]);
  }
}

function uploadFile(filePath) {
  let fileDstPath = filePath.replace(srcPath, dstPath);
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
    headers: {
      'Authorization' : 'Bearer ' + dropboxToken,
      'Content-Type' : 'application/octet-stream',
      'Dropbox-API-Arg' : JSON.stringify(apiArgs)
    },
    data : fileContent
  }).then(function (response) {
    console.log(response.name + ' Uploaded');
  }).catch(function (error) {
    console.log(error);
    core.setFailed(error);
  });
}