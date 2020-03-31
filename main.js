const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const axios = require('axios').default;

const dropboxToken = core.getInput('token', { required: true });
core.setSecret(dropboxToken);

testAuthentication();
listFiles();


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
    console.log(response.status);
    console.log(response.statusText);
  }).catch(function (error) {
    console.log(error);
    core.setFailed(error);
  });
}

function listFiles() {
  fs.readdir(core.getInput('srcPath', { required: true }), function(err, items) {
    console.log(items);

    for (var i = 0; i < items.length; i++) {
      console.log(items[i]);
    }
  });
}

function uploadFile() {

}

function getFileData(filePath) {
  var data = null;

}