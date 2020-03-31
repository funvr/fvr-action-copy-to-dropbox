const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');
const axios = require('axios').default;

const dropboxToken = core.getInput('token', { required: true });
core.setSecret(dropboxToken);

var filesToUpload = [];
var directoriesToUpload = [];

testAuthentication();
listDirContents(core.getInput('srcPath', { required: true }));

console.log("Files: " + filesToUpload);
console.log("Dirs: " + directoriesToUpload);

function testAuthentication() {
  const url = "https://api.dropboxapi.com/2/check/user";

  axios({
    url: url,
    method: 'post',
    headers: {
      'Authorization' : 'Bearer ' + dropboxToken,
      'Content-Type' : 'application/json'
    },
    data : "{\"query\": \"test authentication\"}"
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

function uploadFile() {

}

function getFileData(filePath) {
  var data = null;

}