const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const axios = require('axios').default;

const dropboxToken = core.getInput('token', { required: true });
core.setSecret(dropboxToken);

testAuthentication();

function testAuthentication() {
  const url = "https://api.dropboxapi.com/2/check/user";
  
  axios({
    url: url,
    method: 'post',
    headers: {
      'Authorization' : 'Bearer: ' + dropboxToken,
      'Content-Type' : 'application/json'
    },
    data : "{\"query\": \"foo\"}"
  }).then(function (response) {
    console.log(response.data);
    console.log(response.status);
    console.log(response.statusText);
    console.log(response.headers);
    console.log(response.config);
  }).catch(function (error) {
    console.log(error);
    core.setFailed(error);
  });
}