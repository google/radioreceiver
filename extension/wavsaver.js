// Copyright 2014 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * A class to save a WAV file (48k, 16-bit, stereo).
 *
 * The FileSystem API doesn't buffer writes, so this class implements that
 * buffer. The processor writes out the contents of the queue until it's
 * empty, and then polls it once a second for new items to write.
 * @param {FileEntry} fileEntry An entry for the WAV file.
 * @constructor
 */
function WavSaver(fileEntry) {

  var fileWriter;
  var queue = [];
  var writing = true;

  writeHeader();
  fileEntry.createWriter(function(writer) {
    fileWriter = writer;
    writer.onwriteend = processQueue;
    writer.onerror = processError;
    processQueue();
  });

  /**
   * Writes the contents of the queue and schedules the next execution of
   * this function, if the queue is empty. After finish() was called and
   * the queue goes empty, fixes up the chunk sizes in the headers and
   * stops rescheduling.
   */
  function processQueue() {
    if (queue == null) {
      return;
    }
    if (queue.length == 0) {
      if (writing) {
        setTimeout(processQueue, 1000);
      } else {
        fileWriter.seek(0);
        fileWriter.write(new Blob([createHeader(fileWriter.length).buffer]));
      }
      return;      
    }
    var blob = new Blob(queue);
    queue = [];
    fileWriter.write(blob);
  }

  /**
   * Empties the queue and stops writing.
   */
  function processError() {
    writing = false;
    queue = null;
  }

  /**
   * Puts the contents of the given array in the queue.
   */
  function writeArray(arr) {
    if (writing) {
      queue.push(arr.buffer);
    }
  }

  /**
   * Creates a WAV header's data.
   * @param {number} size The total file size.
   */
  function createHeader(size) {
    return new Int32Array([
      0x46464952,   // "RIFF"
      size - 8,     // chunk size
      0x45564157,   // "WAVE"
      0x20746d66,   // "fmt "
      0x10,         // chunk size
      0x00020001,   // PCM, 2 channels
      48000,        // sample rate
      192000,       // data rate
      0x00100004,   // 4 bytes/block, 16 bits/sample
      0x61746164,   // "data"
      size - 44     // chunk size (0 for now)
    ]);
  }

  /**
   * Puts the WAV headers in the queue.
   */
  function writeHeader() {
    writeArray(createHeader(44));
  }

  /**
   * Writes a block of samples.
   * @param {Float32Array} leftSamples The samples for the left speaker.
   * @param {Float32Array} rightSamples The samples for the right speaker.
   */
  function writeSamples(leftSamples, rightSamples) {
    var out = new Int16Array(leftSamples.length * 2);
    for (var i = 0; i < leftSamples.length; ++i) {
      out[i * 2] =
          Math.floor(Math.max(-1, Math.min(1, leftSamples[i])) * 32767);
      out[i * 2 + 1] =
          Math.floor(Math.max(-1, Math.min(1, rightSamples[i])) * 32767);
    }
    writeArray(out);
  }

  /**
   * Finishes writing to the WAV file.
   */
  function finish() {
    writing = false;
  }

  /**
   * Tells whether the class has finished writing to the WAV file.
   */
  function hasFinished() {
    return !writing;
  }

  return {
    writeSamples: writeSamples,
    finish: finish,
    hasFinished: hasFinished
  };
}

