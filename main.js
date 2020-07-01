const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const axios = require('axios').default;

const srcPath = core.getInput('srcPath', { required: true });
const dstPath = core.getInput('dstPath', { required: true });
const projectName = core.getInput('projectName', {required: true });
let fullDstPath = dstPath;
const appendTimestamp = (core.getInput('timestamp', {required: false}) == 'true');
const dropboxToken = core.getInput('token', { required: true });
core.setSecret(dropboxToken);

// 150MB per upload limit on the Dropbox API
const MAX_UPLOAD_BYTES = 1024 * 1024 * 150;
var filesToUpload = [];

configDstPath();
checkDropboxAuthentication();

function configDstPath() {
  if (!appendTimestamp) {
    return;
  }

  let date = new Date();
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  if (month < 10) {
    month = '0' + month;
  }
  let day = date.getDate();
  if (day < 10) {
    day = '0' + day;
  }

  let hour = date.getHours();
  if (hour < 10) {
    hour = '0' + hour;
  }

  let minute = date.getMinutes();
  if (minute < 10) {
    minute = '0' + minute;
  }
  
  // Trim trailing '/'
  let pathLength = fullDstPath.length;
  if (fullDstPath[pathLength - 1] == '/') {
    fullDstPath = fullDstPath.substring(0, pathLength - 1);
  }

  let yearMonth = year + '-' + month;
  let hourMinute = hour + '-' + minute;

  fullDstPath = fullDstPath + '/' + yearMonth + '/' + projectName + '/' + projectName + '_' + yearMonth + '-' + day + '_' + hourMinute + '/';
}

function checkDropboxAuthentication() {
  const url = "https://api.dropboxapi.com/2/check/user";
  const data = {
    query: "Check Authentication"
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
    onAuthenticationSuccess(response);
  }).catch(function (error) {
    onAuthenticationFail(error);
  });
}

function onAuthenticationSuccess(response) {
  console.log('Auth response: ' + response.status);
  console.log('Auth response: ' + response.statusText);

  getDirFilesRecursive(srcPath);
  startUpload();
}

function onAuthenticationFail(error) {
  console.log(error);
  core.setFailed(error);
}

function getDirFilesRecursive(dir) {
  fs.readdirSync(dir).forEach(item => {
    const fullPath = path.join(dir, item);
    if (fs.lstatSync(fullPath).isDirectory()) {
      getDirFilesRecursive(fullPath);
    } else {
      filesToUpload.push(fullPath);
    }
  });
}

function startUpload() {
  axios.interceptors.response.use(
    function (response) {
      // do nothing
    }, function (error) {
      const originalRequest = error.config;
      console.log("Upload failed, retrying..");
      console.log(originalRequest);
      axios({
        url: originalRequest.url,
        data: originalRequest.data,
        method: originalRequest.method,
        headers: originalRequest.headers
      }).then(function (response) {
        onSuccess(filePath, response);
      }).catch(function (error) {
        onFail(error);
      });
    }
  );

  let file = filesToUpload[0];
  fs.stat(file, function(err, stats) {
    if (err) {
      core.setFailed(err.message);
      return;
    }
    
    if (stats.size <= MAX_UPLOAD_BYTES) {
      uploadFile(file, onUploadSuccess, onUploadFail);
      return;
    }

    uploadFileSession(file, stats);
  });
}

