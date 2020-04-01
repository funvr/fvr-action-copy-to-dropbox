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

checkDropboxAuthentication();
getDirFilesRecursive(srcPath);
uploadBuild(filesToUpload, 0);

function checkDropboxAuthentication() {
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

function uploadBuild(files, fileIndex) {
  uploadFile(files[fileIndex], onUploadSuccess, onUploadFail);
}

function onUploadSuccess(localFilePath, response) {
  console.log('Upload Successful:' + localFilePath + '\n');
  console.log(response.data);
}

function onUploadFail(error) {
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
}

function uploadFile(filePath, onSuccess, onFail) {
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
    onSuccess(filePath, response);
  }).catch(function (error) {
    onFail(error);
  });
}