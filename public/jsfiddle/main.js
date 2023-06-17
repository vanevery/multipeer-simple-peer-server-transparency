 
/*
*  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/

"use strict";

const mediaSource = new MediaSource();
mediaSource.addEventListener("sourceopen", handleSourceOpen);
mediaSource.addEventListener("sourceclose", () =>
  console.log("mediaSource closed")
);
mediaSource.addEventListener("sourceended", () =>
  console.log("mediaSource ended")
);
let mediaRecorder;
let recordedBlobs;
let sourceBuffer;
let updatingBuffer = false;
let options;
const constraints = {
  audio: false,
  video: {
    width: 1280,
    height: 720
  }
};
let userMediaStream;

const recordedVideo = document.querySelector("video#recorded");
const recordButton = document.querySelector("button#record");
recordButton.addEventListener("click", () => {
  if (recordButton.textContent === "Start") {
    startRecording();
  } else {
    stopRecording();
    recordButton.textContent = "Start";
  }
});

function handleSourceOpen(event) {
  console.log("MediaSource opened");
  sourceBuffer = mediaSource.addSourceBuffer(options.mimeType);
  sourceBuffer.addEventListener("update", () => {
    console.log("sourceBuffer update");
  });
  sourceBuffer.addEventListener("error", e =>
    console.log(`sourceBuffer error:`,e)
  );
  console.log("Source buffer: ", sourceBuffer);
  sourceBuffer.addEventListener("abort", () =>
    console.log("sourceBuffer abort")
  );
  sourceBuffer.addEventListener("updatestart", () =>
    console.log("sourceBuffer update start")
  );
  sourceBuffer.addEventListener("updateend", () => {
    console.log("sourceBuffer update end");
    updatingBuffer = false;
  });
}

async function handleDataAvailable(event) {
  // console.log("handleDataAvailable", event);
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
  }

  if (recordedBlobs.length > 5) {
    if (recordedBlobs.length === 5)
      console.log("buffered enough for delayed playback");
    if (!updatingBuffer) {
      updatingBuffer = true;
      const bufferedBlob = recordedBlobs.shift();
      const bufferedAsArrayBuffer = await bufferedBlob.arrayBuffer();
      if (!sourceBuffer.updating) {
        console.log("appending to buffer");
        sourceBuffer.appendBuffer(bufferedAsArrayBuffer);
      } else {
        console.warn("Buffer still updating... ");
        recordedBlobs.unshift(bufferedBlob);
      }
    }
  }
}

async function startRecording() {
  console.log("Using media constraints:", constraints);
  await startUserMedia(constraints);

  recordedBlobs = [];
  options = { mimeType: "video/webm;codecs=vp9" };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    console.error(`${options.mimeType} is not Supported`);
    errorMsgElement.innerHTML = `${options.mimeType} is not Supported`;
    options = { mimeType: "video/webm;codecs=vp8" };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.error(`${options.mimeType} is not Supported`);
      errorMsgElement.innerHTML = `${options.mimeType} is not Supported`;
      options = { mimeType: "video/webm" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.error(`${options.mimeType} is not Supported`);
        errorMsgElement.innerHTML = `${options.mimeType} is not Supported`;
        options = { mimeType: "" };
      }
    }
  }

  try {
    mediaRecorder = new MediaRecorder(userMediaStream, options);
  } catch (e) {
    console.error("Exception while creating MediaRecorder:", e);
    errorMsgElement.innerHTML = `Exception while creating MediaRecorder: ${JSON.stringify(
      e
    )}`;
    return;
  }

  console.log("Created MediaRecorder", mediaRecorder, "with options", options);
  recordButton.textContent = "Stop";
  mediaRecorder.onstop = event => {
    console.log("Recorder stopped: ", event);
  };
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start(100); // collect 100ms of data
  console.log("MediaRecorder started", mediaRecorder);

  recordedVideo.src = null;
  recordedVideo.srcObject = null;
  recordedVideo.src = window.URL.createObjectURL(mediaSource);
  recordedVideo.controls = true;
  try {
    await recordedVideo.play();
  } catch (e) {
    console.error(`Play failed: ${e}`);
  }
}

function stopRecording() {
  stopUserMedia();
  mediaRecorder.stop();
}

async function startUserMedia(constraints) {
  try {
    userMediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    const gumVideo = document.querySelector("video#gum");
    gumVideo.srcObject = userMediaStream;
  } catch (e) {
    console.error("navigator.getUserMedia error:", e);
    errorMsgElement.innerHTML = `navigator.getUserMedia error:${e.toString()}`;
  }
}

function stopUserMedia() {
  const tracks = userMediaStream.getTracks();
  for (const track of tracks) {
    track.stop();
    userMediaStream.removeTrack(track);
  }
  userMediaStream = null;
}