function uploadFile(filePath, onSuccess, onFail) {
  console.log("File: " + filePath);
  const fileDstPath = filePath.replace(srcPath, fullDstPath);
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

function uploadFileSession(filePath, fileStats) {
  console.log("File: " + filePath);
  const fileDstPath = filePath.replace(srcPath, fullDstPath);
  console.log("Upload session start: " + fileDstPath);

  const fd = fs.openSync(filePath);
  const buffer = Buffer.alloc(MAX_UPLOAD_BYTES);

  fs.read(fd, buffer, 0, MAX_UPLOAD_BYTES, 0, function(err, bytesRead, buff) {
    fs.closeSync(fd);
    if (err) {
      console.log(err);
      core.setFailed(err.message);
      return;
    }

    uploadSessionStart(buff, MAX_UPLOAD_BYTES, function(sessionId, numBytesSent) { 
      onUploadChunkSuccess(sessionId, numBytesSent, filePath, fileStats); 
    });
  });
}

function uploadSessionStart(data, dataSize, onChunkSent) {
  const url = "https://content.dropboxapi.com/2/files/upload_session/start";

  axios({
    url: url,
    method: 'post',
    maxContentLength: MAX_UPLOAD_BYTES,
    headers: {
      'Authorization' : 'Bearer ' + dropboxToken,
      'Content-Type' : 'application/octet-stream',
    },
    data: data
  }).then(function (response) {
    onChunkSent(response.data.session_id, dataSize);
  }).catch(function (error) {
    console.log(error);
    core.setFailed(error.message);
  });
}

function onUploadChunkSuccess(sessionId, numBytesSent, filePath, fileStats) {
  const remainingBytes = fileStats.size - numBytesSent;
  console.log("Uploaded " + numBytesSent + " bytes.  Remaining: " + remainingBytes);

  if (remainingBytes <= MAX_UPLOAD_BYTES) {
    uploadSessionFinish(sessionId, filePath, numBytesSent, remainingBytes, onUploadSuccess, onUploadFail);
    return;
  }

  uploadSessionAppend(sessionId, filePath, numBytesSent, MAX_UPLOAD_BYTES, 
    function(sessionId, totalBytesSent) { 
      onUploadChunkSuccess(sessionId, totalBytesSent, filePath, fileStats);
    }, 
    onUploadFail);
}

function uploadSessionFinish(sessionId, filePath, offset, remainingBytes, onSuccess, onFail) {
  console.log("File: " + filePath);
  const fileDstPath = filePath.replace(srcPath, fullDstPath);
  console.log("Upload session finish: " + fileDstPath);

  const buffer = Buffer.alloc(remainingBytes);
  const fd = fs.openSync(filePath);

  fs.read(fd, buffer, 0, remainingBytes, offset, function(err, bytesRead, buff) {
    fs.closeSync(fd);

    if (err) {
      console.log(err);
      core.setFailed(err.message);
      return;
    }

    const url = "https://content.dropboxapi.com/2/files/upload_session/finish";
    const apiArgs = {
      cursor: {
        session_id: sessionId,
        offset: offset
      },
      commit: {
        path: fileDstPath,
        mute: true
      }
    }
    
    axios({
      url: url,
      method: 'post',
      maxContentLength: MAX_UPLOAD_BYTES,
      headers: {
        'Authorization' : 'Bearer ' + dropboxToken,
        'Content-Type' : 'application/octet-stream',
        'Dropbox-API-Arg' : JSON.stringify(apiArgs)
      },
      data: buff
    }).then(function (response) {
      onSuccess(filePath, response);
    }).catch(function (error) {
      onFail(error);
    });
  });
}

function uploadSessionAppend(sessionId, filePath, offset, numBytes, onSuccess, onFail) {
  console.log("File: " + filePath);
  const fileDstPath = filePath.replace(srcPath, fullDstPath);
  console.log("Upload session append: " + fileDstPath);

  const buffer = Buffer.alloc(numBytes);
  const fd = fs.openSync(filePath);

  fs.read(fd, buffer, 0, numBytes, offset, function (err, bytesRead, buff) {
    fs.closeSync(fd);

    if (err) {
      console.log(err);
      core.setFailed(err.message);
      return;
    }

    const url = "https://content.dropboxapi.com/2/files/upload_session/append_v2";
    const apiArgs = {
      cursor: {
        session_id: sessionId,
        offset: offset
      },
      close: false
    };

    let jsonStr = JSON.stringify(apiArgs);
    console.log("apiArgs: " + jsonStr);

    axios({
      url: url,
      method: 'post',
      maxContentLength: MAX_UPLOAD_BYTES,
      headers: {
        'Authorization' : 'Bearer ' + dropboxToken,
        'Content-Type' : 'application/octet-stream',
        'Dropbox-API-Arg' : jsonStr
      },
      data: buff
    }).then(function (response) {
      onSuccess(sessionId, offset + numBytes);
    }).catch(function (error) {
      onFail(error);
    });
  })
}

function onUploadSuccess(localFilePath, response) {
  console.log('Upload Successful: ' + localFilePath + '\n');

  // As we only attempt to upload the next file on success of the previous, index should always be 0
  filesToUpload.splice(0, 1);
  
  if (filesToUpload.length == 0) {
    return;
  }

  startUpload();
}

function onUploadFail(error) {
  if (error.response) {
    if (error.response.headers['retry-after']) {
      console.log("Hit rate limit");
    } else {
      console.log("Not rate-limit error: ");
      console.log(error.response);
    }
  } else {
    console.log("Unknown Error: " + error);
  }
}