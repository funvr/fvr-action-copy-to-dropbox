const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');

const dropboxToken = core.getInput('token', { required: true });
core.setSecret(dropboxToken);

testAuthentication();

function testAuthentication() {
  console.log("Token: " + dropboxToken);

  const url = "https://api.dropboxapi.com/2/check/user";
  let req = new XMLHttpRequest();
  req.onreadystatechange = function() {
    if(xhr.readyState === XMLHttpRequest.DONE) {
      var status = xhr.status;
      if (status === 0 || (status >= 200 && status < 400)) {
        // The request has been completed successfully
        console.log(xhr.responseText);
      } else {
        // Oh no! There has been an error with the request!
      }
    }
  };
  req.addEventListener("progress", updateProgress);
  req.addEventListener("load", transferComplete);
  req.addEventListener("error", transferFailed);
  req.setRequestHeader("Authorization", "Bearer " + dropboxToken);
  req.setRequestHeader("Content-Type", "application/json");
  let data = new Blob("{\"query\": \"foo\"}", {type: 'application/json'});

  req.open("POST", url, false);
  req.send(data);
}

function transferComplete(event) {
  console.log("The transfer is complete. " + event);
}

function transferFailed(event) {
  console.log("An error occurred.");
  core.setFailed(event);
}